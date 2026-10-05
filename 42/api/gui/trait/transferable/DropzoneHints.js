import { getRects } from "../../../../lib/dom/getRects.js"
import { inRect } from "../../../../lib/geometry/point.js"
import { Canceller } from "../../../../lib/class/Canceller.js"
import { system } from "../../../system.js"
import { unproxy } from "../../../../lib/type/any/unproxy.js"
import { untilRepaint } from "../../../../lib/timing/untilRepaint.js"
import { appendCSS } from "../../../../lib/dom/appendCSS.js"
import { sleep } from "../../../../lib/timing/sleep.js"
import { untilNextRepaint } from "../../../../lib/timing/untilNextRepaint.js"

function copyElement(item, originDropzone) {
  const copy = item.target.cloneNode(true)
  originDropzone?.reviveTarget(copy)
  copy.id += "-copy"
  item.id = copy.id
  return copy
}

const dragoverEl = document.createElement("div")
dragoverEl.className = "dragover-outline"

export class DropzoneHint {
  constructor(el, options) {
    this.el = el
    this.rects = []

    this.config = { ...options }

    this.config.orientation ??= this.el.getAttribute("aria-orientation")

    if (!this.config.orientation) {
      this.config.orientation = "horizontal"
      this.config.freeAxis ??= true
    }

    this.isHorizontal = this.config.orientation === "horizontal"
    this.isVertical = this.config.orientation === "vertical"
    this.freeAxis = this.config.freeAxis

    const styles = getComputedStyle(this.el)
    this.columnGap = Number.parseInt(styles.columnGap, 10) | 0
    this.rowGap = Number.parseInt(styles.rowGap, 10) | 0

    const halfColGap = this.columnGap / 2
    const halfRowGap = this.rowGap / 2
    this.gaps = {
      top: halfRowGap,
      bottom: halfRowGap,
      left: halfColGap,
      right: halfColGap,
    }
  }

  init(_) {}

  async scan(items, cb) {
    this.rects.length = 0
    this.scanReady = getRects(this.config.selector, {
      root: this.el,
      intersecting: true,
    }).then((rects) => {
      if (items && cb) {
        for (const rect of rects) {
          if (cb(rect) !== false) this.rects.push(rect)
        }
      } else {
        this.rects.push(...rects)
      }

      return this.rects
    })

    return this.scanReady
  }

  faintTargets(_x, _y) {}
  faintTarget(_) {}
  reviveTarget(_) {}

  activate(x, y) {
    this.el.style.pointerEvents = "auto"
    this.items = system.transfer.items
    this.isOriginDropzone = this.items.dropzoneId === this.el.id

    const { signal, cancel } = new Canceller(this.config.signal)
    this.signal = signal
    this.cancel = cancel

    if (this.isOriginDropzone) {
      queueMicrotask(async () => {
        if (this.faintTargets) await this.faintTargets(x, y)
        else for (const { target } of this.items) this.faintTarget(target)
        if (system.transfer.currentZone === this) {
          await this.enter(x, y)
          this.dragover(x, y)
        }
      })
    }
  }

  halt() {
    this.el.style.removeProperty("pointer-events")
    this.cancel?.()
    this.removeDragover()

    if (this.isOriginDropzone) {
      if (system.transfer.effect === "move") {
        this.removeItems()
      }
    }

    if (this.items?.length > 0) {
      for (const { target } of this.items) if (target) this.reviveTarget(target)
    }

    this.rects.length = 0
    this.newIndex = undefined
    this.items = undefined
    this.cancel = undefined
    this.signal = undefined
    this.scanReady = undefined
  }

