import { Emitter } from "../class/Emitter.js"

/** @typedef {false | 0 | "" | null | undefined} Falsy */

const methods = Object.getOwnPropertyNames(Emitter.prototype).filter(
  (key) => key !== "constructor",
)

/**
 * @template {{} | Function} T
 * @param {T} [obj]
 * @param {{ events?: {}; signal?: AbortSignal }} [options]
 * @returns {T & Emitter}
 */
export function emittable(obj, options) {
  // @ts-ignore
  if (!obj) return new Emitter(options)

  Object.defineProperty(obj, Emitter.EVENTS, {
    value: options?.events ?? {},
    configurable: true,
  })

  for (const method of methods) {
    if (method in obj === false) {
      Object.defineProperty(obj, method, {
        value: Emitter.prototype[method],
        configurable: true,
      })
    }
  }

  options?.signal?.addEventListener("abort", () => {
    delete obj[Emitter.EVENTS]
    for (const method of methods) {
      if (obj[method] === Emitter.prototype[method]) delete obj[method]
    }
  })

  // @ts-ignore
  return obj
}

emittable.EVENTS = Emitter.EVENTS
