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
    if (prev !== undefined && prev !== null) this.value = prev
    else await this.populate()

    this.ready.resolve()
  }

  #pending
  #writing

  #queueSave(remove = false) {
    if (!this.#pending) {
      this.#pending = { promise: defer(), remove }
      if (!this.#writing) queueMicrotask(() => this.#writePending())
    }
    this.#pending.remove = remove
    return this.#pending.promise
  }

  async #writePending() {
    const { promise, remove } = this.#pending
    this.#pending = undefined
    this.#writing = promise

    try {
      // Coalesce mutations while a transaction is in flight; resolve only on commit.
      await (remove
        ? this.store.delete("value")
        : this.store.set("value", this.value))
      promise.resolve()
    } catch (err) {
      promise.reject(err)
    } finally {
      this.#writing = undefined
      if (this.#pending) this.#writePending()
    }
  }

  /** @returns {Promise<void>} */
  save() {
    return this.#queueSave()
  }

  /**
   * Wait for mutations queued before this call to reach storage.
   * @returns {Promise<void>}
   */
  async flush() {
    await (this.#pending?.promise ?? this.#writing)
  }

  async set(path, value) {
    super.set(path, value)
    await this.save()
  }

  async delete(path) {
    super.delete(path)
    await this.save()
  }

  async clear() {
    super.clear()
    await this.#queueSave(true)
  }
}
