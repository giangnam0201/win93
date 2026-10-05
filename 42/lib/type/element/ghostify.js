import { appendCSS } from "../../dom/appendCSS.js"
import { ensureElement } from "./ensureElement.js"

const { parseInt } = Number
const { round } = Math

appendCSS(/* css */ `
.ghost,
.ghost * {
  transition: none !important;
  pointer-events: none !important;
}`)

/**
 * @param {string | HTMLElement} el
 * @param {{ rect: any; subpixel?: any; cloneStyles?: any; zIndex?: any; }} options
 */
export function ghostify(el, options) {
  el = ensureElement(el)
  let { x, y, width, height } = options?.rect ?? el.getBoundingClientRect()
  const clone = /** @type {HTMLElement | SVGElement} */ (el.cloneNode(true))
  if ("isRendered" in clone) clone.isRendered = true
  if (el.id) clone.id = `${el.id}--ghost`
  clone.classList.add("ghost")
  const styles = getComputedStyle(el)

  if (options?.subpixel !== true) {
    x = round(x)
    y = round(y)
  }

  const marginTop = String(parseInt(styles.marginTop, 10))
  const marginLeft = String(parseInt(styles.marginLeft, 10))

  if (options?.cloneStyles === true) {
    for (const item of styles) {
      clone.style[item] = styles[item]
    }
  }

  clone.style.transition = "none"
  clone.style.position = "fixed"
  clone.style.zIndex = options?.zIndex ?? 1e5
  clone.style.pointerEvents = "none"
  clone.style.minWidth = "0"
  clone.style.minHeight = "0"
  clone.style.maxWidth = "none"
  clone.style.maxHeight = "none"

  // Force inline-block to allow setting width/height
  if (styles.display === "inline") clone.style.display = "inline-block"

  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.margin = "0"
  clone.style.marginTop = marginTop
  clone.style.marginLeft = marginLeft
  clone.style.top = "0"
  clone.style.left = "0"
  clone.style.translate = `${x}px ${y}px`

  return clone
}
