import { Trait } from "../Trait.js"
import { Dragger } from "../../../lib/dom/Dragger.js"
import { configure } from "../../configure.js"
import { keyboard } from "../../env/device/keyboard.js"
import { noop } from "../../../lib/type/function/noop.js"
import { measureCSS } from "../../../lib/cssom/measureCSS.js"
// import { setTemp } from "../../../lib/type/element/setTemp.js"

/**
 * @typedef {Partial<DEFAULTS>} ResizableOptions
 * @typedef {'n'|'e'|'s'|'w'|'nw'|'ne'|'sw'|'se'} ResizeHandle
 */

/** @type {Array<ResizeHandle>} */
const HANDLES = [
  "n", //
  "e",
  "s",
  "w",
  "nw",
  "ne",
  "sw",
  "se",
]

const CURSOR_MAP = {
  n: "ns-resize",
  e: "ew-resize",
  s: "ns-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  se: "nwse-resize",
}

const DEFAULTS = {
  /** @type {AbortSignal} */
  signal: undefined,
  distance: 0,
  /** @type {boolean | number | Array<number>} */
  grid: false,
  throttle: true,
  subpixel: false,
  handles: HANDLES,
  aspectRatio: false,
  /** @type {string | false} */
  aspectRatioKey: "shift",

  /** @type {number} */
  minWidth: undefined,
  /** @type {number} */
  minHeight: undefined,
  /** @type {number} */
  maxWidth: undefined,
  /** @type {number} */
  maxHeight: undefined,

  /** @type {Function} */
  start: noop,
  /** @type {Function} */
  resize: noop,
  /** @type {Function} */
  stop: noop,

  handleClass: "resizable-handle",
  handleSize: "11px",
  handleSidesSize: "100%",
  handleOffset: "3px",
}

export class Resizable extends Trait {
  static name = "Resizable"

  enabled = true
  #handles = []
  #dragger = null
  #activePosition = null
  #initialRect = null
  #initialTranslate = null
  #aspectRatio = null
  #initialX = 0
  #initialY = 0

  /**
   * @param {string | HTMLElement} el
   * @param {ResizableOptions} [options]
   */
  constructor(el, options) {
    super(el, options)

    this.config = configure(DEFAULTS, options)

    this.start = this.config.start
    this.resize = this.config.resize
    this.stop = this.config.stop

    // Lazy init
    requestIdleCallback(() => this.init())
  }

  init() {
    this.#createHandles()

    const { signal } = this

    keyboard.listen(signal)

    const { throttle, subpixel } = this.config

    const handleSelector = this.#getHandleSelector()

    this.#dragger = new Dragger(this.el, {
      signal: this.signal,
      distance: this.config.distance,
      // grid,
      throttle,
      subpixel,
      selector: handleSelector,
      start: (x, y, event, target) => {
        if (!this.enabled) return false

        const position = target?.dataset?.resize
        if (!position) return false

        this.#ensureConstraints()

        this.#activePosition = position
        this.#initialRect = this.el.getBoundingClientRect()
        this.#initialTranslate = this.#getTranslate()
        this.#aspectRatio = this.#initialRect.width / this.#initialRect.height
        this.#initialX = x
        this.#initialY = y

        return this.start(this.#getResizeData(position)) !== false
      },

      drag: (x, y) => {
        if (!this.#activePosition) return
        const data = this.#calculateResize(x, y, this.#activePosition)
        if (this.resize(data) === false) return

        this.#applyResize(data)
      },

      stop: (x, y) => {
        if (!this.#activePosition) return
        const data = this.#calculateResize(x, y, this.#activePosition)
        this.stop(data)
        this.#activePosition = null
        this.#initialRect = null
        this.#initialTranslate = null
        this.#aspectRatio = null
      },
    })
  }

  #getHandleSelector() {
    const handleClass = this.config.handleClass.trim()
    if (!handleClass) return ".resizable-handle"
    return `.${handleClass.split(/\s+/).join(".")}`
  }

