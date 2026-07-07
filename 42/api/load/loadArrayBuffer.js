import { httpGet } from "../http.js"

/** @import { HTTPOptions } from "../http.js" */

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadArrayBuffer(url, ...options) {
  return /** @type {Promise<ArrayBuffer>} */ (
    httpGet(url, ...options).then((res) => res.arrayBuffer())
  )
}
