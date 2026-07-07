import "./env/polyfill/globalThis.requestIdleCallback.js"
import { fs } from "./fs.js"
import { fileIndex } from "./fileIndex.js"
import { normalizeFilename } from "./fs/normalizeFilename.js"
import { getExtname } from "../lib/syntax/path/getExtname.js"
import { Emitter } from "../lib/class/Emitter.js"

const VALID_TYPES = new Set([".json", ".json5", ".cbor"])

const pending = new Map()

export class Persist extends Emitter {
  ensureType(path) {
    const ext = getExtname(path)

    if (!VALID_TYPES.has(ext)) {
      throw new Error(
        `Data file must have a .json, .json5 or .cbor extension: ${ext}`,
      )
    }

    return ext.slice(1).toUpperCase()
  }

  has(path) {
    return fileIndex.has(normalizeFilename(path))
  }

  getVersion(path) {
    if (this.has(path)) {
      const inode = fileIndex.get(normalizeFilename(path))
      if (!inode) return
      return inode[2]?.m
    }
  }

  async delete(path) {
    return fs.delete(path)
  }

  async get(path) {
    return fs["read" + this.ensureType(path)](path)
  }

  async set(path, data) {
    const type = this.ensureType(path)

    if (pending.size === 0) this.emit("pending")

    if (pending.has(path)) {
      const { id, resolve } = pending.get(path)
      cancelIdleCallback(id)
      resolve(false)
      pending.delete(path)
    }

    return new Promise((resolve, reject) => {
      const fn = async () => {
        try {
          await fs["write" + type](path, data)
          resolve(true)
        } catch (err) {
          this.emit("error", err)
          reject(err)
        }

        pending.delete(path)

        if (pending.size === 0) this.emit("done")
        if (isListening) forgetUnload()
      }

      if (!isListening) listenUnload()

      const id = requestIdleCallback(fn, { timeout: 5000 })
      pending.set(path, { id, resolve, fn })
    })
  }
}

export const persist = new Persist()

const onBeforeUnload = (e) => {
  if (pending.size > 0) {
    console.debug("Pending writes:", pending.keys())
    // force saving
    for (const { id, fn } of pending.values()) {
      cancelIdleCallback(id)
      fn()
    }

    pending.clear()
    if (isListening) forgetUnload()

    e.preventDefault()
    e.returnValue = "Changes you made may not be saved."
    return e.returnValue
  }
}

const options = { capture: true }
let isListening = false

const listenUnload = () => {
  isListening = true
  globalThis.addEventListener("beforeunload", onBeforeUnload, options)
}

const forgetUnload = () => {
  isListening = false
  globalThis.removeEventListener("beforeunload", onBeforeUnload, options)
}
