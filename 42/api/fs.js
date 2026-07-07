import { normalizeFilename } from "./fs/normalizeFilename.js"
// import { getDriverThread } from "./fs/getDriverThread.js"
import { getDriverLazy } from "./fs/getDriverLazy.js"
import { removeItem } from "../lib/type/array/removeItem.js"
import { defer } from "../lib/type/promise/defer.js"
import { JSON5 } from "../formats/data/JSON5.js"
import { CBOR } from "../formats/data/CBOR.js"
import { encodePath } from "./encodePath.js"
import { configure } from "./configure.js"
import { isInstanceOf } from "../lib/type/any/isInstanceOf.js"
import { Emitter } from "../lib/class/Emitter.js"

/** @import { FileIndex } from "./fs/FileIndex.js" */

const DEFAULTS = {
  // places: { "/": "opfs" },
  places: { "/": "indexeddb" },
  // places: { "/": "localstorage" },
  // places: { "/": "memory" },
}

// TODO: https://web.dev/storage-foundation/
// TODO: https://web.dev/file-system-access/
// TODO: https://emscripten.org/docs/api_reference/Filesystem-API.html#id2

// @read https://web.dev/persistent-storage/

const UTF8 = "utf-8"

export class FileSystem extends Emitter {
  /** @type {FileIndex} */
  fileIndex

  constructor(options) {
    super()
    this.config = configure(DEFAULTS, options)
    this.mount()
  }

  #queue = new Map()
  async #enqueue(filename) {
    const deferred = defer()

    deferred.finally(() => {
      const stack = this.#queue.get(filename)
      removeItem(stack, deferred)
      if (stack.length === 0) this.#queue.delete(filename)
    })

    if (this.#queue.has(filename)) {
      const stack = this.#queue.get(filename)
      const previous = stack.pop()
      stack.push(deferred)
      this.#queue.set(filename, stack)
      await previous
    } else {
      this.#queue.set(filename, [deferred])
    }

