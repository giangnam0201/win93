/**
 * @param {any} val
 * @returns {boolean}
 */
export function isObjectOrArray(val) {
  return val !== null && typeof val === "object"
}
