import { Trait } from "../Trait.js"
import { getNextZIndex, setTopElement } from "../../../lib/dom/zIndex.js"
import { Dragger } from "../../../lib/dom/Dragger.js"
import { setTemp } from "../../../lib/type/element/setTemp.js"
import { removeItem } from "../../../lib/type/array/removeItem.js"
import { noop } from "../../../lib/type/function/noop.js"
import { configure } from "../../configure.js"
import { measure } from "../../../lib/type/element/measure.js"

/**
 * @typedef {(x: number, y: number, items: any[]) => void | false} MovableCallback
 */

const DEFAULTS = {
  /** @type {AbortSignal} */
  signal: undefined,
  distance: 0,
  /** @type {boolean | number | Array<number>} */
  grid: false,
  throttle: true,
  subpixel: false,
  selector: undefined,
  ignore: "input,button,textarea,[contenteditable],[contenteditable] *",
  hoverScroll: false,
  applyTargetOffset: true,
  zIndexSelector: undefined,
  handlerSelector: undefined,
  moveToTop: undefined,
  useSelection: true,
  skipSize: false,

  /** @type {MovableCallback} */
  start: noop,
  /** @type {MovableCallback} */
  drag: noop,
  /** @type {MovableCallback} */
  stop: noop,

  /** @type {any} */
  style: {
    position: "fixed",
    margin: 0,
    top: 0,
    left: 0,
    bottom: "auto",
    right: "auto",
    // minWidth: "initial",
    // minHeight: "initial",
    // maxWidth: "initial",
    // maxHeight: "initial",
  },
}

export class Movable extends Trait {
  static name = "Movable"

  enabled = true

  /**
   * @param {string | HTMLElement} el
   * @param {Partial<DEFAULTS>} [options]
   */
  constructor(el, options) {
    super(el, options)

    this.config = configure(DEFAULTS, options)

    this.start = this.config.start
    this.drag = this.config.drag
    this.stop = this.config.stop

    this.targets = new WeakMap()
    this.items = []
    const { signal } = this
    const tempStyle = { signal, style: this.config.style }

    const {
      distance,
      grid,
      throttle,
      subpixel,
      selector,
      ignore,
      hoverScroll,
      applyTargetOffset,
    } = this.config

    this.dragger = new Dragger(this.el, {
      signal,
      distance,
      grid,
      throttle,
      subpixel,
      selector,
      ignore,
      hoverScroll,
      applyTargetOffset,
    })

    this.dragger.start = (x, y, e, target) => {
      if (!this.enabled) return false
      if (
        this.config.handlerSelector &&
        !e.target.closest(this.config.handlerSelector)
      ) {
        return false
      }

      /** @type {Element[]} */
      let targets

      if (this.config.useSelection) {
        const selectable = this.el[Trait.INSTANCES]?.selectable
        if (selectable) {
          selectable.ensureSelected(target)
          const { elements } = selectable
          targets = elements
        } else targets = [target]
      } else targets = [target]

      this.items.length = 0

      measure(targets).then((rects) => {
        if (this.start(x, y, rects) === false) return

        for (const rect of rects) {
          const { target } = rect

          if (this.targets.has(target)) {
            this.items.push(this.targets.get(target))
            if (this.config.moveToTop !== false) {
              setTopElement(target, this.config.zIndexSelector)
            }

            continue
          }

          const hasCoordProps = "x" in target && "y" in target

          const style = options?.skipSize
            ? {}
            : { width: rect.width + "px", height: rect.height + "px" }

          if (this.config.moveToTop !== false) {
            style.zIndex = getNextZIndex(this.config.zIndexSelector)
          }

          if (hasCoordProps) {
            target.x = x
            target.y = y
          } else style.translate = `${x}px ${y}px`

          const restoreStyles = setTemp(target, tempStyle, { style })

          const item = {
            ...rect,
            hasCoordProps,
            restore: () => {
              restoreStyles()
              removeItem(this.items, item)
              this.targets.delete(target)
            },
          }

          this.targets.set(target, item)
          this.items.push(item)
        }
      })
    }

    this.dragger.drag = (x, y) => {
      if (this.drag(x, y, this.items) === false) return

      for (const { target, hasCoordProps } of this.items) {
        if (hasCoordProps) {
          target.x = x
          target.y = y
        } else target.style.translate = `${x}px ${y}px`
      }
    }

    this.dragger.stop = (x, y) => {
      this.stop(x, y, this.items)
    }
  }
}

/**
 * @param {string | HTMLElement} el
 * @param {Partial<DEFAULTS>} [options]
 */
export function movable(el, options) {
  return new Movable(el, options)
}
