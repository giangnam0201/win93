import { fs } from "/42/api/fs.js"
import { fileIndex } from "/42/api/fileIndex.js"
import { incrementFilename } from "/42/api/fs/incrementFilename.js"
import { getBasename } from "/42/lib/syntax/path/getBasename.js"
import { joinPath } from "/42/lib/syntax/path/joinPath.js"

/** @param {string} name */
export function getArchiveBasename(name) {
  return getBasename(name).replace(/(?:\.tar)?\.[^.]+$/iu, "") || "Archive"
}

/**
 * @param {string[]} selection
 * @returns {Promise<import("./compressArchive.js").ArchiveEntry[]>}
 */
export async function readSelection(selection) {
  const entries = []
  async function read(path, relative) {
    if (fileIndex.isDir(path) || path.endsWith("/")) {
      entries.push({ path: relative, directory: true })
      for (const child of await fs.readDir(path, { absolute: true })) {
        await read(child, `${relative}/${getBasename(child)}`)
      }
    } else {
      const file = await fs.open(path)
      entries.push({
        path: relative,
        data: new Uint8Array(await file.arrayBuffer()),
      })
    }
  }
  for (const path of selection) {
    // A selected folder already includes its selected descendants.
    if (
      selection.some(
        (parent) =>
          parent !== path && parent.endsWith("/") && path.startsWith(parent),
      )
    ) {
      continue
    }
    await read(path, getBasename(path))
  }
  return entries
}

/**
 * Preserve the archive's sole root folder, otherwise use its basename.
 * @param {import("./compressArchive.js").ArchiveEntry[]} entries
 * @param {string} name
 * @param {string} parent
 * @returns {{destination: string, entries: import("./compressArchive.js").ArchiveEntry[]}}
 */
export function planExtraction(entries, name, parent) {
  const roots = entries.filter((entry) => !entry.path.includes("/"))
  const root =
    roots.length === 1 && roots[0].directory ? roots[0].path : undefined
  const destination = incrementFilename(
    joinPath(parent, root ?? getArchiveBasename(name)),
    { normalize: false },
  )
  return {
    destination,
    entries: root
      ? entries
          .filter((entry) => entry.path !== root)
          .map((entry) => ({
            ...entry,
            path: entry.path.slice(root.length + 1),
          }))
      : entries,
  }
}
