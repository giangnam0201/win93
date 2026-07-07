import { httpGet } from "../http.js"
import { blobToBinaryString } from "../../lib/type/binary/blobToDataURL.js"

/** @import { HTTPOptions } from "../http.js" */

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadBinaryString(url, ...options) {
  return /** @type {Promise<string>} */ (
    httpGet(url, ...options)
      .then((res) => res.blob())
      .then((blob) => blobToBinaryString(blob))
  )
}
