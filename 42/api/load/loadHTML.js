import { httpGet } from "../http.js"

/** @import { HTTPOptions } from "../http.js" */

const mimeType = "text/html"

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadHTML(url, ...options) {
  return /** @type {Promise<HTMLHtmlElement>} */ httpGet(url, ...options)
    .then((res) => res.text())
    .then((res) => new DOMParser().parseFromString(res, mimeType).firstChild)
}
