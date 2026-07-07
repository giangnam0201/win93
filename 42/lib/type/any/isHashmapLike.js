/**
 * @typedef {Record<string | symbol, any> & { [Symbol.iterator]?: never; }} HashmapLike
 */

/**
 * @param {any} val
 * @returns {val is HashmapLike}
 */
export function isHashmapLike(val) {
  return (
    val !== null &&
    typeof val === "object" &&
    (val.constructor?.name === "Object" || Object.getPrototypeOf(val) === null)
  )
}
