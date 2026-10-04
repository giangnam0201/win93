import { isInstanceOf } from "../type/any/isInstanceOf.js"

/**
 * @overload
 * @param {EventTarget} target
 * @param {string} type
 * @param {CustomEventInit} [init]
 * @returns {CustomEvent}
 */
/**
 * @overload
 * @param {EventTarget} target
 * @param {Error} type
 * @param {ErrorEventInit} [init]
 * @returns {ErrorEvent}
 */
/**
 * Dispatches a synthetic `CustomEvent` to `target`.
 * If `type` is an error dispatches an `ErrorEvent`.
 *
 * @template {string | Error} T
 * @param {EventTarget} target
 * @param {T} type
 * @param {T extends Error ? ErrorEventInit : CustomEventInit} [init]
 * @returns {ErrorEvent | CustomEvent}
 */
export function dispatch(target, type, init) {
  if (isInstanceOf(type, Error)) {
    const error = type
    const event = new ErrorEvent("error", {
      bubbles: true,
      cancelable: true,
      message: error.message,
      error,
      ...init,
    })
    target.dispatchEvent(event)
    return event
  }

  const event = new CustomEvent(type, { bubbles: true, ...init })
  target.dispatchEvent(event)
  return event
}
