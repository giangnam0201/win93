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

const ns = "http://www.w3.org/2000/svg"
const TRAIT_INSTANCES = Symbol.for("Trait.INSTANCES")

export class SelectableVirtualized extends Trait {
  static name = "Selectable"

  #getValueElement
  #getValueItem
  #add
  #remove

  constructor(el, options) {
    super(el, options)

    if (options?.selection) {
      this.selection = options?.selection
      delete options.selection
    } else this.selection = []

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
      this.#getValueElement = (item) =>
        this.config.key in item
          ? item[this.config.key]
          : item.getAttribute?.(this.config.key)
      this.#getValueItem = (item) =>
        item !== null && typeof item === "object" && this.config.key in item
          ? item[this.config.key]
          : item
    } else {
      this.#getValueElement = this.config.key ?? ((item) => item.textContent)
      this.#getValueItem = this.#getValueElement
    }

    this.virtualizable = this.el[TRAIT_INSTANCES]?.virtualizable
    if (this.virtualizable) {
      this.virtualizable.on(
        "getElement",
        (node, item, _idx) => {
          const val = this.#getValueItem(item)
          if (this.selection.includes(val)) {
            this.#add(node, val, { silent: true })
          } else if (attributes) {
            removeAttributes(node, attributes, { flipBoolean: true })
          }
        },
        { signal: this.signal },
      )
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
  }

  #originalEvent
  get originalEvent() {
    return this.#originalEvent
  }

  get elements() {
    const elements = []
    if (this.virtualizable) {
      for (const [idx, node] of this.virtualizable.renderedNodes) {
        const itemVal = this.#getValueItem(this.virtualizable.items[idx])
        if (this.selection.includes(itemVal)) {
          elements.push(node)
        }
      }
    } else {
      for (const val of this.selection) {
        const el = this.getElement(val)
        if (el) elements.push(el)
      }
    }
    return elements
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
    const val = this.#getValueElement(el)
    if (this.selection.includes(val)) {
      removeItem(this.selection, val)
      this.#remove(el, val, options)
    } else {
      this.selection.push(val)
      this.#add(el, val, options)
    }
  }

  add(el, options) {
    if (el.dataset.asleep) return
    this.#anchor = el
    this.#rangeItems.length = 0
    this.#anchorSelection = [...this.selection]
    const val = this.#getValueElement(el)
    if (!this.selection.includes(val)) {
      if (!this.config.multiselectable) this.clear(options)
      this.selection.push(val)
      this.#add(el, val, options)
    }
  }

  remove(el, options) {
    const val = this.#getValueElement(el)
    if (this.selection.includes(val)) {
      removeItem(this.selection, val)
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
    if (!el) return

    const targetVal = this.#getValueElement(el)

    const remove = []
    for (const val of this.selection) {
      if (val !== targetVal) remove.push(val)
    }

    for (const val of remove) {
      removeItem(this.selection, val)
      const element = this.getElement(val)
      this.#remove(element, val, options)
    }

    if (!this.selection.includes(targetVal)) {
      this.selection.push(targetVal)
    }
    this.#add(el, targetVal, options)

    this.#anchor = el
    this.#rangeItems.length = 0
    this.#anchorSelection = [...this.selection]
  }

  selectAll(options) {
    if (Dragger.isDragging) return
    if (!this.virtualizable) return

    for (const item of this.virtualizable.items) {
      const val = this.#getValueItem(item)
      if (!this.selection.includes(val)) {
        this.selection.push(val)
        const el = this.getElement(val)
        this.#add(el, val, options)
      }
    }
  }

  ensureSelected(el, options) {
    el = el.closest(this.config.selector)
    if (!el) return

    const val = this.#getValueElement(el)
    if (this.selection.includes(val)) return

    this.clear(options)
    this.add(el, options)
  }

  rangeSelect(el, options) {
    if (Dragger.isDragging) return
    el = el.closest(this.config.selector)
    if (!el || !this.virtualizable) return

    const targetVal = this.#getValueElement(el)
    const targetIndex = this.virtualizable.items.findIndex(
      (item) => this.#getValueItem(item) === targetVal,
    )
    if (targetIndex === -1) return

    this.#anchor ??= this.getElement(this.selection.at(-1)) || el
    this.#anchorSelection ??= [...this.selection]

    let lastIndex = -1
    if (this.#anchor) {
      const lastVal = this.#getValueElement(this.#anchor)
      lastIndex = this.virtualizable.items.findIndex(
        (item) => this.#getValueItem(item) === lastVal,
      )
    }

    if (lastIndex === -1) lastIndex = targetIndex

    const min = Math.min(targetIndex, lastIndex)
    const max = Math.max(targetIndex, lastIndex)

    const newRange = this.virtualizable.items.slice(min, max + 1)

    // Remove items from previous range that are not in new range
    for (const item of this.#rangeItems) {
      if (!newRange.includes(item)) {
        const val = this.#getValueItem(item)
        if (!this.#anchorSelection.includes(val)) {
          removeItem(this.selection, val)
          const node = this.getElement(val)
          this.#remove(node, val, { ...options, silent: true })
        }
      }
    }

    this.#rangeItems = newRange

    for (const item of newRange) {
      const val = this.#getValueItem(item)
      if (!this.selection.includes(val)) {
        this.selection.push(val)
        const node = this.getElement(val)
        this.#add(node, val, { ...options, silent: true })
      }
    }

    if (!options?.silent) {
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
    for (const val of arr) {
      if (!this.selection.includes(val)) {
        this.selection.push(val)
      }
    }
    this.sync(options)
  }

  setElements(arr, options) {
    if (options?.clear !== false) this.clear(options)
    for (const el of arr) {
      const val = this.#getValueElement(el)
      if (!this.selection.includes(val)) {
        this.selection.push(val)
      }
    }
    this.sync(options)
  }

  reselectElements(options) {
    this.sync(options)
  }

  reselect(options) {
    const old = [...this.selection]
    this.#clearSelection(options)
    this.selection.push(...old)
    this.sync(options)
  }

  clear(options) {
    this.#clearSelection(options)
  }

  #clearSelection(options) {
    while (this.selection.length > 0) {
      const val = this.selection.shift()
      const el = this.getElement(val)
      this.#remove(el, val, options)
    }
  }

  getElement(val) {
    if (this.virtualizable) {
      for (const [idx, node] of this.virtualizable.renderedNodes) {
        const itemVal = this.#getValueItem(this.virtualizable.items[idx])
        if (itemVal === val) return node
      }
    }
    const { key } = this.config
    const el = this.el.querySelector(`${this.config.selector}[${key}="${val}"]`)
    return el
  }

  sync(options) {
    if (!this.config.multiselectable && this.selection.length > 1) {
      this.selection.length = 1
    }

    const uniqueSel = new Set(this.selection)
    this.selection.length = 0
    this.selection.push(...uniqueSel)

    if (this.virtualizable) {
      for (const [idx, node] of this.virtualizable.renderedNodes) {
        const v = this.#getValueItem(this.virtualizable.items[idx])
        if (this.selection.includes(v)) {
          this.#add(node, v, options)
        } else {
          this.#remove(node, v, options)
        }
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
