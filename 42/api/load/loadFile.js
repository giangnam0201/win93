import { httpGet } from "../http.js"
import { responseToFile } from "../io/responseToFile.js"

/** @import { HTTPOptions } from "../http.js" */

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions & {filename?: string}} [options]
 */
export function loadFile(url, options) {
  return /** @type {Promise<File>} */ (
    httpGet(url, options).then((res) => responseToFile(res, options?.filename))
  )
}
