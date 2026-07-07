import { httpGet } from "../http.js"

/** @import { HTTPOptions } from "../http.js" */

const mimeType = "image/svg+xml"

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadSVG(url, ...options) {
  return /** @type {Promise<SVGSVGElement>} */ (
    httpGet(url, ...options)
      .then((res) => res.text())
      .then((res) => new DOMParser().parseFromString(res, mimeType).firstChild)
  )
}
