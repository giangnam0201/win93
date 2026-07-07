/**
 * @thanks https://stackoverflow.com/a/32538867
 * ---
 * @param {any} val
 * @returns {val is Iterable}
 */
export function isIterable(val) {
  return val && typeof val[Symbol.iterator] === "function"
}
