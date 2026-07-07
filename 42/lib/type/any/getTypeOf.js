// @related https://github.com/chaijs/type-detect

/**
 * Returns the input value's generic type.
 * Like the `typeof` operator but with `null` and `array` support.
 *
 * @param {any} val
 * @returns {string}
 */
export function getGenericTypeOf(val) {
  if (val === null) return "null"
  if (Array.isArray(val)) return "array"
  return typeof val
}

/**
 * Returns the input value's type.
 * In lowercase for primitives and titlecase for objects and functions.
 *
 * @param {any} val
 * @returns {string}
 */
export function getTypeOf(val) {
  if (val === null) return "null"
  const type = typeof val
  if (type !== "object" && type !== "function") return type
  return val.constructor?.name || "Object"
}
