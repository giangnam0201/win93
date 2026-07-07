import { ALLOWED_SVG_TAGS } from "../../lib/constant/ALLOWED_SVG_TAGS.js"
import { parseSingleSelector } from "../../lib/syntax/emmet/parseSingleSelector.js"
import { setAttributes } from "../../lib/type/element/setAttributes.js"

/**
 * @typedef {import("../../lib/type/element/setAttributes.js").SetAttributesObject} SetAttributesObject
 * @typedef {string | Node | (string | Node)[] | SetAttributesObject} CreateElementArg
 */

export const SVG_NS = "http://www.w3.org/2000/svg"
const ALLOWED_SVG_TAG_SET = new Set(ALLOWED_SVG_TAGS)

/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
export function createElement(selector) {
  const { tag, attrs } = parseSingleSelector(selector)

  let el

  if (ALLOWED_SVG_TAG_SET.has(tag)) {
    el = /** @type {HTMLElement} */ (
      /** @type {unknown} */ (document.createElementNS(SVG_NS, tag))
    )
  } else {
    el = document.createElement(tag)
    // @ts-ignore
    if (el.localName === "a") el.rel = "noopener"
  }

  // @ts-ignore
  if (attrs.type) el.type = attrs.type
  if (attrs.id) el.id = attrs.id
  if (attrs.class) el.classList.add(...attrs.class)

  return el
}

function mergeTokenAttributes(a, b) {
  let out = {}

  if (typeof a === "string") {
    const classTokens = a.split(" ")
    for (const token of classTokens) out[token] = true
  } else if (Array.isArray(a)) {
    for (const token of a) out[token] = true
  } else {
    out = a
  }

  if (typeof b === "string") {
    const classTokens = b.split(" ")
    for (const token of classTokens) out[token] = true
  } else if (Array.isArray(b)) {
    for (const token of b) out[token] = true
  } else {
    for (const key in b) {
      if (Object.hasOwn(b, key)) out[key] = b[key]
    }
  }

  return out
}

/**
 * @param {string} selector
 * @param {CreateElementArg[]} args
 * @returns {HTMLElement}
 */
export function create(selector, ...args) {
  const el = createElement(selector)

  const content = []
  const attrs = {}

  const { className } = el
  const hasClassSelector = Boolean(className)
  if (hasClassSelector) attrs.class = className

  for (const arg of args) {
    if (arg != null) {
      if (typeof arg !== "object" || arg instanceof Node) content.push(arg)
      else if (Array.isArray(arg)) content.push(...arg)
      else if (
        arg.class &&
        (hasClassSelector || (attrs.class && typeof arg.class === "object"))
      ) {
        const mergedClass = mergeTokenAttributes(attrs.class, arg.class)
        Object.assign(attrs, arg)
        attrs.class = mergedClass
      } else {
        Object.assign(attrs, arg)
      }
    }
  }

  setAttributes(el, attrs)
  if (content.length > 0) el.append(...content)

  return el
}
