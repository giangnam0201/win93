import { isInstanceOf } from "./isInstanceOf.js"

/**
 * @param {any} val
 * @returns {val is Error | DOMException | ErrorEvent | PromiseRejectionEvent}
 */
export function isErrorLike(val) {
  return (
    val &&
    typeof val === "object" &&
    (isInstanceOf(val, Error) ||
      isInstanceOf(val, DOMException) ||
      isInstanceOf(val, ErrorEvent) ||
      isInstanceOf(val, PromiseRejectionEvent))
  )
}
