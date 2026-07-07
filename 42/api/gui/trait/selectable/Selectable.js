import { Trait } from "../../Trait.js"
import { configure } from "../../../configure.js"
import { Dragger } from "../../../../lib/dom/Dragger.js"
import { ensureElement } from "../../../../lib/type/element/ensureElement.js"
import { ensureScopeSelector } from "../../../../lib/dom/ensureScopeSelector.js"
import * as rect from "../../../../lib/geometry/rect.js"
import { on } from "../../../../lib/event/on.js"
import { removeItem } from "../../../../lib/type/array/removeItem.js"
import { setTemp } from "../../../../lib/type/element/setTemp.js"
import { noop } from "../../../../lib/type/function/noop.js"
import { getRects } from "../../../../lib/dom/getRects.js"
import { setAttributes } from "../../../../lib/type/element/setAttributes.js"
import { removeAttributes } from "../../../../lib/type/element/removeAttributes.js"
import { dispatch } from "../../../../lib/event/dispatch.js"
import { debounce } from "../../../../lib/timing/debounce.js"
import { repaintThrottle } from "../../../../lib/timing/repaintThrottle.js"
import { DEFAULTS } from "../selectable.js"

/** @import {SelectableOptions} from "../selectable.js" */

const ns = "http://www.w3.org/2000/svg"

export class Selectable extends Trait {
  static name = "Selectable"

  #getValue
  #add
  #remove

  /**
   * @param {string | HTMLElement} el
   * @param {SelectableOptions} [options]
   */
  constructor(el, options) {
    super(el, options)

    if (options?.selection) {
      this.selection = options?.selection
      delete options.selection
    } else this.selection = []

    if (options?.elements) {
      this.elements = options?.elements
      delete options.elements
    } else this.elements = []

    this.config = configure(DEFAULTS, options)

    this.config.zone = this.config.zone
      ? ensureElement(this.config.zone)
      : this.el

    this.config.selector = ensureScopeSelector(this.config.selector, this.el)

    if (
      options?.multiselectable === undefined &&
      this.el.getAttribute("aria-multiselectable") === "false"
    ) {
      this.config.multiselectable = false
    }

    if (this.config.rubberbandIgnoreItems) {
      this.config.rubberband.ignore ??= []
      this.config.rubberband.ignore.push(this.config.selector)
    }

    this.config.add ??= noop
    this.config.remove ??= noop

    const { attributes } = this.config

    const changeEvent = debounce((options) => {
      if (options?.silent) return
      dispatch(this.el, "ui.selection.change", {
        detail: {
          selection: this.selection,
          originalEvent: this.#originalEvent,
        },
      })
      queueMicrotask(() => {
        this.#originalEvent = undefined
      })
    })

    this.#add = attributes
      ? (el, val, options) => {
          if (el) setAttributes(el, attributes, { replaceClass: false })
          this.config.add(el, val)
          changeEvent(options)
        }
      : (el, val, options) => {
          this.config.add(el, val)
          changeEvent(options)
        }

    this.#remove = attributes
      ? (el, val, options) => {
          if (el) removeAttributes(el, attributes, { flipBoolean: true })
          this.config.remove(el, val)
          changeEvent(options)
        }
      : (el, val, options) => {
          this.config.remove(el, val)
          changeEvent(options)
        }

    if (typeof this.config.key === "string") {
      this.#getValue = (item) =>
        this.config.key in item
          ? item[this.config.key]
          : item.getAttribute(this.config.key)
    } else {
      this.#getValue = this.config.key ?? ((item) => item.textContent)
    }

    this.sync()

    const tmp = {}
    if (this.el.getAttribute("tabindex") === null && this.el.tabIndex === -1) {
      tmp.tabIndex = -1
    }

    const { shortcuts } = this.config
    const { signal } = this

    let { position } = getComputedStyle(this.el)
    if (position === "static") position = "relative"

    setTemp(this.el, {
      signal,
      class: { "selection-false": true },
      style: { position },
      ...tmp,
    })

    on(
      this.config.zone,
      { signal },
      {
        pointerdown: (e, target) => {
          if (e.target === target) {
            this.#addOriginalEvent(e)
            this.clear()
          }
        },
      },
      {
        selector: this.config.selector,
        Space: false,
        [shortcuts.selectOne]: (e, target) => {
          this.#addOriginalEvent(e)
          this.selectOne(target)
        },
      },
      this.config.multiselectable && {
        selector: this.config.selector,
        prevent: true,
        [shortcuts.toggleSelect]: (e, target) => {
          this.#addOriginalEvent(e)
          this.toggleSelect(target)
        },
        [shortcuts.rangeSelect]: (e, target) => {
          this.#addOriginalEvent(e)
          this.rangeSelect(target)
        },
        [shortcuts.selectAll]: (e) => {
          this.#addOriginalEvent(e)
          this.selectAll()
        },
      },
    )

    if (this.config.multiselectable) this.#initRubberband()
    // else this.dragger = { isDragging: false }
  }