    return deferred.resolve
  }

  #mountPlace(place, driverName, options = {}) {
    driverName = driverName.toLowerCase()
    if (!place.startsWith("/")) place = `/${place}`
    if (!place.endsWith("/")) place = `${place}/`
    if (options.force || place in this.config.places === false) {
      this.config.places[place] = driverName
    } else {
      throw new Error(
        `'${place}' is already mounted with '${this.config.places[place]}'`,
      )
    }
  }

  async #findDriver(path, options) {
    this.fileIndex ??= await import("./fileIndex.js") //
      .then(({ fileIndex }) => fileIndex)
    const filename = normalizeFilename(path, options)

    const place = this.places.find((item) => filename.startsWith(item))
    if (place in this.config.places === false) {
      throw new Error(`no driver mounted for '${filename}'`)
    }

    const name = this.config.places[place]

    // const driver = await getDriverThread(name)
    const driver = await getDriverLazy(name)
    return { filename, driver }
  }

  mount(place, driverName, options) {
    const type = typeof place

    if (type === "object") {
      options = driverName
      for (const [key, val] of Object.entries(place)) {
        this.#mountPlace(key, val, options)
      }
    } else if (type === "string") {
      this.#mountPlace(place, driverName, options)
    }

    this.places = Object.keys(this.config.places).sort(
      (a, b) => b.length - a.length,
    )
  }

  /* check
  ======== */

  async access(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    return driver.access(filename, ...args)
  }

  async getURL(path, ...args) {
    const url = isInstanceOf(path, URL)
      ? path
      : new URL(encodePath(path), location.origin)

    if (
      url.origin !== location.origin || //
      url.protocol !== location.protocol
    ) {
      return path
    }

    try {
      path = decodeURIComponent(url.pathname)
    } catch {
      path = url.pathname
    }

    const { driver, filename } = await this.#findDriver(path)
    return driver.getURL(filename, ...args)
  }

  async isFile(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    return driver.isFile(filename, ...args)
  }

  async isDir(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    return driver.isDir(filename, ...args)
  }

  async isLink(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    return driver.isLink(filename, ...args)
  }

  async link(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    await driver.link(filename, ...args)
  }

  /* file
  ======= */

  async open(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    return driver.open(filename, ...args)
  }

  async read(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    return driver.read(filename, ...args)
  }

  async write(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    const resolve = await this.#enqueue(path)
    await driver.write(filename, ...args).finally(resolve)
  }

  async append(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    const resolve = await this.#enqueue(path)
    await driver.append(filename, ...args).finally(resolve)
  }

  async delete(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    await driver.delete(filename, ...args)
  }

  /* dir
  ====== */

  async writeDir(path) {
    const { driver, filename } = await this.#findDriver(path)
    await driver.writeDir(filename)
  }

  async readDir(path, ...args) {
    const { driver, filename } = await this.#findDriver(path)
    return driver.readDir(filename, ...args)
  }

  async deleteDir(path) {
    const { driver, filename } = await this.#findDriver(path)
    await driver.deleteDir(filename)
  }

  /* stream
  ========= */

  sink(path, options) {
    let writer

    return new WritableStream(
      {
        write: async (chunk) => {
          if (!writer) {
            const { driver, filename } = await this.#findDriver(path)
            const writable = await driver.sink(filename, options)
            writer = writable.getWriter()
          }

          await writer.write(chunk)
        },
        close: async () => {
          await writer?.close()
        },
        abort: async (reason) => {
          await writer?.abort(reason)
        },
      },
      options?.queuingStrategy,
    )
  }

  source(path, options) {
    let iterator
    let emptyQueue = true

    return new ReadableStream(
      {
        pull: async (controller) => {
          if (!iterator) {
            const { driver, filename } = await this.#findDriver(path)
            try {
              const readable = await driver.source(filename, options)
              iterator = readable[Symbol.asyncIterator]()
            } catch (err) {
              controller.error(err)
              return
            }
          }

          const { value, done } = await iterator.next()

          if (done) {
            if (emptyQueue) controller.enqueue(new Uint8Array(0))
            controller.close()
            iterator = undefined
          } else {
            emptyQueue = false
            controller.enqueue(value)
          }
        },
      },
      options?.queuingStrategy,
    )
  }

  async copy(from, to, options) {
    from = normalizeFilename(from)
    to = normalizeFilename(to)

    this.fileIndex ??= await import("./fileIndex.js") //
      .then(({ fileIndex }) => fileIndex)

    const type = options?.delete ? "move" : "copy"

    const inode = this.fileIndex.get(from)
    if (inode === 0 || typeof inode === "string") {
      if (options?.delete) this.fileIndex.move(from, to)
      else this.fileIndex.copy(from, to)
      if (!options?.silent) this.emit(type, from, to)
      return
    }

    if (await this.isDir(from)) {
      const undones = []
      const files = await this.readDir(from, { recursive: true })

      const subOptions = { ...options, silent: true }

      if (files.length === 0) {
        this.writeDir(to)
      } else {
        for (const path of files) {
          undones.push(
            this.copy(`${from}/${path}`, `${to}/${path}`, subOptions),
          )
        }
      }

      await Promise.all(undones)

      if (options?.delete) await this.deleteDir(from)
      if (!options?.silent) this.emit(type, from, to)
      return
    }

    let rs = this.source(from, options)
    if (options?.progress) rs = rs.pipeThrough(options?.progress())
    await rs.pipeTo(this.sink(to, options))

    if (options?.delete) await this.delete(from)
    if (!options?.silent) this.emit(type, from, to)
  }

  // TODO debug moving a folder
  async move(from, to, options) {
    from = normalizeFilename(from)
    to = normalizeFilename(to)

    if (to.startsWith(from)) {
      if (to === from) return
      throw new Error("A folder cannot be moved into itself")
    }

    return this.copy(from, to, { ...options, delete: true })
  }

  /* sugar
  ======== */

  async writeText(path, value, encoding = UTF8) {
    return this.write(path, value, encoding)
  }

  async readText(path, encoding = UTF8) {
    return this.read(path, encoding)
  }

  async writeJSON(path, value, replacer, space = 2) {
    return this.write(path, JSON.stringify(value, replacer, space) ?? "", UTF8) //
  }

  async readJSON(path, options) {
    if (options?.strict) {
      return this.read(path, UTF8).then((value) => JSON.parse(value))
    }

    return this.read(path, UTF8).then((value) => JSON5.parse(value))
  }

  async readJSON5(path) {
    return this.read(path, UTF8).then((value) => JSON5.parse(value))
  }

  async writeJSON5(path, value, options) {
    let previous

    if (value === undefined) return this.write(path, "", UTF8)

    try {
      previous = await this.read(path, UTF8)
    } catch {}

    if (previous) {
      try {
        return this.write(path, JSON5.patch(previous, value), UTF8)
      } catch {}
    }

    return this.write(path, JSON5.stringify(value, options), UTF8)
  }

  async writeCBOR(path, value) {
    // @read https://github.com/cbor-wg/cbor-magic-number
    return this.write(path, CBOR.encode(value))
  }

  async readCBOR(path) {
    return this.read(path).then((value) => CBOR.decode(value))
  }
}

export const fs = new FileSystem()
