// @ts-nocheck

// @thanks https://stackoverflow.com/a/36871498

/** @template {Function} T */
export class Callable extends Function {
  /**
   * @param {T} fn
   * @param {string} [name]
   * @returns {T}
   */
  constructor(fn, name = fn.name) {
    Object.setPrototypeOf(fn, new.target.prototype)
    if (name) Object.defineProperty(fn, "name", { value: name })
    return fn
  }
}
