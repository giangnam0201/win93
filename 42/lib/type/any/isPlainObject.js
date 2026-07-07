/**
 * @param {any} val
 * @returns {boolean}
 */
export function isPlainObject(val) {
  return (
    val !== null &&
    typeof val === "object" &&
    val.constructor?.name === "Object"
  )
}
