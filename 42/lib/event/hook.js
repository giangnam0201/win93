/**
 * Dispatches events with data and return the modified data.
 *
 * @template {any} T
 * @param {EventTarget} target
 * @param {string} type
 * @param {T} [detail]
 * @returns {T}
 */
export function hook(target, type, detail) {
  const event = new CustomEvent(type, { bubbles: true, detail })
  target.dispatchEvent(event)
  return event.detail
}
