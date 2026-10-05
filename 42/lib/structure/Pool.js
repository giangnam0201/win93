import { removeItem } from "../type/array/removeItem.js"

/** @template {any} T */
export class Pool {
  list = []
  max = 16
  #current = -1

  /** @returns {any} */
  factory() {}

  /**
   * @param {Function} [factory]
   * @param {{ max: number; signal: AbortSignal }} [options]
   */
  constructor(factory, options) {
    // @ts-ignore
    if (factory) this.factory = factory
    if (options?.max) this.max = options?.max
    options?.signal?.addEventListener("abort", () => this.clear())
  }

  /** @returns {T | Promise<T>} */
  get() {
    this.#current++
    if (this.#current > this.max - 1) this.current = 0

    if (this.#current > this.list.length - 1) {
      const item = this.factory()
      const current = this.#current
      this.list[current] = item

      void (async () => {
        const result = await item
        if (result === item) return
        this.list[current] = result // Always register promise result
      })()
    }

    return this.list[this.#current]
  }

  /** @param {T} item */
  delete(item) {
    removeItem(this.list, item)
  }

  clear() {
    this.list.length = 0
  }
}

export class RecyclePool {
  list = []
  max = 16

  constructor(factory, options) {
    this.factory = factory

    if (options?.max) this.max = options?.max
    options?.signal?.addEventListener("abort", () => this.clear())
  }

  get(options) {
    if (this.list.length === 0) this.list.push(this.factory())
    const item = this.list.pop()
    options?.signal?.addEventListener("abort", () => this.recycle(item))
    return item
  }

  recycle(...items) {
    if (this.list.length + items.length >= this.max) {
      const limit = this.max - this.list.length
      items.splice(0, items.length - limit)
    }

    this.list.push(...items)

    return this
  }

  clear() {
    this.list.length = 0
  }
}
