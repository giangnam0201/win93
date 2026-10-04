/**
 * @param {any} val
 * @returns {boolean}
 */
export function isPrimitive(val) {
  if (val === null) return true
  const type = typeof val
  return type !== "object" && type !== "function"
}
