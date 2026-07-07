import { Database } from "../../api/db/Database.js"
import { configure } from "../../api/configure.js"
import { defer } from "../type/promise/defer.js"
import { Locator } from "./Locator.js"

const DEFAULTS = {
  name: "storable",
  delimiter: ".",
}

export class Storable extends Locator {
  constructor(value, options) {
    super(value, options)
    this.config = configure(DEFAULTS, options)

    this.ready = defer()

    this.store = new Database({
      ...this.config,
      // version: Date.now(),
      populate: async () => {
        await this.populate()
      },
    }).stores.store
  }

  async populate() {
    const value =
      typeof this.config.populate === "function"
        ? await this.config.populate()
        : this.value

    this.store.set("value", value)
    this.value = value
  }

  async init() {
    await this.store

    const prev = await this.store.get("value")
    if (prev) this.value = prev

    this.ready.resolve()
  }

  async set(path, value) {
    super.set(path, value)
    await this.store.set("value", this.value)
  }

  async delete(path) {
    super.delete(path)
    await this.store.set("value", this.value)
  }

  async clear() {
    super.clear()
    await this.store.delete("value")
  }
}
