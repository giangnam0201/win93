import { getControlData } from "./getControlData.js"
import { allocate } from "../object/allocate.js"
import { ensureElement } from "./ensureElement.js"

/**
 * @param {string | HTMLFormElement | HTMLFieldSetElement} el
 */
export function getFormData(el) {
  el = /** @type {HTMLFormElement | HTMLFieldSetElement} */ (ensureElement(el))
  const data = {}

  if ("elements" in el) {
    for (const item of el.elements) {
      if (
        !item.name ||
        item.localName === "button" ||
        item.localName === "fieldset"
      ) {
        continue
      }

      allocate(data, item.name, getControlData(item))
    }
  }

  return data
}
