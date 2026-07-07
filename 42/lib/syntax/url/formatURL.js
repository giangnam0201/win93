import { flatten } from "../../type/object/flatten.js"

/**
 * @typedef {{ minify?: boolean }} formatURLOptions
 * @typedef {import("./parseURL.js").URLObject} URLObject
 */

/**
 * @param {URLSearchParams | Record<string, any>} params
 * @param {formatURLOptions} [options]
 * @returns {string}
 */
export function formatQueryString(params, options) {
  let out = "?"

  const entries = params instanceof URLSearchParams ? params : flatten(params)

  for (const [key, val] of entries) {
    if (out.length > 1) out += "&"

    if (options?.minify && (val === true || val === "true")) {
      out += `${key}`
      continue
    }

    out += `${key}=${val}`
  }

  return out
}

/**
 * @param {string | URL | URLObject} url
 * @param {URLSearchParams | Record<string, any>} [params]
 * @param {formatURLOptions} [options]
 * @returns {string}
 */
export function formatURL(url, params, options) {
  let hash = ""

  if (url instanceof URL) {
    const entries = params instanceof URLSearchParams ? params : flatten(params)
    params = new URLSearchParams(url.searchParams)
    url = url.origin + url.pathname
    for (const [key, val] of entries) {
      params.set(key, val)
    }
  } else if (typeof url !== "string") {
    let tmp = url.protocol + "//"
    if (url.username && url.password) {
      tmp += `${url.username}:${url.password}@`
    }

    if (url.hash) hash = url.hash.startsWith("#") ? url.hash : `#${url.hash}`
    url = tmp + url.host
  }

  if (options?.minify) {
    const prefix = globalThis.location?.origin ?? "file://"
    if (url.startsWith(prefix)) url = url.slice(prefix.length)
  }

  if (!params) return url + hash

  return url + formatQueryString(params, options) + hash
}
