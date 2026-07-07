import "../../env/polyfill/ReadableStream.prototype.values.js"

import { system } from "../../system.js"
import { Driver } from "./Driver.js"
import { FileIndex } from "../FileIndex.js"
import { uid } from "../../uid.js"
import { FileSystemError } from "../FileSystemError.js"
import { getBasename } from "../../../lib/syntax/path/getBasename.js"
import { getMimetype } from "../../../lib/syntax/path/getMimetype.js"
import { setFileRelativePath } from "../../io/setFileRelativePath.js"
import { loadFile } from "../../load/loadFile.js"
import { Bytes } from "../../../lib/class/Bytes.js"

let fileIndex

const { ENOENT, EISDIR, EEXIST, ENOTDIR, ELOOP, EBADF } = FileSystemError

export class BrowserDriver extends Driver {
  constructor(getDriver) {
    super()
    this.getDriver = getDriver
    this.name = this.constructor.name.slice(0, -6).toLowerCase()
  }

  async init() {
    if (system.fileIndex) fileIndex = system.fileIndex
    else {
      fileIndex = new FileIndex()
      await fileIndex.init()
    }

    if (!this.getDriver) {
      const { getDriverLazy } = await import("../getDriverLazy.js")
      this.getDriver = getDriverLazy
    }

    return this
  }

  /* check
  ======== */

  async access(filename) {
    return fileIndex.has(filename)
  }

  async getURL(filename, options) {
    if (!fileIndex.has(filename)) {
      throw new FileSystemError(ENOENT, filename)
    }

    if (navigator.serviceWorker?.controller) return filename

    const inode = fileIndex.get(filename)

    if (inode === 0) return filename

    if (typeof inode === "string") {
      if (filename === inode) {
        throw new FileSystemError(
          ELOOP,
          filename,
          `symbolic link refer to itself`,
        )
      }

      if (
        inode.startsWith("http://") ||
        inode.startsWith("https://") ||
        inode.startsWith("//")
      ) {
        return inode
      }

      return this.getURL(inode)
    }

    const blob = await this.open(filename)
    const objectURL = URL.createObjectURL(blob)

    if (options?.signal) {
      options.signal.addEventListener?.("abort", () =>
        URL.revokeObjectURL(objectURL),
      )
    } else {
      setTimeout(() => URL.revokeObjectURL(objectURL), 4e4) // 40s
    }

    return objectURL
  }

  async isDir(filename) {
    return fileIndex.isDir(filename)
  }
  async isFile(filename) {
    return fileIndex.isFile(filename)
  }
  async isLink(filename) {
    return fileIndex.isLink(filename)
  }

  async link(from, to) {
    return fileIndex.link(from, to)
  }

  /* file
  ======= */

  async open(filename) {
    if (!fileIndex.has(filename)) throw new FileSystemError(ENOENT, filename)
    else if (fileIndex.isDir(filename)) {
      throw new FileSystemError(EISDIR, filename)
    }

    const inode = fileIndex.get(filename)

    let blob

    if (inode === 0) {
      blob = await loadFile(filename, { filename, encodePath: true })
    } else if (typeof inode === "string") {
      if (filename === inode) {
        throw new FileSystemError(EBADF, filename, `File link refer to itself`)
      }

      if (
        inode.startsWith("http://") ||
        inode.startsWith("https://") ||
        inode.startsWith("//")
      ) {
        blob = await loadFile(inode, { filename })
      } else {
        return this.open(inode)
      }
    } else {
      const [id, mask] = inode

      inode[2].a = Date.now()
      fileIndex.set(filename, inode, { silent: true })

      if (this.mask !== mask) {
        const driver = await this.getDriver(mask)
        return driver.open(filename)
      }

      blob = await this.store.get(id)
      if (blob) setFileRelativePath(blob, filename)
    }

    if (blob === undefined) {
      // TODO: remove memoryDriver files from FileIndex on init
      fileIndex.delete(filename, { silent: true })
      throw new FileSystemError(ENOENT, filename)
    }

    return blob
  }

