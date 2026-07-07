/**
 * @param {any} val
 * @returns {val is Record<string | symbol, any>}
 */
export function isHashmap(val) {
  return (
    val !== null &&
    typeof val === "object" &&
    Object.getPrototypeOf(val) === null
  )
}
