import { runArchive } from "./runArchive.js"

function readEntries(FS, directory = "/out", relative = "", entries = []) {
  for (const name of FS.readdir(directory)) {
    if (name === "." || name === "..") continue
    if (/[\\/:]/u.test(name) || name.includes("\0")) {
      throw new Error(`Unsafe archive entry: ${name}`)
    }
    const source = `${directory}/${name}`
    const path = relative ? `${relative}/${name}` : name
    const { mode } = FS.lstat(source)
    if (FS.isDir(mode)) {
      entries.push({ path, directory: true })
      readEntries(FS, source, path, entries)
    } else if (FS.isFile(mode)) {
      entries.push({ path, data: FS.readFile(source) })
    } else {
      throw new Error(
        `Unsupported archive entry (link or special file): ${path}`,
      )
    }
  }
  return entries
}

/**
 * Extract into an isolated filesystem and copy the results before JS7z exits.
 * Each command needs a fresh runtime, including after a failed extraction.
 * @param {Uint8Array} data
 * @param {string} name
 * @returns {Promise<Array<{path: string, directory?: boolean, data?: Uint8Array}>>}
 */
export async function extractArchive(data, name) {
  const filename = name.replaceAll(/[\\/]/gu, "_").replaceAll("\0", "_")
  const entries = await runArchive(
    ["x", "-y", "-o/out", "--", `/in/${filename}`],
    (FS) => {
      FS.mkdir("/in")
      FS.mkdir("/out")
      FS.writeFile(`/in/${filename}`, data)
    },
    (FS) => readEntries(FS),
  )
  // JS7z unwraps stream compression separately from its inner TAR archive.
  if (
    /\.(?:gz|gzip|bz2|bzip2|xz|zst|z|tgz|tpz|tbz2?|txz|tzst|taz)$/iu.test(
      name,
    ) &&
    entries.length === 1 &&
    !entries[0].directory &&
    /\.tar$/iu.test(entries[0].path)
  ) {
    return extractArchive(entries[0].data, entries[0].path)
  }
  return entries
}