  #ensureConstraints() {
    if (this.constraints) return
    const { signal } = this
    this.constraints = {
      minWidth:
        this.config.minWidth === undefined
          ? measureCSS(this.el, "min-width", { live: true, signal })
          : { value: this.config.minWidth },
      minHeight:
        this.config.minHeight === undefined
          ? measureCSS(this.el, "min-height", { live: true, signal })
          : { value: this.config.minHeight },
      maxWidth:
        this.config.maxWidth === undefined
          ? measureCSS(this.el, "max-width", { live: true, signal })
          : { value: this.config.maxWidth },
      maxHeight:
        this.config.maxHeight === undefined
          ? measureCSS(this.el, "max-height", { live: true, signal })
          : { value: this.config.maxHeight },
    }
  }

  #createHandles() {
    const {
      handleClass, //
      handleSize,
      handleSidesSize,
      handleOffset,
      handles,
    } = this.config

    for (const position of handles) {
      const handle = document.createElement("div")
      handle.className = handleClass
      handle.dataset.resize = position

      const isNorth = position.includes("n")
      const isSouth = position.includes("s")
      const isWest = position.includes("w")
      const isEast = position.includes("e")
      const isCorner = isNorth !== isSouth && isWest !== isEast

      let width
      let height
      if (isCorner) {
        width = handleSize
        height = handleSize
      } else if (isNorth || isSouth) {
        width = handleSidesSize
        height = handleSize
      } else {
        width = handleSize
        height = handleSidesSize
      }

      handle.style.cssText = /* style */ `
        position: absolute;
        z-index: calc(var(--z-focused) + 1);
        width: ${width};
        height: ${height};
        cursor: var(--cursor-${CURSOR_MAP[position]}, ${CURSOR_MAP[position]});
        touch-action: none;`

      if (isNorth) {
        handle.style.top = `calc(${handleSize} / -2 - ${handleOffset})`
      } else if (isSouth) {
        handle.style.bottom = `calc(${handleSize} / -2 - ${handleOffset})`
      } else handle.style.top = `calc(50% - (${height}) / 2)`

      if (isWest) {
        handle.style.left = `calc(${handleSize} / -2 - ${handleOffset})`
      } else if (isEast) {
        handle.style.right = `calc(${handleSize} / -2 - ${handleOffset})`
      } else handle.style.left = `calc(50% - (${width}) / 2)`

      this.el.append(handle)
      this.#handles.push(handle)
    }
  }

  #getTranslate() {
    const transform = this.el.style.translate
    if (transform) {
      const parts = transform.split(" ")
      return {
        x: Number.parseFloat(parts[0]) || 0,
        y: Number.parseFloat(parts[1]) || 0,
      }
    }
    return { x: 0, y: 0 }
  }

  #getResizeData(position) {
    return {
      target: this.el,
      x: this.#initialRect.x,
      y: this.#initialRect.y,
      width: this.#initialRect.width,
      height: this.#initialRect.height,
      position,
    }
  }

  #shouldMaintainAspectRatio() {
    if (this.config.aspectRatio === true) return true
    if (this.config.aspectRatioKey === false) return false
    return keyboard.keys[this.config.aspectRatioKey] === true
  }

  #applyGrid(value, axis) {
    const { grid } = this.config
    if (!grid) return value

    const gridValue = Array.isArray(grid)
      ? axis === "x"
        ? grid[0]
        : grid[1]
      : /** @type {number} */ (grid)

    return value - (value % gridValue)
  }

  #calculateResize(x, y, position) {
    if (
      !this.el.isConnected || //
      !this.#initialRect ||
      this.signal.aborted
    ) {
      return
    }

    const deltaX = x - this.#initialX
    const deltaY = y - this.#initialY

    const isNorth = position.includes("n")
    const isSouth = position.includes("s")
    const isWest = position.includes("w")
    const isEast = position.includes("e")

    let newWidth = this.#initialRect.width
    let newHeight = this.#initialRect.height
    let newX = this.#initialRect.x
    let newY = this.#initialRect.y

    // Calculate width changes
    if (isEast) {
      newWidth = this.#initialRect.width + deltaX
    } else if (isWest) {
      newWidth = this.#initialRect.width - deltaX
      newX = this.#initialRect.x + deltaX
    }

    // Calculate height changes
    if (isSouth) {
      newHeight = this.#initialRect.height + deltaY
    } else if (isNorth) {
      newHeight = this.#initialRect.height - deltaY
      newY = this.#initialRect.y + deltaY
    }

    // Apply aspect ratio constraint
    if (this.#shouldMaintainAspectRatio()) {
      if (isNorth || isSouth) {
        newWidth = newHeight * this.#aspectRatio
        if (isWest) {
          newX = this.#initialRect.x + (this.#initialRect.width - newWidth)
        }
      } else if (isEast || isWest) {
        newHeight = newWidth / this.#aspectRatio
        if (isNorth) {
          newY = this.#initialRect.y + (this.#initialRect.height - newHeight)
        }
      }
    }

    // Apply grid snapping
    newWidth = this.#applyGrid(newWidth, "x")
    newHeight = this.#applyGrid(newHeight, "y")

    // Apply constraints
    newWidth = Math.max(
      Math.min(this.constraints.minWidth.value, this.#initialRect.width),
      Math.min(this.constraints.maxWidth.value, newWidth),
    )
    newHeight = Math.max(
      Math.min(this.constraints.minHeight.value, this.#initialRect.height),
      Math.min(this.constraints.maxHeight.value, newHeight),
    )

    // Recalculate position if resizing from top/left to maintain opposite edge
    if (isWest) {
      newX = this.#initialRect.x + (this.#initialRect.width - newWidth)
    }
    if (isNorth) {
      newY = this.#initialRect.y + (this.#initialRect.height - newHeight)
    }

    return {
      target: this.el,
      position,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      deltaX: newX - this.#initialRect.x,
      deltaY: newY - this.#initialRect.y,
    }
  }

  #applyResize(data) {
    const { width, height, deltaX, deltaY } = data

    this.el.style.width = `${width}px`
    this.el.style.height = `${height}px`

    // Adjust translate to keep the element visually in place when resizing from left/top
    if (deltaX !== 0 || deltaY !== 0) {
      const newTranslateX = this.#initialTranslate.x + deltaX
      const newTranslateY = this.#initialTranslate.y + deltaY
      this.el.style.translate = `${newTranslateX}px ${newTranslateY}px`
    }
  }

  destroy() {
    requestIdleCallback(() => {
      this.#dragger?.destroy()
      this.#dragger = null
      for (const handle of this.#handles) handle.remove()
      this.#handles.length = 0
    })
    super.destroy()
  }
}

/**
 * @param {string | HTMLElement} el
 * @param {ResizableOptions} [options]
 */
export function resizable(el, options) {
  return new Resizable(el, options)
}