  dragover(x, y) {
    if (!this.items?.length) return
    const [first] = this.items

    this.newIndex = undefined

    if (this.isVertical) {
      y -= first.offsetY - first.height / 2
      for (let i = 0, l = this.rects.length; i < l; i++) {
        const rect = this.rects[i]
        if (
          y >= rect.top + this.gaps.top &&
          y <= rect.bottom + this.gaps.bottom
        ) {
          this.newIndex = rect.index
          break
        }
      }
    } else if (this.isHorizontal) {
      x -= first.offsetX - first.width / 2
      for (let i = 0, l = this.rects.length; i < l; i++) {
        const rect = this.rects[i]
        if (
          x >= rect.left + this.gaps.left &&
          x <= rect.right + this.gaps.right
        ) {
          this.newIndex = rect.index
          break
        }
      }
    } else {
      x -= first.offsetX - first.width / 2
      y -= first.offsetY - first.height / 2
      const point = { x, y }
      for (let i = 0, l = this.rects.length; i < l; i++) {
        const rect = this.rects[i]
        if (inRect(point, rect, this.gaps)) {
          this.newIndex = rect.index
          break
        }
      }
    }
  }

  async removeDragover() {
    this.el.classList.remove("dragover")
    dragoverEl.remove()
    await untilNextRepaint()
  }

  async enter(_x, _y) {
    this.newIndex = undefined
    this.el.classList.add("dragover")
    if (this.config.dragoverOutline) this.el.after(dragoverEl)
    await (this.scanReady === undefined ? this.scan() : this.scanReady)
  }

  leave() {
    this.removeDragover()
  }

  revert() {}

  removeItem(item, index) {
    if (item.removed) return
    if (this.config.list) this.config.list.splice(index, 1)
    else item.target.remove()
  }

  removeItems() {
    const removed = []
    for (const item of this.items) {
      let { index } = item
      for (const remIndex of removed) if (index > remIndex) index--
      removed.push(index)
      this.removeItem(item, index)
    }
  }

  async import() {
    return this.config.import?.(
      {
        items: system.transfer.items,
        effect: system.transfer.effect,
        coord: system.transfer.coord,
        kind: system.transfer.items.kind ?? [],
        index: this.newIndex,
        isOriginDropzone: this.isOriginDropzone,
        dropzone: this,
        ...system.transfer.items.details,
      },
      system.transfer,
    )
  }

  async drop() {
    this.removeDragover()

    const { effect } = system.transfer

    const originDropzone = this.isOriginDropzone
      ? this
      : this.items.originDropzone

    const { selector, list } = this.config
    const droppedsList = list ? [] : undefined
    const droppedsFragment = list
      ? undefined
      : document.createDocumentFragment()

    const isMove = effect === "move"
    const isCopy = effect === "copy"

    const removed = []
    for (const item of this.items) {
      if (isMove) originDropzone?.reviveTarget(item.target)
      item.dropped = isMove

      let { index } = item

      if (isMove) {
        for (const remIndex of removed) if (index > remIndex) index--
        removed.push(index)
        if (this.isOriginDropzone && this.newIndex > index) this.newIndex--
      }

      if (list) {
        if (this.isOriginDropzone && isMove) {
          list.splice(index, 1)
          item.removed = true
        } else {
          item.target.classList.add("hide")
        }

        droppedsList.push(isCopy ? unproxy(item.data) : item.data)
      } else {
        item.removed = isMove
        if (item.target) {
          droppedsFragment.append(
            isMove ? item.target : copyElement(item, originDropzone),
          )
        }
      }
    }

    if (list) {
      if (this.newIndex === undefined) {
        list.push(...droppedsList)
        this.config.indexChange?.(list.length)
      } else {
        list.splice(this.newIndex, 0, ...droppedsList)
        this.config.indexChange?.(this.newIndex)
      }
    } else if (this.newIndex === undefined) {
      this.el.append(droppedsFragment)
    } else {
      const indexedElement = this.el.querySelector(
        `${selector}:nth-child(${this.newIndex + 1})`,
      )
      this.el.insertBefore(droppedsFragment, indexedElement)
    }
  }

  beforeAdoptAnimation() {}
}

delete DropzoneHint.prototype.faintTargets

//

// MARK: Invisible
// ---------------

export class InvisibleDropzoneHint extends DropzoneHint {
  faintTarget(target) {
    target.classList.add("invisible")
  }

