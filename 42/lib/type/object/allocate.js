import { isPrimitive } from "../any/isPrimitive.js"
import { segmentize } from "../string/segmentize.js"

/**
 * @typedef {{
 *   delimiters?: string | string[]
 *   descriptor?: boolean
 * }} AllocateOptions
 */

/**
 * Set value in object using path.
 *
 * @param {Record<string, any>} obj
 * @param {string} path
 * @param {any} val
 * @param {string | AllocateOptions} [options]
 * @returns {boolean}
 */
export function allocate(obj, path, val, options) {
  if (typeof options === "string") options = { delimiters: options }
  return allocate.run(obj, segmentize(path, options?.delimiters), val, options)
}

/**
 * @param {Record<string, any>} obj
 * @param {string[]} segments
 * @param {any} val
 * @param {AllocateOptions} [options]
 * @returns {boolean}
 */
allocate.run = (obj, segments, val, options) => {
  let current = /** @type {any} */ (obj)

  if (segments.length === 0) {
    for (const key of Object.keys(obj)) delete obj[key]
    Object.assign(obj, val)
    return true
  }

  for (let i = 0, l = segments.length; i < l; i++) {
    const key = segments[i]
    if (key === "__proto__") return false
    if (segments.length - 1 === i) {
      if (options?.descriptor) Object.defineProperty(current, key, val)
      else current[key] = val
    } else {
      if (
        !current[key] ||
        (key in current && !Object.hasOwn(current, key)) // never change prototype chain
      ) {
        current[key] = {}
      } else if (isPrimitive(current[key])) {
        return false
      }

      current = current[key]
    }
  }

  return true
}

allocate.segmentize = segmentize
