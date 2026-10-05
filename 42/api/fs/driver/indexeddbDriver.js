import { BrowserDriver } from "../class/BrowserDriver.js"
import { Database } from "../../db/Database.js"

const db = new Database("fs")

class IndexedDBDriver extends BrowserDriver {
  mask = 0x13
  store = db.store
}

export const driver = (...args) => new IndexedDBDriver(...args).init()