  reviveTarget(target) {
    target.classList.remove("invisible")
  }
}

// MARK: Dim
// ---------

export class DimDropzoneHint extends DropzoneHint {
  faintTarget(target) {
    target.classList.add("dropzone-item--dim", "opacity-half")
  }

  reviveTarget(target) {
    target.classList.remove("dropzone-item--dim", "opacity-half")
  }
}

// MARK: Arrow
// -----------

export class ArrowDropzoneHint extends DropzoneHint {
  async init() {
    // TODO: make better way to get picto svg
    const { picto } = await import("../../../../ui/media/picto.js")
    const pictoArrow = picto({ value: "down" })
    document.documentElement.append(pictoArrow)
    await pictoArrow.ready

    this.arrow = /** @type {SVGSVGElement} */ (pictoArrow.firstElementChild)
    pictoArrow.remove()
    this.arrow.setAttribute("class", "dropzone__arrow")
    this.arrow.style.position = "fixed"
    this.arrow.style.top = "0"
    this.arrow.style.left = "0"
    this.arrow.style.top = "calc(-0.5 * var(--picto-size))"
    this.arrow.style.left = "calc(-0.5 * var(--picto-size))"
  }

  faintTarget(target) {
    target.classList.add("opacity-half")
  }

  reviveTarget(target) {
    target.classList.remove("opacity-half")
  }

  async enter() {
    await super.enter()
    this.arrow.style.rotate = this.isVertical ? "-90deg" : "none"
    this.el.append(this.arrow)
    this.arrow.style.translate = `-200vw -200vh`
  }

  halt() {
    super.halt()
    this.arrow.remove()
  }

  leave() {
    super.leave()
    this.arrow.remove()
  }

  async drop() {
    await super.drop()
    this.arrow.remove()
  }

  dragover(x, y) {
    super.dragover(x, y)
    if (this.rects.length === 0) return

    this.config.arrowOffset ??= 2

    if (this.newIndex === undefined) {
      const rect = this.rects.at(-1)
      if (this.isVertical) {
        x = rect.x - this.config.arrowOffset
        y = rect.bottom + this.gaps.bottom
      } else {
        x = rect.right + this.gaps.right
        y = rect.y - this.config.arrowOffset
      }
    } else {
      const rect = this.rects[this.newIndex]
      if (this.isVertical) {
        x = rect.x - this.config.arrowOffset
        y = rect.y + this.gaps.top
      } else {
        x = rect.x + this.gaps.left
        y = rect.y - this.config.arrowOffset
      }
    }

    this.arrow.style.translate = `${x}px ${y}px`
  }
}

// MARK: Slide
// -----------

export class SlideDropzoneHint extends DropzoneHint {
  constructor(el, options) {
    super(el, { ...options })
  }

  activate(x, y) {
    super.activate(x, y)

    const [first] = this.items

    if (this.isVertical) {
      const blank =
        first.height + first.marginTop + first.marginBottom + this.rowGap
      this.blank = `0 ${blank}px`
    } else {
      const blank =
        first.width + first.marginLeft + first.marginRight + this.columnGap
      this.blank = `${blank}px 0`
    }

    const { signal } = this
    const cssOptions = { signal }

    this.css = {
      global: appendCSS(cssOptions),
      blank: appendCSS(cssOptions),
      dragover: appendCSS(cssOptions),
      transition: appendCSS(cssOptions),
    }

    const speed = this.config.animationSpeed

    this.ignoreDragover = false

    this.css.transition.update(`
      ${this.config.selector} {
        transition:
          margin-right ${speed}ms ease-in-out,
          translate ${speed}ms ease-in-out !important;
      }`)
  }

