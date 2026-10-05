import { BrowserDriver } from "../class/BrowserDriver.js"
import { FileSystemError } from "../FileSystemError.js"
import { uid } from "../../uid.js"
import { getBasename } from "../../../lib/syntax/path/getBasename.js"
import { getMimetype } from "../../../lib/syntax/path/getMimetype.js"
import { setFileRelativePath } from "../../io/setFileRelativePath.js"

const STORE_DIRNAME = ".sys42-fs"
const { ENOENT, EISDIR } = FileSystemError

class OpfsDriver extends BrowserDriver {
  mask = 0x14
  #directory

  async init() {
    if (
      !globalThis.navigator?.storage?.getDirectory ||
      !globalThis.FileSystemFileHandle?.prototype.createWritable
    ) {
      if (this.getDriver) return this.getDriver("indexeddb")
      const { getDriverLazy } = await import("../getDriverLazy.js")
      return getDriverLazy("indexeddb")
    }

    const root = await globalThis.navigator.storage.getDirectory()
    const storeDir = await root.getDirectoryHandle(STORE_DIRNAME, {
      create: true,
    })
    this.#directory = storeDir

    // Resolve each entry again: another realm can remove or replace a file.
    const getHandle = (id, options) =>
      storeDir.getFileHandle(String(id), options)

    this.store = {
      has: async (id) => {
        try {
          await getHandle(id)
          return true
        } catch (err) {
          if (err?.name === "NotFoundError") return false
          throw err
        }
      },
      get: async (id) => {
        try {
          const handle = await getHandle(id)
          return handle.getFile()
        } catch (err) {
          if (err?.name === "NotFoundError") return
          throw err
        }
      },
      set: async (id, data) => {
        const handle = await getHandle(id, { create: true })
        const writable = await handle.createWritable()
        try {
          await writable.write(data)
          await writable.close()
        } catch (err) {
          await writable.abort(err).catch(() => {})
          throw err
        }
      },
      delete: async (id) => {
        try {
          await storeDir.removeEntry(String(id))
        } catch (err) {
          if (err?.name !== "NotFoundError") throw err
        }
      },
    }

    return super.init()
  }

  async open(filename) {
    const blob = await super.open(filename)
    const basename = getBasename(filename)
    const file = new File([blob], basename, {
      type: blob.type || getMimetype(basename),
      lastModified: blob.lastModified,
    })
    setFileRelativePath(file, filename)
    return file
  }

  async write(filename, data) {
    // Keep the same BlobPart conversion as the other browser drivers.
    const blob = new Blob([data])
    const writable = await this.sink(filename)
    const writer = writable.getWriter()
    await writer.write(blob)
    await writer.close()
  }

  async append(filename, data) {
    const blob = new Blob([data])
    const writable = await this.#sink(filename, true)
    const writer = writable.getWriter()
    await writer.write(blob)
    await writer.close()
  }

  async sink(filename) {
    return this.#sink(filename)
  }

  async #sink(filename, append = false) {
    const index = this.fileIndex
    if (index.isDir(filename)) throw new FileSystemError(EISDIR, filename)
    if (append && !index.has(filename)) {
      throw new FileSystemError(ENOENT, filename)
    }

    const previous = index.get(filename)
    const own = Array.isArray(previous) && previous[1] === this.mask
    const id = own ? previous[0] : uid()
    const previousDriver =
      !own && Array.isArray(previous)
        ? await this.getDriver(previous[1])
        : undefined
    // For links, fetched files, and other drivers, materialize the old content.
    const initial = append && !own ? await this.open(filename) : undefined
    let writable
    const discard = async (reason) => {
      await writable?.abort(reason).catch(() => {})
      if (!own) await this.store.delete(id)
    }

    try {
      const handle = await this.#directory.getFileHandle(String(id), {
        create: !append || !own,
      })
      writable = await handle.createWritable({
        keepExistingData: append && own,
      })
      if (append && own) {
        const file = await handle.getFile()
        await writable.seek(file.size)
      } else if (initial) {
        await writable.write(initial)
      }
    } catch (err) {
      await discard(err)
      if (err?.name === "NotFoundError") {
        throw new FileSystemError(ENOENT, filename)
      }
      throw err
    }

    return new WritableStream({
      write: async (chunk) => {
        try {
          await writable.write(chunk)
        } catch (err) {
          await discard(err)
          throw err
        }
      },
      close: async () => {
        try {
          await writable.close()
        } catch (err) {
          await discard(err)
          throw err
        }

        const time = Date.now()
        const metadata = Array.isArray(previous)
          ? { ...previous[2], c: time, m: time }
          : { b: time, a: time, c: time, m: time }
        await index.set(filename, [id, this.mask, metadata])
        if (previousDriver) await previousDriver.store.delete(previous[0])
      },
      abort: discard,
    })
  }
}

export const driver = (...args) => new OpfsDriver(...args).init()
