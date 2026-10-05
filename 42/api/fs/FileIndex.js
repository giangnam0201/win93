/* eslint-disable unicorn/no-this-assignment */
import { FileLocator } from "./FileLocator.js"
import { merge } from "../../lib/type/object/merge.js"
// import { ipc } from "../ipc.js"
// import { inDesktopRealm } from "../env/realm/inDesktopRealm.js"
// import { inServiceWorker } from "../env/realm/inServiceWorker.js"

export const FS_DRIVER_MASKS = {
  0x00: "fetch",
  0x10: "memory",
  0x11: "sessionstorage",
  0x12: "localstorage",
  0x13: "indexeddb",
  0x14: "opfs",
}

let fileIndex

export class FileIndex extends FileLocator {
  synced = false

  async init() {
    await super.init()
    // A worker can open the database before the desktop populates it. Recover
    // that partial index while retaining every saved user file descriptor.
    if (this.store && this.config.populate && !this.isDir('/42/') &&
        !this.isDir('/c/users/windows93/desktop/')) {
      const defaults = await this.config.populate({ fresh: true })
      this.value = merge(defaults, this.value)
      await this.save()
    }
  }

  constructor(value, options) {
    if (fileIndex) {
      console.warn("FileIndex already initialized")
      return fileIndex
    }

    super(value, options)
    fileIndex = this
  }
}
