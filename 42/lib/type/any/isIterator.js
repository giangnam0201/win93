/** @returns {val is Iterator} */
export function isIterator(val) {
  return (
    val !== null &&
    typeof val === "object" &&
    typeof val.next === "function" &&
    typeof val[Symbol.iterator] === "function" &&
    val[Symbol.iterator]() === val
  )
}
