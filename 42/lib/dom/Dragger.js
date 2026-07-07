import { listenEventMap } from "../event/on.js"
import { ensureElement } from "../type/element/ensureElement.js"
import { ensureScopeSelector } from "./ensureScopeSelector.js"
import { configure } from "../../api/configure.js"
import { setTemp } from "../type/element/setTemp.js"
import { Canceller } from "../class/Canceller.js"
import { repaintThrottle } from "../timing/repaintThrottle.js"
import { queueTask } from "../timing/queueTask.js"
import { noop } from "../type/function/noop.js"
import { HoverScroll } from "./HoverScroll.js"
import { suspendIframes } from "./suspendIframes.js"

/**
 * @typedef {Partial<DEFAULTS>} DraggerOptions
 */

// Shared touch-action CSS — one <style> element for all Dragger instances
const touchActionRules = new Map()
let touchActionStyle

function addTouchActionRule(selector, signal) {
  touchActionRules.set(selector, (touchActionRules.get(selector) ?? 0) + 1)
  if (touchActionRules.get(selector) === 1) syncTouchActionStyle()
  signal?.addEventListener("abort", () => {
    const count = touchActionRules.get(selector)
    if (count <= 1) touchActionRules.delete(selector)
    else touchActionRules.set(selector, count - 1)
    syncTouchActionStyle()
  })
}

function syncTouchActionStyle() {
  if (touchActionRules.size === 0) {
    touchActionStyle?.remove()
    touchActionStyle = undefined
    return
  }

  if (!touchActionStyle) {
    touchActionStyle ??= document.createElement("style")
    touchActionStyle.className = "js-loaded"
    document.head.append(touchActionStyle)
  }

  touchActionStyle.textContent = `${[...touchActionRules.keys()].join(",")} { touch-action: none }`
}

const DEFAULTS = {
  signal: undefined,
  distance: 0,
  /** @type {boolean | number | Array<number>} */
  grid: false,
  throttle: true,
  subpixel: false,
  selector: undefined,
  ignore: undefined,
  applyTargetOffset: false,
  hoverScroll: false,

  /** @type {Function} */
  init: undefined,
  /** @type {Function} */
  start: undefined,
  /** @type {Function} */
  drag: undefined,
  /** @type {Function} */
  stop: undefined,
}

export class Dragger {
  static isDragging = false

  #isStarted = false
  offsetX = 0
  offsetY = 0

