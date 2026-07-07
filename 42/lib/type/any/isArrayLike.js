import { isLength } from "./isLength.js"

/**
 * @param {any} val
 * @returns {va is ArrayLike}
 */
export function isArrayLike(val) {
  return val != null && typeof val !== "function" && isLength(val.length)
}
