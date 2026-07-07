/**
 * @typedef {Record<string | symbol, any> & { [Symbol.iterator]?: never; }} ObjectNotArray
 */

/**
 * @param {any} val
 * @returns {val is ObjectNotArray}
 */
export function isObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val)
}
