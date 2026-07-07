// @thanks https://github.com/bgrins/TinyColor
// @read https://colorjs.io

import { parseColor, validateRange } from "./color/parseColor.js"
import { rgbToHex, rgbToInt } from "./color/rgbToHex.js"

/**
 * @typedef {{
 *   r?: number
 *   g?: number
 *   b?: number
 *   a?: number
 *   valid?: boolean
 *   name?: string | undefined
 * }} ColorDefinition
 * @typedef {{ compact?: boolean }} ColorOptions
 */

const { min, max } = Math
const clamp = (x, lower, upper) => min(upper, max(lower, x))

const preventNaN = (val, alt = 1) => {
  val = Number(val)
  return Number.isNaN(val) ? alt : val
}

export class RGB {
  #compact

  /**
   * @param {ColorDefinition} val
   * @param {ColorOptions} [options]
   */
  constructor(val, options) {
    this.init(val)
    this.compact = options?.compact ?? false
  }

  /** @param {ColorDefinition} val */
  init({ r = 0, g = 0, b = 0, a = 1, valid = true, name }) {
    this.r = r
    this.g = g
    this.b = b
    this.a = a
    this.valid = valid
    this.name = name
    validateRange(this)
  }

  get compact() {
    return this.#compact
  }

  set compact(val) {
    this.#compact = Boolean(val)
  }

  get int() {
    return rgbToInt(this.r, this.g, this.b, this.a)
  }

  get hex() {
    return `#${rgbToHex(this.r, this.g, this.b, this.a)}`
  }

  get rgb() {
    const { r, g, b, a } = this
    return `rgb(${r} ${g} ${b}${a === 1 ? "" : ` / ${a}`})`
  }

  get rgba() {
    const { r, g, b, a } = this
    const _ = this.compact ? "" : " "
    return `rgba(${r},${_}${g},${_}${b},${_}${a})`
  }

  /** @param {number} val */
  setAlpha(val) {
    this.a = clamp(preventNaN(val), 0, 1)
    return this
  }

  toString() {
    return this.rgba
  }

  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.int
    return this.rgba
  }
}

export class Color extends RGB {
  /** @param {string} val */
  static parse(val) {
    return parseColor(val)
  }

  /**
   * @param {ColorDefinition | string} val
   * @param {ColorOptions} [options]
   */
  constructor(val, options) {
    super(
      typeof val === "string" //
        ? Color.parse(val)
        : { ...val },
      options,
    )
  }

  update(val) {
    this.init(
      typeof val === "string" //
        ? Color.parse(val)
        : { ...val },
    )
  }
}

export function color(val) {
  return new Color(val)
}
