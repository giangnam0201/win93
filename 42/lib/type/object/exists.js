import { segmentize } from "../string/segmentize.js"

/**
 * @typedef {{
 *   delimiters?: string | string[]
 * }} ExistsOptions
 */

/**
 * Check if value exists in object using path.
 *
 * @param {Record<string, any>} obj
 * @param {string} path
 * @param {string | ExistsOptions} [options]
 * @returns {boolean}
 */
export function exists(obj, path, options) {
  if (typeof options === "string") options = { delimiters: options }
  return exists.run(obj, segmentize(path, options?.delimiters))
}

/**
 * @param {Record<string, any>} obj
 * @param {string[]} segments
 * @returns {boolean}
 */
exists.run = (obj, segments) => {
  let current = obj

  for (const key of segments) {
    if (typeof current !== "object" || key in current === false) return false
    current = current[key]
  }

  return true
}

exists.segmentize = segmentize
