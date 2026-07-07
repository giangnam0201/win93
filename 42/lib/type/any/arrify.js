//! Copyright (c) 2014-2017, Sindre Sorhus. MIT License.
// @src https://github.com/sindresorhus/arrify

/**
 * Convert a value to an array.
 * Specifying `null` or `undefined` results in an empty array.
 *
 * @param {any} val
 * @returns {any[]}
 */
export function arrify(val) {
  return val == null
    ? []
    : Array.isArray(val)
      ? val
      : typeof val === "string"
        ? [val]
        : typeof val[Symbol.iterator] === "function"
          ? [...val]
          : [val]
}
