import { cssPrefix } from "../../cssom/cssPrefix.js"
import { isInstanceOf } from "../any/isInstanceOf.js"
import { toKebabCase } from "../string/transform.js"

const { isFinite } = Number

const SIZES_INIT = [
  "width",
  "height",
  "inlineSize",
  "blockSize",
  "minWidth",
  "minHeight",
  "minInlineSize",
  "minBlockSize",
  "maxWidth",
  "maxHeight",
  "maxInlineSize",
  "maxBlockSize",

  "top",
  "bottom",
  "left",
  "right",
  "inset",
  "insetBlock",
  "insetInline",
  "insetBlockStart",
  "insetBlockEnd",
  "insetInlineStart",
  "insetInlineEnd",

  "margin",
  "padding",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginBlockStart",
  "marginBlockEnd",
  "marginInlineStart",
  "marginInlineEnd",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingBlockStart",
  "paddingBlockEnd",
  "paddingInlineStart",
  "paddingInlineEnd",
]

const SIZES = new Set(SIZES_INIT)
for (const item of SIZES_INIT) SIZES.add(toKebabCase(item))
// console.log([...SIZES].join("\n"))

/**
 * @param {HTMLElement | SVGElement} el
 * @param {string} key
 * @param {string | number} val
 */
export function setStyle(el, key, val) {
  if (key.startsWith("--")) el.style.setProperty(key, String(val))
  else {
    const prefixed = cssPrefix(key)
    if (val == null) {
      if (prefixed) el.style.removeProperty(prefixed)
      el.style.removeProperty(key)
    } else {
      if (SIZES.has(key)) val = isFinite(val) ? `${val}px` : val
      if (prefixed && prefixed in el.style) el.style[prefixed] = val
      if (key in el.style) el.style[key] = val
      else console.warn(`Invalid style property for ${el.localName}: ${key}`)
    }
  }
}

/**
 * @template {HTMLElement | SVGElement} T
 * @param {T} el
 * @param {string | false | { [key: string]: string | number }} styles
 * @returns {T}
 */
export function setStyles(el, styles) {
  if (styles === false) {
    el.removeAttribute("style")
  } else if (typeof styles === "string") {
    el.style.cssText = styles
  } else {
    for (const key of Object.keys(styles)) setStyle(el, key, styles[key])
  }

  return el
}

/**
 * @param {HTMLElement | SVGElement} el
 * @param {HTMLElement | SVGElement | CSSStyleDeclaration} source
 */
export function copyStyles(el, source) {
  const computedStyle = isInstanceOf(source, CSSStyleDeclaration)
    ? source
    : window.getComputedStyle(source)
  for (const key of computedStyle) {
    el.style.setProperty(
      key,
      computedStyle.getPropertyValue(key),
      computedStyle.getPropertyPriority(key),
    )
  }
}
