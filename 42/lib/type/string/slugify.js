import { deburr } from "./deburr.js"
import { toKebabCase } from "./transform.js"

/**
 * @param {string} str
 * @param {{ preserveUnicode?: boolean; preserveCase?: boolean }} [options]
 * @returns {string}
 */
export function slugify(str, options) {
  str = deburr(str)

  if (options?.preserveUnicode !== false) {
    str = str.replaceAll(/[^\d /A-Za-z]/g, (char) => `-${char.codePointAt(0)} `)
  }

  return options?.preserveCase //
    ? str.trim().replaceAll(/\s/g, "-")
    : toKebabCase(str.trim())
}
