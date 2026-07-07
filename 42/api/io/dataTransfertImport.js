// import { handleEffect } from "./dataTransferEffects.js"

import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"

/**
 * @typedef {{
 *  files: { [filename: string]: File; };
 *  folders: string[];
 *  strings: string[];
 *  objects: any[];
 *  json: any;
 *  effect: string;
 *  x?: number;
 *  y?: number;
 * }} DataTransfertImport
 */

// [1] readEntries() will only return the first 100 FileSystemEntry
// https://stackoverflow.com/a/53058574/1289275
// https://stackoverflow.com/a/51850683/1289275

const TYPE_STANDARD = {
  "application/x-javascript": "text/javascript",
}

const JUNK_DIRS = new Set(["__MACOSX", "@eaDir"])
const JUNK_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"])

export async function readDirectoryEntry(
  entry,
  { files = {}, folders = [] } = {},
  options,
) {
  const reader = entry.createReader()

  const undones = []

  await new Promise((resolve, reject) => {
    let folderLength = 0
    const read = () => {
      reader.readEntries((entries) => {
        if (entries.length > 0) {
          folderLength += entries.length
          for (const entry of entries) {
            if (entry.isDirectory) {
              if (JUNK_DIRS.has(entry.name)) continue
              undones.push(readDirectoryEntry(entry, { files, folders }))
            } else {
              if (JUNK_FILES.has(entry.name)) continue
              undones.push(
                new Promise((resolve, reject) => {
                  entry.file(resolve, reject)
                }).then((file) => {
                  files[entry.fullPath.slice(1)] = file
                }),
              )
            }
          }
          read() // read the next batch [1]
        } else {
          if (folderLength === 0 || options?.allFolders === true) {
            folders.push(entry.fullPath.slice(1) + "/")
          }
          resolve()
        }
      }, reject)
    }

    read()
  })

  await Promise.all(undones)

  return { files, folders }
}

function normalizeDataTransferItem(item, dataTransfer) {
  const { kind, type } = item

  const out = {
    kind,
    type: TYPE_STANDARD[type] ?? type,
  }

  if (kind === "file") {
    out.file = item.getAsFile?.() || undefined
    out.entry = item.getAsEntry?.() || item.webkitGetAsEntry?.() || undefined
    if (out.entry?.isDirectory) out.kind = "directory"
  } else if (kind === "string") {
    out.string = dataTransfer.getData(type)
    if (type.endsWith("json")) {
      try {
        out.object = JSON.parse(out.string)
      } catch {}
    }
  }

  return out
}

/**
 * @param {DataTransfer | ClipboardEvent | DragEvent} e
 * @param {{ fileSystemHandle: any; }} [options]
 * @returns {DataTransfertImport}
 */
export function dataTransfertImport(e, options) {
  let dataTransfer
  let x
  let y

  if (isInstanceOf(e, ClipboardEvent)) {
    e.preventDefault()
    dataTransfer = e.clipboardData
  } else if (isInstanceOf(e, DragEvent)) {
    e.preventDefault()
    dataTransfer = e.dataTransfer
    x = e.x
    y = e.y
  } else {
    dataTransfer = e
  }

  if (!isInstanceOf(dataTransfer, DataTransfer)) {
    throw new TypeError(`dataTransfer argument must be a DataTransfer instance`)
  }

  // handleEffect(e, options)

  const out = {
    files: {},
    folders: [],
    strings: [],
    objects: [],
    json: undefined,
    effect: dataTransfer.dropEffect,
    x,
    y,

    undones: [],
    then(resolve, reject) {
      Promise.all(out.undones).then(() => {
        out.undones.length = 0
        delete out.undones
        delete out.then
        resolve(out)
      }, reject)
    },
  }

  for (const dataItem of dataTransfer.items) {
    const item = normalizeDataTransferItem(dataItem, dataTransfer)
    if (item.kind === "string") {
      if (item.type === "application/json") {
        out.json = item.object
      } else if (item.object) {
        out.objects.push(item.object)
      } else {
        out.strings.push(item.string)
      }
    } else if (item.kind === "file") {
      out.files[item.file.name] = item.file
    } else if (item.kind === "directory") {
      out.undones.push(readDirectoryEntry(item.entry, out))
    }

    if (
      options?.fileSystemHandle &&
      item.entry &&
      "getAsFileSystemHandle" in dataItem
    ) {
      out.undones.push(
        item.getAsFileSystemHandle().then((res) => {
          out.fileSystemHandle = res
        }),
      )
    }
  }

  return out
}
