import { getTypeOf } from "../any/getTypeOf.js"
import { isInstanceOf } from "../any/isInstanceOf.js"

/**
 * Returns an element from the input value if it's an element or a CSS selector for an exsiting element.
 * Throws a `TypeError` otherwise.
 *
 * @param {string | HTMLElement} val
 * @param {HTMLElement} [base]
 * @returns {HTMLElement}
 */
export function ensureElement(val, base = document.documentElement) {
  if (val) {
    if (typeof val === "string") {
      const el = /** @type {HTMLElement} */ (base.querySelector(val))
      if (el !== null) return el
    } else if (isInstanceOf(val, Element)) return val
  }

  throw new TypeError(
    `Input value must be an element or a CSS selector for an exsiting element, got: ${
      typeof val === "string" ? val : getTypeOf(val)
    }`,
  )
}
