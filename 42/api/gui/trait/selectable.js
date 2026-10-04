import { Selectable } from "./selectable/Selectable.js"
import { SelectableVirtualized } from "./selectable/SelectableVirtualized.js"

export const DEFAULTS = {
  /** @type {AbortSignal} */
  signal: undefined,
  selector: ":scope > *",
  check: "isColliding",
  /** @type {Record<string, any>} */
  attributes: { class: "selected" },
  /** @type {import("../../../lib/dom/Dragger.js").DraggerOptions} */
  rubberband: { distance: 5, hoverScroll: true },
  zone: undefined,
  selection: undefined,
  elements: undefined,
  key: undefined,

  /** @type {Function} */
  add: undefined,
  /** @type {Function} */
  remove: undefined,

  multiselectable: true,
  rubberbandIgnoreItems: false,
  shortcuts: {
    selectOne: "click || Space",
    toggleSelect: "Ctrl+click || Ctrl+Space",
    rangeSelect: "Shift+click || Shift+Space",
    selectAll: "Ctrl+a",
  },
}

/**
 * @typedef {Partial<DEFAULTS>} SelectableOptions
 */

/**
 * @param {string | HTMLElement} el
 * @param {SelectableOptions} [options]
 */
export function selectable(el, options) {
  const TRAIT_INSTANCES = Symbol.for("Trait.INSTANCES")
  if (el[TRAIT_INSTANCES]?.virtualizable) {
    return new SelectableVirtualized(el, options)
  }
  return new Selectable(el, options)
}
