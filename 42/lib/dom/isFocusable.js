import { isVisible } from "./isVisible.js"

export function isFocusable(el, options) {
  if (el === window) return true

  if (!el || el.disabled) return false

  if (
    options?.checkIfVisible !== false &&
    (!el.isConnected || !isVisible(el))
  ) {
    return false
  }

  if (el.hasAttribute("data-focusable")) return true

  if (el.tabIndex < 0) return false

  if (
    el.tabIndex > 0 ||
    (el.tabIndex === 0 && el.getAttribute("tabIndex") !== null) ||
    el.getAttribute("contenteditable") === "true"
  ) {
    return true
  }

  // prettier-ignore
  switch (el.localName) {
    case "a": return Boolean(el.href) && el.rel !== "ignore"
    case "input": return el.type !== "hidden"
    case "button":
    case "select":
    case "textarea": return true
    default: return false
  }
}

export function ensureFocusable(el, options) {
  if (isFocusable(el, options)) return el

  const attr = el.getAttribute("tabIndex")
  el.tabIndex = options?.tabIndex ?? 0

  options?.signal.addEventListener("abort", () => {
    if (attr === null) el.removeAttribute("tabIndex")
    else el.tabIndex = attr
  })

  return el
}
