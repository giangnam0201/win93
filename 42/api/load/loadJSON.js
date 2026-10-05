import { httpGet } from "../http.js"
import { JSON5 } from "../../formats/data/JSON5.js"

/** @import { HTTPOptions } from "../http.js" */

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadJSON(url, ...options) {
  return httpGet(url, { headers: { Accept: "application/json" } }, ...options) //
    .then((res) => res.text())
    .then((text) => JSON5.parse(text))
}
