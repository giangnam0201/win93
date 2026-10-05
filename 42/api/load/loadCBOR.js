import { httpGet } from "../http.js"
import { CBOR } from "../../formats/data/CBOR.js"

/** @import { HTTPOptions } from "../http.js" */

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions[]} [options]
 */
export function loadCBOR(url, ...options) {
  return httpGet(url, { headers: { Accept: "application/cbor" } }, ...options) //
    .then((res) => res.arrayBuffer())
    .then((text) => CBOR.decode(text))
}
