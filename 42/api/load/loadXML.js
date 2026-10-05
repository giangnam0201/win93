import { httpGet } from "../http.js"

/** @import { HTTPOptions } from "../http.js" */

const mimeType = "application/xml"

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadXML(url, ...options) {
  return /** @type {Promise<Element>} */ httpGet(url, ...options)
    .then((res) => res.text())
    .then((res) => new DOMParser().parseFromString(res, mimeType).firstChild)
}
