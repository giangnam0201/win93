export const STYLES_CACHE = new WeakMap()

/**
 * @overload
 * @param {string} name
 * @param {any} val
 * @returns {string}
 */
/**
 * @overload
 * @param {Element} el
 * @param {string} name
 * @param {any} val
 * @returns {string}
 */
/**
 * Sets a CSS variable.
 * @param {Element | string} el
 * @param {string | any} name
 * @param {any} [val]
 * @returns {string}
 */
export function setCSSVar(el, name, val) {
  let element = el
  let variable = name
  if (val === undefined) {
    val = name
    variable = el
    element = document.documentElement
  }

  let key = /** @type {string} */ (variable)
  if (!key.startsWith("--")) key = "--" + key

  const node = /** @type {HTMLElement} */ (element)
  if (val === false) node.style.removeProperty(key)
  else node.style.setProperty(key, val)

  if (STYLES_CACHE.has(node)) STYLES_CACHE.delete(node)

  return key
}

/**
 * @overload
 * @param {string} name
 * @returns {string}
 */
/**
 * @overload
 * @param {Element} el
 * @param {string} name
 * @returns {string}
 */
/**
 * Gets a CSS variable.
 * @param {Element | string} el
 * @param {any} [name]
 * @returns {string}
 */
export function getCSSVar(el, name) {
  let element = el
  let variable = name
  if (variable === undefined) {
    variable = el
    element = document.documentElement
  }

  let key = /** @type {string} */ (variable)
  if (!key.startsWith("--")) key = "--" + key

  const node = /** @type {Element} */ (element)
  let styles
  if (STYLES_CACHE.has(node)) {
    styles = STYLES_CACHE.get(node)
  } else {
    styles = getComputedStyle(node)
    STYLES_CACHE.set(node, styles)
  }

  return styles.getPropertyValue(key)
}

export const cssVar = {
  get: getCSSVar,
  set: setCSSVar,
}
