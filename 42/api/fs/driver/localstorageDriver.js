import { BrowserDriver } from "../class/BrowserDriver.js"
import { base64 } from "../../../lib/type/binary/base64.js"

class LocalStorageDriver extends BrowserDriver {
  mask = 0x12
  store = {
    has(id) {
      return localStorage.getItem(id) !== null
    },
    async set(id, data) {
      data =
        data.type === "application/octet-stream"
          ? `42_BASE64:${base64.fromArrayBuffer(await data.arrayBuffer())}`
          : await data.text()
      localStorage.setItem(id, data)
    },
    get(id) {
      const data = localStorage.getItem(id)
      if (data === null) return
      return new Blob(
        data.startsWith("42_BASE64:")
          ? [base64.toArrayBuffer(data.slice(10))]
          : [data],
      )
    },
    delete(id) {
      return localStorage.removeItem(id)
    },
  }
}

export const driver = (...args) => new LocalStorageDriver(...args).init()
