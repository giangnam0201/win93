import { setControlData } from "./setControlData.js"
import { ensureElement } from "./ensureElement.js"
import { locate } from "../object/locate.js"

/**
 * @import { HTMLFormControl } from "./setControlData.js"
 */

/**
 * @param {string | HTMLFormElement | HTMLFieldSetElement} el
 */
export function setFormData(el, data) {
  el = /** @type {HTMLFormElement | HTMLFieldSetElement} */ (ensureElement(el))

  if ("elements" in el) {
    for (const item of /** @type {HTMLCollectionOf<HTMLFormControl>} */ (
      el.elements
    )) {
      if (
        !item.name ||
        item.localName === "button" ||
        item.localName === "fieldset"
      ) {
        continue
      }

      setControlData(item, locate(data, item.name))
    }
  }

  return data
}
