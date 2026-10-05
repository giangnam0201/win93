// scroll buttons

import { Trait } from "../Trait.js"

const DEFAULTS = {}

export class Unrollable extends Trait {
  static name = "Unrollable"

  /**
   * @param {string | HTMLElement} el
   * @param {Partial<DEFAULTS>} options
   */
  constructor(el, options) {
    super(el, options)
    console.log(el, options)
  }
}

/**
 * @param {string | HTMLElement} el
 * @param {Partial<DEFAULTS>} options
 */
export function unrollable(el, options) {
  return new Unrollable(el, options)
}
