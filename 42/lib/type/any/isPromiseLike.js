/**
 * @param {any} val
 * @returns {val is PromiseLike}
 */
export function isPromiseLike(val) {
  const type = typeof val
  return (
    val !== null &&
    (type === "object" || type === "function") &&
    typeof val.then === "function"
  )
}
