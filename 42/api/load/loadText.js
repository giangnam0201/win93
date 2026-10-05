import { httpGet } from "../http.js"

/** @import { HTTPOptions } from "../http.js" */

/**
 * @overload
 * @param {string | URL | Request} url
 * @param {HTTPOptions} [options]
 * @returns {Promise<string>}
 */
/**
 * @overload
 * @param {string | URL | Request} url
 * @param {string} encoding
 * @param {HTTPOptions} [options]
 * @returns {Promise<string>}
 */
/**
 * @param {string | URL | Request} url
 * @param {string | HTTPOptions} [encoding]
 * @param {HTTPOptions[]} [options]
 * @returns {Promise<string>}
 */
export async function loadText(url, encoding, ...options) {
  let enc
  if (typeof encoding === "string") {
    enc = encoding
  } else {
    options.unshift(encoding)
    enc = undefined
  }

  const res = await httpGet(url, ...options)
  return enc
    ? new TextDecoder(enc).decode(await res.arrayBuffer()) //
    : res.text()
}
