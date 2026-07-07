import { isSerializable } from "./isSerializable.js"

/**
 * @param {any} val
 * @returns {boolean}
 */
export function isProxy(val) {
  if (!val || typeof val !== "object") return false

  if (val[Symbol.for("isProxy")]) return true

  if (isSerializable(val)) {
    try {
      structuredClone(val)
    } catch {
      return true
    }
  }

  return false
}
