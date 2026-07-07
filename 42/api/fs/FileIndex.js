/* eslint-disable unicorn/no-this-assignment */
import { FileLocator } from "./FileLocator.js"
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

  constructor(value, options) {
    if (fileIndex) {
      console.warn("FileIndex already initialized")
      return fileIndex
    }

    super(value, options)
    fileIndex = this
  }
}
