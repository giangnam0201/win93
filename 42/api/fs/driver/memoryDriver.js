import { BrowserDriver } from "../class/BrowserDriver.js"

class MemoryDriver extends BrowserDriver {
  mask = 0x10
  store = new Map()
}

export const driver = (...args) => new MemoryDriver(...args).init()