  #originalEvent
  get originalEvent() {
    return this.#originalEvent
  }

  #addOriginalEvent(e) {
    this.#originalEvent = e
  }

  #anchor
  #rangeItems = []
  #anchorSelection = []

  toggle(el, options) {
    this.#anchor = el
    this.#rangeItems.length = 0
    this.#anchorSelection = [...this.selection]
    const val = this.#getValue(el)
    if (this.elements.includes(el)) {
      removeItem(this.selection, val)
      removeItem(this.elements, el)
      this.#remove(el, val, options)
    } else {
      this.selection.push(val)
      this.elements.push(el)
      this.#add(el, val, options)
    }
  }

  add(el, options) {
    if (el.dataset.asleep) return
    if (!this.elements.includes(el)) {
      this.#anchor = el
      this.#rangeItems.length = 0
      this.#anchorSelection = [...this.selection]
      const val = this.#getValue(el)
      if (!this.config.multiselectable) this.clear(options)
      this.selection.push(val)
      this.elements.push(el)
      this.#add(el, val, options)
    }
  }

  remove(el, options) {
    if (this.elements.includes(el)) {
      const val = this.#getValue(el)
      removeItem(this.selection, val)
      removeItem(this.elements, el)
      this.#remove(el, val, options)
    }
  }

  toggleSelect(el, options) {
    if (Dragger.isDragging) return
    el = el.closest(this.config.selector)
    if (el) this.toggle(el, options)
  }

  selectOne(el, options) {
    if (Dragger.isDragging) return

    el = el.closest(this.config.selector)

    const remove = []
    for (const item of this.elements) {
      if (item !== el) remove.push(item)
    }

    for (const item of remove) this.remove(item, options)

    if (el) {
      if (el.dataset.asleep) return
      if (!this.elements.includes(el)) {
        const val = this.#getValue(el)
        this.selection.push(val)
        this.elements.push(el)
        this.#add(el, val, options)
      }
      this.#anchor = el
      this.#rangeItems.length = 0
      this.#anchorSelection = [...this.selection]
    }
  }

  selectAll(options) {
    if (Dragger.isDragging) return
    for (const el of this.el.querySelectorAll(this.config.selector)) {
      this.add(el, options)
    }
  }

  ensureSelected(el, options) {
    el = el.closest(this.config.selector)
    if (!el) return

    if (this.elements.includes(el)) return

    this.clear(options)
    this.add(el, options)
  }

  rangeSelect(el, options) {
    if (Dragger.isDragging) return
    el = el.closest(this.config.selector)
    if (!el) return

    this.#anchor ??= this.elements.at(-1) || el
    this.#anchorSelection ??= [...this.selection]

    const all = [...this.el.querySelectorAll(this.config.selector)]
    const a = all.indexOf(el)
    const b = all.indexOf(this.#anchor)
    const min = Math.min(a, b)
    const max = Math.max(a, b)

    const newRange = all.slice(min, max + 1)

    // Remove items from previous range that are not in new range and were not selected before
    for (const item of this.#rangeItems) {
      if (!newRange.includes(item)) {
        const val = this.#getValue(item)
        if (!this.#anchorSelection.includes(val)) {
          this.remove(item, { ...options, silent: true })
        }
      }
    }

    this.#rangeItems = newRange

    for (const item of newRange) {
      if (!this.elements.includes(item)) {
        const val = this.#getValue(item)
        this.selection.push(val)
        this.elements.push(item)
        this.#add(item, val, { ...options, silent: true })
      }
    }

    // trigger manually if needed, or if options.silent is not true
    if (!options?.silent) {
      this.sync(options) // wait sync handles DOM state + emits event probably?
      // Actually add/remove emit event already if silent is false. We passed silent: true to avoid spam.
      // So we emit manually:
      dispatch(this.el, "ui.selection.change", {
        detail: {
          selection: this.selection,
          originalEvent: this.#originalEvent,
        },
      })
    }
  }

  setSelection(arr, options) {
    if (options?.clear !== false) this.clear(options)
    this.selection.push(...arr)
    this.sync(options)
  }

  setElements(arr, options) {
    if (options?.clear !== false) this.clear(options)
    this.elements.push(...arr)
    this.sync(options)
  }

  reselectElements(options) {
    this.#clearElements(options)
    this.sync(options)
  }

  reselect(options) {
    this.#clearSelection(options)
    this.sync(options)
  }

  clear(options) {
    while (this.elements.length > 0) {
      const el = this.elements.shift()
      const val = this.selection.shift()
      this.#remove(el, val, options)
    }
  }

  #clearElements(options) {
    while (this.elements.length > 0) {
      const el = this.elements.shift()
      this.#remove(el, undefined, options)
    }
  }

  #clearSelection(options) {
    while (this.selection.length > 0) {
      const val = this.selection.shift()
      this.#remove(undefined, val, options)
    }
  }

  getElement(val) {
    const { key } = this.config
    const el = this.el.querySelector(`${this.config.selector}[${key}="${val}"]`)
    return el
  }

  sync(options) {
    if (this.selection.length > this.elements.length) {
      this.#clearElements(options)

      if (!this.config.multiselectable) this.selection.length = 1

      if (typeof this.config.key === "string") {
        let fail
        for (const val of this.selection) {
          const el = this.getElement(val)
          if (el) this.elements.push(el)
          else {
            fail = true
            break
          }
        }

        if (fail !== true) {
          for (let i = 0, l = this.elements.length; i < l; i++) {
            this.#add(this.elements[i], this.selection[i], options)
          }

          return
        }

        this.elements.length = 0
      }

      const selection = []
      const elements = []

      for (const el of this.el.querySelectorAll(this.config.selector)) {
        const val = this.#getValue(el)
        const i = this.selection.indexOf(val)
        if (i > -1) {
          selection[i] = val
          elements[i] = el
          this.#add(el, val, options)
        }
      }

      this.selection.length = 0
      this.selection.push(...selection.filter((x) => x !== undefined))
      this.elements.push(...elements.filter((x) => x !== undefined))
    } else if (this.selection.length < this.elements.length) {
      this.#clearSelection(options)

      if (!this.config.multiselectable) this.elements.length = 1

      for (const el of this.elements) {
        const val = this.#getValue(el)
        this.selection.push(val)
        this.#add(el, val, options)
      }
    }
  }

  #initRubberband() {
    this.config.rubberband.signal = this.signal

    let rectsPromise
    let rects
    let zoneRect
    const check = rect[this.config.check]

    let fromX
    let fromY

    const handleBoxSelection = repaintThrottle(async (B, ctrlKey) => {
      rects ??= await rectsPromise
      rectsPromise = undefined
      if (!rects) return
      for (const A of rects) {
        if (check(A, B)) this.add(A.target)
        else if (ctrlKey === false) this.remove(A.target)
      }
    })

    this.dragger = new Dragger(this.el, {
      ...this.config.rubberband,

      init: this.config.rubberband.ignore
        ? undefined
        : () => {
            this.dragger.config.ignore ??=
              this.el[Trait.INSTANCES]?.transferable?.config.selector
          },

      start: () => {
        zoneRect = this.el.getBoundingClientRect()
        const { borderLeftWidth, borderTopWidth } = getComputedStyle(this.el)
        zoneRect.x += Number.parseInt(borderLeftWidth, 10)
        zoneRect.y += Number.parseInt(borderTopWidth, 10)

        fromX = this.dragger.fromX - zoneRect.x + this.el.scrollLeft
        fromY = this.dragger.fromY - zoneRect.y + this.el.scrollTop

        rectsPromise = getRects(this.config.selector, {
          root: this.el,
          relative: true,
        })

        this.svg.style.height = this.el.scrollHeight + "px"
        this.svg.style.width = this.el.scrollWidth + "px"
        this.el.append(this.svg)
      },

      drag: (x, y, { ctrlKey }) => {
        x -= zoneRect.x - this.el.scrollLeft
        y -= zoneRect.y - this.el.scrollTop
        const points = `${fromX},${fromY} ${x},${fromY} ${x},${y} ${fromX},${y}`
        this.polygon.setAttribute("points", points)

        const B = {}

        if (x < fromX) {
          B.left = x
          B.right = fromX
        } else {
          B.left = fromX
          B.right = x
        }

        if (y < fromY) {
          B.top = y
          B.bottom = fromY
        } else {
          B.top = fromY
          B.bottom = y
        }

        handleBoxSelection(B, ctrlKey)
      },

      stop: () => {
        rects = undefined
        this.polygon.setAttribute("points", points)
        this.svg.remove()
      },
    })

    const points = "0,0 0,0 0,0 0,0"
    this.svg = document.createElementNS(ns, "svg")
    this.svg.setAttribute("class", "rubberband")
    this.svg.setAttribute("fill", "rgba(80,80,80,0.5)")
    this.polygon = document.createElementNS(ns, "polygon")
    this.polygon.setAttribute("points", points)
    this.svg.style.cssText = /* style */ `
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 100000;`

    this.svg.append(this.polygon)
  }

  destroy() {
    super.destroy()
    this.svg?.remove()
    this.dragger?.destroy?.()
    this.svg = undefined
    this.dragger = undefined
  }
}
