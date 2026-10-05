import { segmentize } from "../string/segmentize.js"

/**
 * @typedef {{
 *   delimiters?: string | string[]
 * }} DeallocateOptions
 */

/**
 * Delete a value in object using path.
 *
 * @template {Record<string, any>} T
 * @param {T} obj
 * @param {string} path
 * @param {string | DeallocateOptions} [options]
 * @returns {T}
 */
export function deallocate(obj, path, options) {
  if (typeof options === "string") options = { delimiters: options }
  return deallocate.run(obj, segmentize(path, options?.delimiters))
}

/**
 * @template {Record<string, any>} T
 * @param {T} obj
 * @param {string[]} segments
 * @returns {T}
 */
deallocate.run = (obj, segments) => {
  let current = obj

  if (segments.length === 0) {
    for (const key in obj) if (Object.hasOwn(obj, key)) delete obj[key]
    return obj
  }

  for (let i = 0, l = segments.length; i < l; i++) {
    const key = segments[i]
    if (typeof current !== "object" || key in current === false) return obj

    if (segments.length - 1 === i) {
      if (Array.isArray(current)) current.splice(Number(key), 1)
      else delete current[key]
      return obj
    }

    current = current[key]
  }

  return obj
}

deallocate.segmentize = segmentize
