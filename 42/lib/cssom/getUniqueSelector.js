import { ensureElement } from "../type/element/ensureElement.js"

/**
 * Return a unique CSS selector for an element using only tag names and nth-child.
 * @param {HTMLElement | string} el
 * @param {HTMLElement | string} [root]
 * @returns {string}
 */
export function getUniqueSelector(el, root = document.documentElement) {
  el = ensureElement(el)
  root = ensureElement(root)
  if (!root.contains(el)) throw new Error("root does not contain element")

  if (el === root) {
    return root === document.documentElement ? root.localName : ":scope"
  }

  const parts = []

  for (
    let node = /** @type {Element} */ (el);
    node && node !== root;
    node = node.parentElement
  ) {
    let idx = 1
    let sib = node
    while (sib) {
      sib = sib.previousElementSibling
      idx++
    }
    parts.unshift(`${node.localName}:nth-child(${idx})`)
  }

  const path = parts.join(" > ")
  return root === document.documentElement ? path : `:scope > ${path}`
}
