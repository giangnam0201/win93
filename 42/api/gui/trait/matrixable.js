import { dispatch } from "../../../lib/event/dispatch.js"
import { on } from "../../../lib/event/on.js"
import { getSize } from "../../../lib/type/element/getSize.js"
import { watchResize } from "../../../lib/type/element/watchResize.js"
import { configure } from "../../configure.js"
import { Trait } from "../Trait.js"

const _INSTANCES = Symbol.for("Trait.INSTANCES")
const { indexOf } = Array.prototype

const DEFAULTS = {
  /** @type {AbortSignal} */
  signal: undefined,
  /** @type {boolean} */
  useAria: undefined,
  cols: 0,
  rows: 0,
  /** @type {string | string[]} */
  animatableParents: undefined,
}

export class Matrixable extends Trait {
  static name = "Matrixable"

  get selectable() {
    return this.el[_INSTANCES].selectable
  }

  get virtualizable() {
    return this.el[_INSTANCES].virtualizable
  }

  /**
   * @param {string | HTMLElement} el
   * @param {Partial<DEFAULTS>} [options]
   */
  constructor(el, options) {
    super(el, options)

    this.config = configure(DEFAULTS, options)
    const { signal } = this

    this.styles = getComputedStyle(this.el)
    this.items = /** @type {HTMLCollectionOf<HTMLElement>} */ (this.el.children)
    this.rows = this.config.cols
    this.cols = this.config.rows

    if (!this.config.cols) {
      const { animatableParents } = this.config
      watchResize(
        this.el,
        {
          signal,
          throttle: 60,
          skipAnimation: { animatableParents },
          firstCall: true,
          contentBox: true,
        },
        async ({ width, height }) => {
          this.width = width
          this.height = height
          this.measureGrid()
        },
      )
    }

    if (this.config.useAria) {
      this.focusTop = this.#focusAriaTop
      this.focusUp = this.#focusAriaUp
      this.focusDown = this.#focusAriaDown
      this.focusLeft = this.#focusAriaLeft
      this.focusRight = this.#focusAriaRight
    } else {
      this.focusTop = this.#focusTop
      this.focusUp = this.#focusUp
      this.focusDown = this.#focusDown
      this.focusLeft = this.#focusLeft
      this.focusRight = this.#focusRight
    }

    on(
      this.el,
      { signal },
      {
        repeatable: true,
        prevent: true,
        ArrowUp: (e) => this.focusUp(e),
        ArrowDown: (e) => this.focusDown(e),
        ArrowLeft: (e) => this.focusLeft(e),
        ArrowRight: (e) => this.focusRight(e),
      },
    )

    this.update()
  }

  update() {
    if (this.cols || !this.width) return
    this.measureGrid()
  }

  async measureGrid() {
    const item = this.items[0]
    if (item) {
      const rect = await getSize(item)
      this.cols = Math.floor(this.width / rect.width)
      this.rows = Math.floor(this.height / rect.height)
    }
  }

  #focus(el, e) {
    if (!el) return
    this.lastJump = undefined
    el.focus({ preventScroll: true })
    el.scrollIntoView({
      block: this.styles.overflowY === "hidden" ? "start" : "center",
      inline: this.styles.overflowX === "hidden" ? "nearest" : "center",
      behavior: "instant",
      container: "nearest",
    })
    dispatch(this.el, "ui.matrix.focus", {
      bubbles: false,
      detail: {
        focusedElement: el,
        originalEvent: e,
      },
    })

    if (this.selectable && e?.ctrlKey !== true) {
      if (e?.shiftKey) {
        if (this.selectable.rangeSelect) {
          this.selectable.rangeSelect(el)
        }
      } else {
        this.selectable.selectOne(el)
      }
    }
  }

  // MARK: move
  // ==========

  #focusTop(e) {
    this.#focus(this.items[0], e)
  }

  lastJump
  #focusUp(e) {
    const index = indexOf.call(this.items, document.activeElement)
    if (index > this.lastJump) {
      this.#focus(this.items[this.lastJump], e)
    } else {
      this.#focus(this.items[index === -1 ? 0 : index - this.cols], e)
    }
  }

  #focusDown(e) {
    const index = indexOf.call(this.items, document.activeElement)
    const next = this.items[index === -1 ? 0 : index + this.cols]
    if (next) {
      this.#focus(next, e)
    } else if (index !== this.items.length - 1) {
      const itemsInLastRow = this.items.length % this.cols
      if (index < this.items.length - itemsInLastRow) {
        this.#focus(this.items[this.items.length - 1], e)
        this.lastJump = index
      }
    }
  }

  #focusLeft(e) {
    const index = indexOf.call(this.items, document.activeElement)
    this.#focus(this.items[index === -1 ? 0 : index - 1], e)
  }

  #focusRight(e) {
    const index = indexOf.call(this.items, document.activeElement)
    this.#focus(this.items[index === -1 ? 0 : index + 1], e)
  }

  // MARK: aria
  // ==========

  #hasFocused() {
    return this.el.contains(document.activeElement)
  }

  #byIndices(col, row) {
    return this.el.querySelector(
      `:scope > [aria-colindex="${col}"][aria-rowindex="${row}"]`,
    )
  }

  #searchAxis(col, row, axis = "col", dir = 1) {
    const { cols, rows } = this

    if (axis === "col") {
      const y = row
      let x = col + dir
      for (; x > 0 && x <= cols; x += dir) {
        const el = this.#byIndices(x, y)
        if (el) return el
      }

      if (x === 0) {
        if (y <= 0) return
        return this.#searchAxis(cols + 1, row - 1, axis, dir)
      }

      if (x >= cols) {
        if (y >= rows) return
        return this.#searchAxis(0, row + 1, axis, dir)
      }
    } else {
      const x = col
      let y = row + dir
      for (; y > 0 && y <= rows; y += dir) {
        const el = this.#byIndices(x, y)
        if (el) return el
      }

      if (y === 0) {
        if (x <= 0) return
        return this.#searchAxis(col - 1, rows + 1, axis, dir)
      }

      if (y >= rows) {
        if (x >= cols) return
        return this.#searchAxis(col + 1, 0, axis, dir)
      }
    }
  }

  #focusAriaTop(e) {
    this.#focus(this.#searchAxis(0, 0), e)
  }

  #focusAriaUp(e) {
    if (!this.#hasFocused()) return
    const x = Number(document.activeElement.ariaColIndex)
    const y = Number(document.activeElement.ariaRowIndex)
    this.#focus(this.#searchAxis(x, y, "row", -1), e)
  }

  #focusAriaDown(e) {
    if (!this.#hasFocused()) return
    const x = Number(document.activeElement.ariaColIndex)
    const y = Number(document.activeElement.ariaRowIndex)
    this.#focus(this.#searchAxis(x, y, "row", 1), e)
  }

  #focusAriaLeft(e) {
    if (!this.#hasFocused()) return
    const x = Number(document.activeElement.ariaColIndex)
    const y = Number(document.activeElement.ariaRowIndex)
    this.#focus(this.#searchAxis(x, y, "col", -1), e)
  }

  #focusAriaRight(e) {
    if (!this.#hasFocused()) return
    const x = Number(document.activeElement.ariaColIndex)
    const y = Number(document.activeElement.ariaRowIndex)
    this.#focus(this.#searchAxis(x, y, "col", 1), e)
  }
}

/**
 * @param {string | HTMLElement} el
 * @param {Partial<DEFAULTS>} [options]
 */
export function matrixable(el, options) {
  return new Matrixable(el, options)
}
