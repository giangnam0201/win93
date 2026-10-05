import { httpGet } from "../http.js"

/** @import { HTTPOptions } from "../http.js" */

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadBlob(url, ...options) {
  return /** @type {Promise<Blob>} */ (
    httpGet(url, ...options).then((res) => res.blob())
  )
}
