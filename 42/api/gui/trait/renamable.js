import { Trait } from "../Trait.js"
import { configure } from "../../configure.js"
import { untilConnected } from "../../../lib/type/element/untilConnected.js"
import { isInstanceOf } from "../../../lib/type/any/isInstanceOf.js"
import { parsePath } from "../../../lib/syntax/path/parsePath.js"
import { on } from "../../../lib/event/on.js"

const DEFAULTS = {
  /** @type {AbortSignal} */
  signal: undefined,
  /** @type {keyof FRAGMENT_INDICES | number} */
  firstFragment: undefined,
  auto: false,
}

const FRAGMENT_INDICES = {
  name: 0,
  base: 1,
  ext: 2,
}

export class Renamable extends Trait {
  static name = "Renamable"

  #currentIdx = 0

  /**
   * @param {string | HTMLTextAreaElement | HTMLInputElement} el
   * @param {Partial<DEFAULTS>} options
   */
  constructor(el, options) {
    super(el, options)
    this.config = configure(DEFAULTS, options)

    if (
      !(
        isInstanceOf(this.el, HTMLTextAreaElement) ||
        isInstanceOf(this.el, HTMLInputElement)
      )
    ) {
      throw new TypeError("renamable element must be an input or textarea")
    }

    /** @type {HTMLTextAreaElement | HTMLInputElement} */
    this.el

    /** @type {[number, number][]} */
    this.segments = []

    this.enabled = true

    const firstFragment =
      this.config.firstFragment in FRAGMENT_INDICES
        ? FRAGMENT_INDICES[this.config.firstFragment]
        : (this.config.firstFragment ?? 0)

    const { signal } = this

    on(this.el, {
      signal,
      // input: debounce(() => this.setSegments(), 250),
      F2: () => this.selectNextSegment(),
      focus: () => this.selectNextSegment(firstFragment),
    })

    this.#checkSegments()

    if (this.config.auto) {
      untilConnected(this.el).then(() => this.selectNextSegment())
    }
  }

  #lastValue
  #checkSegments() {
    if (this.#lastValue === this.el.value) return
    this.#lastValue = this.el.value
    this.setSegments()
  }

  setSegments() {
    this.segments.length = 0

    const parsed = parsePath(this.el.value)
    this.parsed = parsed

    const start = parsed.dir ? parsed.dir.length + 1 : 0

    this.segments.push(
      [start, start + parsed.name.length], //
      [start, start + parsed.base.length],
    )

    if (parsed.ext) {
      this.segments.push([
        start + parsed.name.length + 1,
        start + parsed.name.length + 1 + parsed.ext.length,
      ])
    }
  }

  selectName() {
    this.selectNextSegment(0)
  }

  selectBase() {
    this.selectNextSegment(1)
  }

  selectExt() {
    this.selectNextSegment(2)
  }

  selectNextSegment(index = this.#currentIdx) {
    if (!this.enabled || !document.hasFocus()) return
    this.#checkSegments()
    if (this.segments.length === 0) return
    this.#currentIdx = index
    const segment = this.segments[this.#currentIdx++ % this.segments.length]
    if (document.activeElement !== this.el) this.el.focus()
    this.el.setSelectionRange(0, 0)
    this.el.setSelectionRange(...segment)
  }

  setName(str) {
    if (!this.enabled) return
    this.#checkSegments()
    if (this.segments.length === 0) return
    const prev = this.el.value.slice(0, this.segments[0][0])
    const after = this.el.value.slice(this.segments[0][1])
    this.el.value = `${prev}${str}${after}`
  }

  setBase(str) {
    if (!this.enabled) return
    this.#checkSegments()
    if (this.segments.length < 2) return
    const prev = this.el.value.slice(0, this.segments[1][0])
    const after = this.el.value.slice(this.segments[1][1])
    this.el.value = `${prev}${str}${after}`
  }

  setExt(str) {
    if (!this.enabled) return
    this.#checkSegments()
    if (this.segments.length < 3) {
      if (!this.el.value || this.segments.length === 0) return
      this.el.value += ".txt"
      this.#checkSegments()
      if (this.segments.length < 3) return
    }
    str = str.trim()
    if (str.startsWith(".")) str = str.slice(1)
    const prev = this.el.value.slice(0, this.segments[2][0])
    this.el.value = `${prev}${str}`
  }

  getName() {
    if (!this.enabled) return
    this.#checkSegments()
    return this.parsed.name
  }

  getBase() {
    if (!this.enabled) return
    this.#checkSegments()
    return this.parsed.base
  }

  getExt() {
    if (!this.enabled) return
    this.#checkSegments()
    return this.parsed.ext
  }
}

/**
 * @param {string | HTMLTextAreaElement | HTMLInputElement} el
 * @param {Partial<DEFAULTS>} options
 */
export function renamable(el, options) {
  return new Renamable(el, options)
}