  /**
   * @param {string | HTMLElement} el
   * @param {DraggerOptions} [options]
   */
  constructor(el, options) {
    this.el = ensureElement(el)

    this.config = configure(DEFAULTS, options)

    this.start = this.config.start ?? noop
    this.drag = this.config.drag ?? noop
    this.stop = this.config.stop ?? noop

    const { cancel, signal } = new Canceller(options?.signal)
    this.cancel = cancel

    if (this.config.hoverScroll) {
      this.hoverScroll = new HoverScroll(this.el, this.config.hoverScroll)
    }

    if (this.config.selector) {
      this.config.selector = ensureScopeSelector(this.config.selector, this.el)
      addTouchActionRule(this.config.selector, signal)
    } else setTemp(this.el, { signal, style: { "touch-action": "none" } })

    let distX = 0
    let distY = 0

    const round = this.config.subpixel ? (val) => val : Math.round

    let getX = this.config.applyTargetOffset
      ? this.config.subpixel
        ? (x) => x - this.offsetX
        : (x) => round(x - this.offsetX)
      : round

    let getY = this.config.applyTargetOffset
      ? this.config.subpixel
        ? (y) => y - this.offsetY
        : (y) => round(y - this.offsetY)
      : round

    const { grid } = this.config

    if (grid) {
      const [gridX, gridY] = Array.isArray(grid) ? grid : [grid, grid]
      if (typeof gridX === "number") {
        const coordX = getX
        getX = (x) => {
          x = coordX(x)
          return x - (x % gridX)
        }
      }

      if (typeof gridY === "number") {
        const coordY = getY
        getY = (y) => {
          y = coordY(y)
          return y - (y % gridY)
        }
      }
    }

    const checkDistance =
      typeof this.config.distance === "number" && this.config.distance > 0
        ? (e) => {
            distX += e.movementX
            distY += e.movementY
            return (
              Math.abs(distX) > this.config.distance ||
              Math.abs(distY) > this.config.distance
            )
          }
        : () => true

    this.inited = new Map()
    this.dragged = new Map()

    let drag = (e) => {
      if (e.pressure === 0) return
      if (this.dragged.has(e.pointerId)) {
        this.drag(getX(e.x), getY(e.y), e, this.dragged.get(e.pointerId))
      } else if (
        this.inited.has(e.pointerId) &&
        checkDistance(e) &&
        start(e, this.inited.get(e.pointerId)) === false
      ) {
        stop(e)
      }
    }

    if (this.config.throttle) drag = repaintThrottle(drag)

    // Global listeners are only active during a drag interaction
    const dragHandler = (e) => drag(e)
    const stopHandler = (e) => stop(e)
    let globalListening = false
    let restoreIframes

    const addGlobalListeners = () => {
      if (globalListening) return
      globalListening = true
      globalThis.addEventListener("pointermove", dragHandler)
      globalThis.addEventListener("pointerup", stopHandler)
      globalThis.addEventListener("pointercancel", stopHandler)
      globalThis.addEventListener("contextmenu", stopHandler)
    }

    const removeGlobalListeners = () => {
      restoreIframes?.()
      restoreIframes = undefined
      if (!globalListening) return
      globalListening = false
      globalThis.removeEventListener("pointermove", dragHandler)
      globalThis.removeEventListener("pointerup", stopHandler)
      globalThis.removeEventListener("pointercancel", stopHandler)
      globalThis.removeEventListener("contextmenu", stopHandler)
    }

    const init = (e, target) => {
      // @ts-ignore
      drag.clear?.()

      this.isDragging = false
      Dragger.isDragging = false

      target = this.config.selector ? target : this.el

      if (target.dataset.asleep) return
      if (this.config.init?.(e, target) === false) return
      if (this.config.ignore && e.target.closest(this.config.ignore)) return

      this.inited.set(e.pointerId, target)
      try {
        e.target.setPointerCapture?.(e.pointerId)
      } catch (err) {
        console.log(err)
      }
      addGlobalListeners()
    }

    const start = (e, target) => {
      this.isDragging = true
      Dragger.isDragging = true

      restoreIframes?.()
      restoreIframes = suspendIframes()
      window.getSelection().removeAllRanges()

      this.dragged.set(e.pointerId, target)
      this.inited.delete(e.pointerId)

      distX = 0
      distY = 0
      this.fromX = round(e.x)
      this.fromY = round(e.y)
      if (this.config.applyTargetOffset) {
        const rect = target.getBoundingClientRect()
        this.offsetX = round(e.x - rect.x)
        this.offsetY = round(e.y - rect.y)
      }

      return this.start(getX(e.x), getY(e.y), e, target)
    }

    const stop = (e) => {
      const isAbort = e.type === "abort"
      if (!isAbort && !this.dragged.has(e.pointerId)) {
        this.inited.delete(e.pointerId)
        if (this.inited.size === 0 && this.dragged.size === 0) {
          removeGlobalListeners()
        }
        return
      }

      // @ts-ignore
      drag.clear?.()

      distX = 0
      distY = 0
      this.fromX = 0
      this.fromY = 0
      this.offsetX = 0
      this.offsetY = 0

      this.stop(
        getX(e.x ?? 0),
        getY(e.y ?? 0),
        e,
        this.dragged.get(e.pointerId ?? 0),
      )

      if (isAbort) {
        for (const [pointerId, target] of this.dragged) {
          target.releasePointerCapture?.(pointerId)
        }
        this.dragged.clear()
        this.inited.clear()
      } else {
        e.target.releasePointerCapture?.(e.pointerId)
        this.dragged.delete(e.pointerId)
        this.inited.delete(e.pointerId)
      }

      removeGlobalListeners()

      queueTask(() => {
        if (this.dragged.size > 0) return
        this.isDragging = false
        Dragger.isDragging = false
      })
    }

    // Only the pointerdown listener on the element is permanent
    listenEventMap({ signal }, this.el, {
      selector: this.config.selector,
      pointerdown: (e, target) => init(e, target),
    })

    signal?.addEventListener("abort", (e) => {
      stop(e)
      removeGlobalListeners()
    })
  }

  destroy() {
    this.hoverScroll?.destroy()
    this.cancel()
  }
}