  async read(filename, options) {
    if (typeof options === "string") options = { encoding: options }
    const encoding = options?.encoding
    const blob = await this.open(filename)
    const buf = await blob.arrayBuffer()
    return encoding ? new TextDecoder(encoding).decode(buf) : buf
  }

  async write(filename, data, options) {
    if (fileIndex.isDir(filename)) throw new FileSystemError(EISDIR, filename)

    if (typeof options === "string") options = { encoding: options }

    let id
    let inode = fileIndex.get(filename)

    // // TODO: handle symbolic links
    // if (typeof inode === "string") {
    //   return this.write(normalizeFilename(inode), data, options)
    // }

    if (inode && typeof inode !== "string") {
      id = inode[0]
      const mask = inode[1]

      if (this.mask !== mask) {
        const driver = await this.getDriver(mask)
        driver.delete(filename)
      }

      inode[2].m = Date.now()
      fileIndex.set(filename, inode)
    } else {
      id = uid()
      // @read https://man7.org/linux/man-pages/man7/inode.7.html
      // @read https://www.thegeekdiary.com/unix-linux-access-control-lists-acls-basics/
      const time = Date.now()
      inode = [
        id,
        this.mask,
        {
          b: time, // File creation (birth)
          a: time, // Last access
          c: time, // Last status change
          m: time, // Last modification
        },
      ]
      fileIndex.set(filename, inode)
    }

    const basename = getBasename(filename)
    await this.store.set(
      id,
      new File([data], basename, {
        type: getMimetype(basename),
        lastModified: inode[2].m,
      }),
    )
  }

  async append(filename, data, options) {
    if (!fileIndex.has(filename)) throw new FileSystemError(ENOENT, filename)
    else if (fileIndex.isDir(filename)) {
      throw new FileSystemError(EISDIR, filename)
    }

    if (typeof options === "string") options = { encoding: options }
    const inode = fileIndex.get(filename)
    const id = inode === 0 ? uid() : inode[0]
    const prev = await this.open(filename)

    return this.store.set(id, new Blob([prev, data]))
  }

  async delete(filename) {
    if (!fileIndex.has(filename)) throw new FileSystemError(ENOENT, filename)
    else if (fileIndex.isDir(filename)) {
      throw new FileSystemError(EISDIR, filename)
    }

    const inode = fileIndex.get(filename)

    fileIndex.delete(filename)

    if (inode && typeof inode !== "string") {
      const [id, mask] = inode

      if (this.mask !== mask) {
        const driver = await this.getDriver(mask)
        await driver.delete(filename)
        return
      }

      await this.store.delete(id)
    }
  }

  /* dir
  ====== */

  async writeDir(filename) {
    if (fileIndex.has(filename) && fileIndex.isFile(filename)) {
      throw new FileSystemError(EEXIST, filename)
    }

    fileIndex.set(filename, {})
  }

  async readDir(filename, options) {
    return fileIndex.readDir(filename, options)
  }

  async deleteDir(filename) {
    if (!fileIndex.has(filename)) throw new FileSystemError(ENOENT, filename)
    else if (!fileIndex.isDir(filename)) {
      throw new FileSystemError(ENOTDIR, filename)
    }

    await Promise.all(
      fileIndex
        .readDir(filename, { absolute: true })
        .map((path) =>
          path.endsWith("/") ? this.deleteDir(path) : this.delete(path),
        ),
    )

    fileIndex.delete(filename)
  }

  /* stream
  ========= */

  async sink(filename, options) {
    const buf = new Bytes()
    return new WritableStream({
      write(chunk) {
        buf.write(chunk)
      },
      close: async () => {
        await this.write(filename, buf.value, options)
      },
    })
  }

  async source(filename, options) {
    if (typeof options === "string") options = { encoding: options }

    const blob = await this.open(filename)
    let stream = blob.stream()

    if (options?.encoding) {
      stream = stream.pipeThrough(new TextDecoderStream(options.encoding))
    }

    return stream
  }
}
