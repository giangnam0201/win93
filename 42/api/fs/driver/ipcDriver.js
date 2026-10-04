import { BrowserDriver } from "../class/BrowserDriver.js"
import { ipc } from "../../ipc.js"

class IPCDriver extends BrowserDriver {
  async getURL(filename, options) {
    const objectURL = await ipc.ask("IPCDriver", {
      type: "getURL",
      args: [filename],
    })

    if (objectURL.startsWith("blob:")) {
      options?.signal.addEventListener("abort", () => {
        URL.revokeObjectURL(objectURL)
      })
    }

    return objectURL
  }
}

const ignore = new Set(["constructor", "init", "getURL"])

for (const key of Reflect.ownKeys(BrowserDriver.prototype)) {
  if (ignore.has(key)) continue
  IPCDriver.prototype[key] = async (...args) =>
    ipc.ask("IPCDriver", { type: key, args })
}

export const driver = (...args) => new IPCDriver(...args).init()
