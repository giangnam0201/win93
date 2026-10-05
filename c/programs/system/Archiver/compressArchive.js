import { runArchive } from "./runArchive.js"

/** Writable archive formats in the bundled JS7z 2.5 runtime. */
export const compressionFormats = [
  { label: "GZip", extension: "tar.gz", type: "gzip" },
  { label: "ZIP", extension: "zip", type: "zip" },
  { label: "7z", extension: "7z", type: "7z" },
  { label: "XZ", extension: "tar.xz", type: "xz" },
  { label: "BZip2", extension: "tar.bz2", type: "bzip2" },
  // { label: "TAR", extension: "tar", type: "tar" },
  // { label: "WIM", extension: "wim", type: "wim" },
]

/**
 * @typedef {{path: string, directory?: boolean, data?: Uint8Array}} ArchiveEntry
 */

/**
 * @param {ArchiveEntry[]} entries
 * @param {string} extension
 * @returns {Promise<Uint8Array>}
 */
export async function compressArchive(entries, extension) {
  const format = compressionFormats.find((item) => item.extension === extension)
  if (!format) throw new Error(`Unsupported compression format: ${extension}`)
  if (format.extension.startsWith("tar.")) {
    entries = [
      { path: "archive.tar", data: await compressArchive(entries, "tar") },
    ]
  }
  const output = `/out/archive.${extension}`
  return runArchive(
    ["a", `-t${format.type}`, "-y", output, "--", "."],
    (FS) => {
      FS.mkdir("/in")
      FS.mkdir("/out")
      const paths = new Set()
      for (const entry of entries) {
        if (
          entry.path
            .split("/")
            .some((part) => !part || part === "." || part === "..") ||
          /[\\:\0]/u.test(entry.path) ||
          paths.has(entry.path)
        ) {
          throw new Error(`Invalid or duplicate archive path: ${entry.path}`)
        }
        paths.add(entry.path)
        const path = `/in/${entry.path}`
        FS.mkdirTree(
          entry.directory ? path : path.slice(0, path.lastIndexOf("/")),
        )
        if (!entry.directory) FS.writeFile(path, entry.data)
      }
      FS.chdir("/in")
    },
    (FS) => FS.readFile(output),
  )
}
