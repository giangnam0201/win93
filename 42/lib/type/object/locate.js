/* eslint-disable max-depth */
/* eslint-disable complexity */
import { segmentize } from "../string/segmentize.js"

/**
 * @typedef {{
 *   delimiters?: string | string[]
 *   ignoreCase?: boolean
 *   returnPath?: boolean
 *   autobind?: boolean
 * }} LocateOptions
 */

/**
 * Get value in object using path.
 *
 * @template {Record<string, any>} T
 * @param {T} obj
 * @param {string} path
 * @param {string | LocateOptions} [options]
 * @returns {T | any}
 */
export function locate(obj, path, options) {
  if (typeof options === "string") options = { delimiters: options }
  return locate.run(obj, segmentize(path, options?.delimiters), options)
}

function joinDelimiter(segments, options) {
  return segments.join(
    options.delimiters
      ? Array.isArray(options.delimiters)
        ? options.delimiters[0]
        : options.delimiters
      : ".",
  )
}

/**
 * @template {Record<string, any>} T
 * @param {T} obj
 * @param {string[]} segments
 * @param {LocateOptions} [options]
 * @returns {T | any}
 */
locate.run = (obj, segments, options = {}) => {
  let current = /** @type {any} */ (obj)

  if (options.ignoreCase) {
    const realSegments = [""]
    for (let seg of segments) {
      seg = seg.toLocaleLowerCase()

      if (
        seg !== "-" &&
        seg.startsWith("-") &&
        typeof current?.at === "function"
      ) {
        current = current.at(seg)
        continue
      }

      if (
        typeof current !== "object" ||
        seg === "__proto__" ||
        (seg === "constructor" && !Object.hasOwn(current, seg))
      ) {
        return
      }

      let found

      for (const key in current) {
        if (Object.hasOwn(current, key)) {
          if (key.toLocaleLowerCase() === seg) {
            realSegments.push(key)
            found = true
            current =
              options.autobind && typeof current[key] === "function"
                ? current[key].bind(current)
                : current[key]
            break
          }
        }
      }

      if (!found) return
    }

    if (options.returnPath) return joinDelimiter(realSegments, options)
  } else {
    for (const seg of segments) {
      if (
        seg !== "-" &&
        seg.startsWith("-") &&
        typeof current?.at === "function"
      ) {
        current = current.at(seg)
        continue
      }

      if (
        typeof current !== "object" ||
        seg in current === false ||
        seg === "__proto__" ||
        (seg === "constructor" && !Object.hasOwn(current, seg))
      ) {
        return
      }

      current =
        options.autobind && typeof current[seg] === "function"
          ? current[seg].bind(current)
          : current[seg]
    }

    if (options.returnPath) return joinDelimiter(segments, options)
  }

  return current
}

locate.segmentize = segmentize
