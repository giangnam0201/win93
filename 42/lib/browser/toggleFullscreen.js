import { ensureElement } from "../type/element/ensureElement.js"
import { noop } from "../type/function/noop.js"

/**
 * @param {string | HTMLElement} [el]
 * @param {boolean} [force]
 */
export async function toggleFullscreen(el = document.documentElement, force) {
  el = ensureElement(el)

  const document = el.ownerDocument

  if (!document.fullscreenEnabled) return false

  if (
    force === false ||
    (force !== true && document.fullscreenElement === el)
  ) {
    await document.exitFullscreen().catch(noop)
    return false
  }

  await el.requestFullscreen({ navigationUI: "hide" }).catch(noop)
  return document.fullscreenElement === el
}
