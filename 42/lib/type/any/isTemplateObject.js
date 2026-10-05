import "../../../api/env/polyfill/Array.isTemplateObject.js"

/**
 * @param {any} val
 * @returns {boolean}
 */
export function isTemplateObject(val) {
  return Array.isTemplateObject(val)
}
