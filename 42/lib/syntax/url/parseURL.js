import { allocate } from "../../type/object/allocate.js"

/**
 * @typedef {{
 *   protocol: string
 *   username: string
 *   password: string
 *   host: string
 *   origin: string
 *   pathname: string
 *   hash: string
 *   query: Record<string, any>
 * }} URLObject
 */

/**
 * @param {string | URL | URLSearchParams} [value] Default is `location.search` if defined.
 * @param {{ parseValue?: false | Function }} [options]
 * @returns {Record<string, any>}
 */
export function parseQueryString(value, options) {
  value ??= globalThis.location?.search ?? ""

  if (!(value instanceof URLSearchParams)) {
    value = new URL(value, "file:").searchParams
  }

  const out = {}

  for (let [key, val] of value.entries()) {
    // @ts-ignore
    if (val === "") val = true
    else if (options?.parseValue !== false) {
      const parse = options?.parseValue ?? JSON.parse
      try {
        val = parse(val)
      } catch {
        if (val === "undefined") val = undefined
      }
    }

    allocate(out, key, val)
  }

  return out
}

/**
 * @param {string | URL} url
 * @param {string | URL} [base]
 * @returns {URLObject}
 */
export function parseURL(url, base) {
  base ??= globalThis.location?.href ?? "file:"
  url = new URL(url, base)
  return {
    protocol: url.protocol,
    username: url.username,
    password: url.password,
    host: url.host,
    origin: url.origin,
    pathname: url.pathname,
    hash: url.hash,
    query: url.search ? parseQueryString(url.searchParams) : {},
  }
}
