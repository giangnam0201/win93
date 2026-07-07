import { getDirname } from "../../../lib/syntax/path/getDirname.js"
import { resolvePath } from "../../../lib/syntax/path/resolvePath.js"
import { FileSystemError } from "../FileSystemError.js"
import { isInstanceOf } from "../../../lib/type/any/isInstanceOf.js"
import { loadArrayBuffer } from "../../load/loadArrayBuffer.js"

export class EmscriptenFS {
  constructor(FS) {
    this.FS = FS
    for (const key of Object.keys(FS)) {
      if (key in this === false) {
        Object.defineProperty(this, key, { get: () => FS[key] })
      }
    }
  }

  write(path, data) {
    path = resolvePath(path)
    const dirname = getDirname(path)
    this.writeDir(dirname)
    this.FS.writeFile(path, data)
  }

  writeDir(path) {
    path = resolvePath(path)
    const parts = path.split("/")
    let current = "/"
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].trim()) continue
      current += parts[i] + "/"
      try {
        this.FS.mkdir(current)
      } catch {}
    }
  }

  readDir(path) {
    path = resolvePath(path)
    try {
      return this.FS.readdir(path).slice(2)
    } catch {
      throw new FileSystemError(FileSystemError.ENOENT)
    }
  }

  async ensureFile(filename, urlOrBuffer, options) {
    if (this.FS.analyzePath(filename).exists) {
      console.debug(`${filename} exists in Emscripten file system.`)
      return filename
    }

    let uint8Array
    if (typeof urlOrBuffer === "string") {
      console.debug(`Downloading ${filename}`)
      uint8Array = new Uint8Array(await loadArrayBuffer(urlOrBuffer))
    } else if (isInstanceOf(urlOrBuffer, ArrayBuffer)) {
      uint8Array = new Uint8Array(urlOrBuffer)
    } else {
      uint8Array = urlOrBuffer
    }

    this.write(filename, uint8Array)

    if (options?.sync === true) await this.syncfs(false)

    return filename
  }

  async syncfs(populate) {
    return new Promise((resolve, reject) => {
      this.FS.syncfs(populate, (err) => {
        if (err) {
          console.error("Error synchronizing to indexeddb.", err)
          reject(err)
        } else {
          console.debug(`Synchronized to indexeddb.`)
          resolve()
        }
      })
    })
  }
}
