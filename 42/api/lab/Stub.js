/* eslint-disable unicorn/no-this-assignment */
// @thanks https://github.com/jamiebuilds/ninos

import { Callable } from "../../lib/class/Callable.js"
import { Emittable } from "../../lib/class/mixin/Emittable.js"
import { noop } from "../../lib/type/function/noop.js"

export class Stub extends Emittable(Callable) {
  /**
   * @param {Function} [fn]
   * @param {*} [thisArg]
   */
  constructor(fn = noop, thisArg) {
    super(function (...args) {
      const call = { args }
      stub.calls.push(call)

      const that = thisArg === false ? this : (thisArg ?? this)
      if (thisArg !== false && that !== undefined) call.this = that

      try {
        const result = fn.call(that, ...args)
        if (result !== undefined) call.return = result
        stub.emit("call", call)
        return result
      } catch (err) {
        call.throw = err
        stub.emit("call", call)
        throw err
      }
    }, fn.name)

    const stub = this
    Object.defineProperty(this, "length", { value: fn.length })

    this.originalFn = fn
    this.calls = []
  }

  get count() {
    return this.calls.length
  }

  /**
   * Returns a Promise that resolves when the stub was called at least `n` times.
   *
   * @param {number} [n]
   */
  async untilCalled(n = 1) {
    return new Promise((resolve) => {
      const off = this.on("call", { off: true }, () => {
        if (this.calls.length >= n) {
          resolve()
          off()
        }
      })
    })
  }

  destroy() {
    this.off("*")
    this.calls.length = 0
    this.originalFn = undefined
  }

  toString() {
    return this.originalFn.toString()
  }
}
