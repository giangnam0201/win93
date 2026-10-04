/**
 * @typedef {string | Element[] | NodeListOf<Element>} Elements
 */

import { ensureElement } from "../type/element/ensureElement.js"
import { isVisible } from "./isVisible.js"

/**
 * Find the highest z-index from a list of element.
 *
 * @param {Elements} [elements]
 * @param {any} [options]
 */
export function zIndex(elements = "*", options) {
  if (typeof elements === "string") {
    elements = document.querySelectorAll(elements)
  }

  let max = options?.max ?? 0
  let min
  let topElement
  let bottomElement

  for (const item of elements) {
    const val = Number(getComputedStyle(item).zIndex)

    if (options?.checkIfVisible && !isVisible(item)) continue

    if (min === undefined) {
      min = val
      bottomElement = item
    }

    if (val > max) {
      max = val
      topElement = item
    }
  }

  min ??= 0

  return { topElement, bottomElement, max, min }
}

/* max */

export function getTopZIndex(elements, options) {
  return zIndex(elements, options).max
}

export function getNextZIndex(elements, options) {
  return zIndex(elements, options).max + 1
}

export function getTopElement(elements, options) {
  return zIndex(elements, options).topElement
}

export function setTopElement(el, elements, options) {
  el = ensureElement(el)
  el.style.zIndex = getNextZIndex(elements, options)
}

/* min */

export function getBottomZIndex(elements, options) {
  return zIndex(elements, options).min
}

export function getPreviousZIndex(elements, options) {
  return zIndex(elements, options).min - 1
}

export function getBottomElement(elements, options) {
  return zIndex(elements, options).bottomElement
}

export function setBottomElement(el, elements, options) {
  el = ensureElement(el)
  el.style.zIndex = getPreviousZIndex(elements, options)
}
