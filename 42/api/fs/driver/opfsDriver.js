import { BrowserDriver } from "../class/BrowserDriver.js"

const STORE_DIRNAME = ".sys42-fs"

class OpfsDriver extends BrowserDriver {
  mask = 0x14

  async init() {
    if (!globalThis.navigator?.storage?.getDirectory) {
      if (this.getDriver) return this.getDriver("indexeddb")
      const { getDriverLazy } = await import("../getDriverLazy.js")
      return getDriverLazy("indexeddb")
    }

    const root = await globalThis.navigator.storage.getDirectory()
    const storeDir = await root.getDirectoryHandle(STORE_DIRNAME, {
      create: true,
    })
    const handles = new Map()

    const getHandle = async (id, options) => {
      id = String(id)

      if (options?.create !== true && handles.has(id)) return handles.get(id)

      const handle = await storeDir.getFileHandle(id, options)
      handles.set(id, handle)
      return handle
    }

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
        const writable = await handle.createWritable({ keepExistingData: false })
        await writable.write(data)
        await writable.close()
      },
      delete: async (id) => {
        id = String(id)
        handles.delete(id)

        try {
          await storeDir.removeEntry(id)
        } catch (err) {
          if (err?.name !== "NotFoundError") throw err
        }
      },
    }

    return super.init()
  }
}

export const driver = (...args) => new OpfsDriver(...args).init()
