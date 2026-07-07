/**
 * @param {HTMLElement} el
 * @returns {HTMLElement[]}
 */
export function getAllChildrens(el) {
  const out = []
  const stack = [el]

  while (stack.length > 0) {
    const n = stack.pop()
    let c = /** @type {HTMLElement} */ (n.firstElementChild)
    while (c) {
      out.push(c)
      stack.push(c)
      c = /** @type {HTMLElement} */ (c.nextElementSibling)
    }
  }

  return out
}
