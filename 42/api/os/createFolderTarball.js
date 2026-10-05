import { fileIndex } from "../fileIndex.js"
import { flatten } from "../../lib/type/object/flatten.js"
import { fs } from "../fs.js"
import { tarPackPipe } from "../../formats/compression/tar/tarPackPipe.js"
import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { normalizeDirname } from "../fs/normalizeFilename.js"

function isNotDownloadable(key, inode) {
  return (
    key !== ".directory" &&
    !key.endsWith(".desktop") &&
    (inode === 0 || typeof inode === "string")
  )
}

/**
 * @param {string} folderPath
 * @param {{ includeURLFiles?: boolean, signal?: AbortSignal, onProgress?: Function, onTotal?: Function, onDone?: Function }} [options]
 * @returns {Promise<ReadableStream>}
 */
export async function createFolderTarball(folderPath, options = {}) {
  const { includeURLFiles, signal, onProgress, onTotal } = options
  const isAbortError = (err) =>
    err?.name === "AbortError" ||
    err === signal?.reason ||
    err === "User cancelled" ||
    err?.message === "User cancelled"
  folderPath = normalizeDirname(folderPath)

  const segments = folderPath.split("/").filter(Boolean)
  let targetDir = fileIndex.value
  for (const seg of segments) {
    if (!isHashmapLike(targetDir)) {
      targetDir = undefined
      break
    }
    targetDir = targetDir[seg]
  }

  if (!isHashmapLike(targetDir)) {
    throw new Error(`Directory not found: ${folderPath}`)
  }

  const folderName = getBasename(folderPath)
  const promises = []

  const pack = tarPackPipe(options)

  let total = 0
  let count = 0

  for (const [key, inode] of flatten.entries(targetDir, "/")) {
    if (isNotDownloadable(key, inode)) {
      if (includeURLFiles) total++
    } else if (isHashmapLike(inode)) {
      if (Object.keys(inode).length === 0) total++
    } else {
      total++
    }
  }

  onTotal?.(total)

  for (const [key, inode] of flatten.entries(targetDir, "/")) {
    const originalFilePathname = `${folderPath}${key}`
    const tarPath = `${folderName}/${key}`

    if (isNotDownloadable(key, inode)) {
      if (includeURLFiles) {
        const url = new URL(originalFilePathname, location.origin).href
        const content = `[InternetShortcut]\nURL=${url}\n`
        promises.push(
          pack
            .add({ name: tarPath + ".url" }, new Blob([content]))
            .catch((err) => {
              if (isAbortError(err)) return null
              throw err
            }),
        )
        count++
        onProgress?.(tarPath, count, total)
      }
    } else if (isHashmapLike(inode)) {
      if (Object.keys(inode).length === 0) {
        promises.push(
          pack.add({ name: tarPath + "/", type: "directory" }).catch((err) => {
            if (isAbortError(err)) return null
            throw err
          }),
        )
        count++
        onProgress?.(tarPath, count, total)
      }
    } else {
      count++
      promises.push(
        fs
          .open(originalFilePathname)
          .then((file) => {
            onProgress?.(tarPath, count, total)
            return pack.add({ name: tarPath }, file).catch((err) => {
              if (isAbortError(err)) return null
              throw err
            })
          })
          .catch(() => null),
      )
    }
  }

  queueMicrotask(async () => {
    try {
      await Promise.all(promises)
    } catch (err) {
      if (!isAbortError(err)) throw err
    } finally {
      // Calling stream() will flush the queue (which is empty because we awaited pack.add)
      // and append the END_OF_TAR block, then close the writer.
      pack.stream()
      options?.onDone?.()
    }
  })

  // We return the readable part of the TransformStream immediately.
  return pack.readable
}