  async faintTargets() {
    this.ignoreDragover = true

    this.css.transition.disable()
    const rect = this.el.getBoundingClientRect()
    this.css.global.update(`
      #${this.el.id} {
        height: ${rect.height}px !important;
        width: ${rect.width}px !important;
      }`)

    const { selector } = this.config
    const enterCss = []
    let offset = 0
    let previousY

    // Get all visible items bounding rects and save css with empty holes
    // ------------------------------------------------------------------
    await this.scan(this.items, (rect) => {
      if (previousY !== rect.y) offset = 0
      previousY = rect.y

      for (const item of this.items) {
        if (item.target.id === rect.target.id) {
          const i = rect.index + 1
          let blank
          if (this.isVertical) {
            offset +=
              item.height + item.marginTop + item.marginBottom + this.rowGap
            blank = `0 ${offset}px`
          } else {
            offset +=
              item.width + item.marginLeft + item.marginRight + this.columnGap
            blank = `${offset}px 0`
          }

          enterCss.push(`
            ${selector}:nth-child(n+${i}) {
              translate: ${blank};
            }`)
          rect.target.classList.add("hide")
          return false
        }
      }
    })

    // Update bounding rects without dragged items
    // Use getBoundingClientRect to prevent flickering
    // -----------------------------------------------
    for (const item of this.rects) {
      Object.assign(item, item.target.getBoundingClientRect().toJSON())
    }

    // Animate empty holes
    // -------------------
    this.css.blank.update(enterCss.join("\n"))
    await untilRepaint()
    this.css.transition.enable()
    this.css.blank.disable()

    this.ignoreDragover = false
  }

  faintTarget(target) {
    target.classList.add("hide")
  }
  reviveTarget(target) {
    target.classList.remove("hide")
  }

  async enter() {
    await super.enter()
    this.css.dragover.update("")
    this.css.dragover.enable()
  }

  leave() {
    super.leave()
    this.css.dragover.update("")
    this.css.dragover.disable()
  }

  dragover(x, y) {
    super.dragover(x, y)

    if (this.ignoreDragover) return

    if (this.newIndex === undefined) {
      this.css.dragover.update("")
    } else {
      this.css.dragover.update(`
        ${this.config.selector}:nth-child(n+${this.newIndex + 1}) {
          translate: ${this.blank};
        }`)
    }
  }

  revert() {
    super.revert()
    this.css.dragover.disable()
    this.css.blank.enable()
  }

  async drop() {
    await super.drop()
    this.css.blank.disable()
    this.css.dragover.disable()
    this.css.transition.disable()
  }

  async beforeAdoptAnimation(adopteds) {
    if (this.newIndex === undefined) return

    let n = this.newIndex + 1

    this.css.blank.enable()
    this.css.blank.update(`
      ${this.config.selector}:nth-child(n+${n}) {
        translate: ${this.blank};
      }`)

    await untilRepaint()
    this.css.transition.enable()

    if (!adopteds?.length) {
      this.css.blank.update("")
      await sleep(this.config.animationSpeed)
      return
    }

    n = this.newIndex + this.items.length

    let blank
    if (this.isVertical) {
      let { marginTop, marginBottom } = getComputedStyle(adopteds.at(0).target)
      if (adopteds.at(0) !== adopteds.at(-1)) {
        marginBottom = getComputedStyle(adopteds.at(-1).target).marginBottom
      }

      const mTop = Number.parseInt(marginTop, 10) | 0
      const mBottom = Number.parseInt(marginBottom, 10) | 0

      const height =
        this.columnGap +
        mTop +
        mBottom +
        adopteds.at(-1).bottom -
        adopteds.at(0).top

      blank = `0 ${height}px`
    } else {
      let { marginLeft, marginRight } = getComputedStyle(adopteds.at(0).target)
      if (adopteds.at(0) !== adopteds.at(-1)) {
        marginRight = getComputedStyle(adopteds.at(-1).target).marginRight
      }

      const mLeft = Number.parseInt(marginLeft, 10) | 0
      const mRight = Number.parseInt(marginRight, 10) | 0

      const width =
        this.columnGap +
        mLeft +
        mRight +
        adopteds.at(-1).right -
        adopteds.at(0).left

      blank = `${width}px 0`
    }

    this.css.blank.update(`
      ${this.config.selector}:nth-child(n+${n}) {
        translate: ${blank};
      }`)
  }
}
