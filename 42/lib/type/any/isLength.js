const { MAX_SAFE_INTEGER } = Number

/**
 * @thanks https://github.com/lodash/lodash/blob/main/src/isLength.ts
 * ---
 * @param {any} val
 * @returns {boolean}
 */
export function isLength(val) {
  return typeof val === "number" && val >>> 0 === val && val <= MAX_SAFE_INTEGER
}
