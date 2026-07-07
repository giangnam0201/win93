import { Trait } from "../Trait.js"
import { uid } from "../../uid.js"
import { watchResize } from "../../../lib/type/element/watchResize.js"
import { repaintThrottle } from "../../../lib/timing/repaintThrottle.js"
import { untilConnected } from "../../../lib/type/element/untilConnected.js"
import { Emittable } from "../../../lib/class/mixin/Emittable.js"

/**
 * @typedef {{
 *   renderElement?: (item: any, index: number) => HTMLElement | string,
 *   updateElement?: (el: HTMLElement, item: any, index: number) => void,
 *   signal?: AbortSignal,
 *   items?: any[],
 *   grid?: boolean,
 *   stepped?: boolean,
 *   itemHeight?: number,
 *   itemWidth?: number,
 *   buffer?: number,
 *   usePadding?: boolean,
 *   animatableParents?: string | string[],
 * }} VirtualizableOptions
 */

export class Virtualizable extends Emittable(Trait) {
  /** @type {Map<number, HTMLElement>} */
  renderedNodes = new Map()

  /**
   * @param {string | HTMLElement} el
   * @param {VirtualizableOptions} options
   */
  constructor(el, options) {
    super(el, options)

    const { signal } = this

    this.items = options.items
    this.grid = Boolean(options.grid)
    this.stepped = Boolean(options.stepped)
    this.itemHeight = options.itemHeight
    this.itemWidth = options.itemWidth
    this.buffer = Math.max(0, options.buffer ?? 5)
    this.usePadding = options.usePadding

    this.renderElement = options.renderElement ?? ((item) => item)
    this.updateElement = options.updateElement

    this.styles = getComputedStyle(this.el)

    const { animatableParents } = options

    if (this.grid) {
      watchResize(
        this.el,
        { signal, throttle: 60, skipAnimation: { animatableParents } },
        ({ width }) => {
          this.calculateItemsPerRow(width)
          this.update()
        },
      )
    } else {
      watchResize(
        this.el,
        { signal, throttle: 60, skipAnimation: { animatableParents } },
        () => this.update(),
      )
    }

    this.el.addEventListener(
      "scroll",
      repaintThrottle(() => this.update()),
      { signal, passive: true },
    )

    document.addEventListener(
      "focusin",
      () => (this.lastFocused = undefined), // Prevent stealing focus
      { signal },
    )

    this.init()
    this.appendStyles()
  }

  // MARK: items
  // ===========

  #items = []
  get items() {
    return this.#items
  }
  set items(items) {
    this.#items = items ?? []
    this.clear()
    if (this.inited) this.update()
    else this.init()
  }

  // MARK: styles
  // =============

  async appendStyles() {
    this.el.id ||= uid()
    this.css = document.createElement("style")

    this.css.textContent = this.usePadding
      ? /* css */ `
      #${this.el.id} {
        padding-top: calc(var(--space-top, 0px) + var(--padding-top, 0px));
        padding-bottom: calc(var(--space-bottom, 0px) + var(--padding-bottom, 0px));
      }`
      : /* css */ `
      #${this.el.id} {
        &::before {
          content: "";
          display: block;
          min-width: 100%;
          flex: 0 0 var(--space-top, 0);
          height: var(--space-top, 0);
          will-change: height;
          /* outline: 1px solid red; */
        }
        &::after {
          content: "";
          display: block;
          order: calc(Infinity);
          min-width: 100%;
          flex: 0 0 var(--space-bottom, 0);
          height: var(--space-bottom, 0);
          will-change: height;
          /* outline: 1px solid blue; */
        }
      }`

    document.head.append(this.css)
  }

  // MARK: initialization
  // =====================

  inited = false
  async init() {
    if (this.inited || this.items.length === 0) return
    this.inited = true
    this.renderedNodes.clear()
    await untilConnected(this.el)
    this.calculateItemsPerRow()
    this.update()
  }

  clear() {
    this.renderedNodes.clear()
    this.el.replaceChildren()
  }

  calculateItemsPerRow(width) {
    if (this.itemHeight === undefined) {
      const node = this.getElement(0)
      this.el.append(node)
      this.renderedNodes.set(0, node)
      const { height, width } = node.getBoundingClientRect()
      if (height === 0) return false
      this.itemHeight = height
      this.itemWidth ??= this.grid ? width : 0
    }

    width ??= this.el.clientWidth

    this.itemsPerRow =
      this.grid && this.itemWidth > 0 && width > 0
        ? Math.max(1, Math.floor(width / this.itemWidth))
        : 1
  }

  // MARK: getElement
  // ================

  lastFocused
  getElement(idx) {
    const item = this.items[idx]

    let node = this.renderedNodes.get(idx)

    if (node) {
      if (node === document.activeElement) this.lastFocused = idx
      this.updateElement?.(node, item, idx)
    } else {
      const itemContent = this.renderElement(item, idx)

      if (typeof itemContent === "string") {
        node = document.createElement("div")
        node.textContent = itemContent
      } else {
        node = itemContent
      }
    }

    this.emit("getElement", node, item, idx)

    return node
  }

  // MARK: scrollToElement
  // =====================

  scrollToElement(idx, options) {
    let el
    if (this.renderedNodes.has(idx)) {
      el = this.renderedNodes.get(idx)
    } else {
      this.el.scrollTop = this.itemHeight * (idx / this.itemsPerRow)
      this.update()
      el = this.renderedNodes.get(idx)
    }

    if (el) {
      el.scrollIntoView({
        block: this.styles.overflowY === "hidden" ? "start" : "center",
        inline: this.styles.overflowX === "hidden" ? "nearest" : "center",
        behavior: "instant",
        container: "nearest",
        ...options,
      })
      return el
    }
  }

  // MARK: update
  // ============

  update() {
    if (this.items.length === 0) return

    let { clientHeight } = this.el

    if (this.el.scrollHeight === clientHeight) {
      let isScrolling = false
      this.el.style.setProperty("--space-top", `0px`)
      this.el.style.setProperty("--space-bottom", `0px`)

      for (let i = this.renderedNodes.size, l = this.items.length; i < l; i++) {
        const el = this.getElement(i)
        this.renderedNodes.set(i, el)
        this.el.append(el)
        if (
          i % this.buffer === 0 &&
          this.el.scrollHeight > this.el.clientHeight
        ) {
          isScrolling = true
          break
        }
      }

      if (this.el.scrollHeight > this.el.clientHeight) {
        isScrolling = true
      }

      if (!isScrolling) return
      clientHeight = this.el.clientHeight
    }

    const { scrollTop } = this.el

    const totalRows = Math.ceil(this.items.length / this.itemsPerRow)

    const firstVisibleRow = Math.floor(scrollTop / this.itemHeight)
    const numVisibleRowsOnScreen = Math.ceil(clientHeight / this.itemHeight)

    // Determine the range of *rows* to render, including buffer
    const firstRowToRender = Math.max(0, firstVisibleRow - this.buffer)
    const lastRowToRenderPlusOne = Math.min(
      totalRows,
      firstVisibleRow + numVisibleRowsOnScreen + this.buffer,
    )

    // Convert row range to item range
    const renderStartIndex = firstRowToRender * this.itemsPerRow
    const renderEndIndex = Math.min(
      this.items.length,
      lastRowToRenderPlusOne * this.itemsPerRow,
    )

    const paddingTop = firstRowToRender * this.itemHeight
    const paddingBottom = Math.max(
      0,
      (totalRows - lastRowToRenderPlusOne) * this.itemHeight,
    )

    if (!Number.isFinite(paddingTop) || !Number.isFinite(paddingBottom)) return

    this.el.style.setProperty("--space-top", `${paddingTop}px`)
    this.el.style.setProperty("--space-bottom", `${paddingBottom}px`)

    const newNodesToDisplayOrdered = []
    const nextRenderedNodesMap = new Map()

    // Prepare the list of nodes that *should* be visible and their map.
    for (let i = renderStartIndex; i < renderEndIndex; i++) {
      const node = this.getElement(i)
      newNodesToDisplayOrdered.push(node)
      nextRenderedNodesMap.set(i, node)
    }

    // Remove nodes that are in the current DOM but not in the new set.
    for (const [index, node] of this.renderedNodes) {
      if (!nextRenderedNodesMap.has(index)) {
        node.remove()
      }
    }

    // Add/reorder nodes
    let currentNode = this.el.firstChild
    for (let i = 0; i < newNodesToDisplayOrdered.length; i++) {
      const desiredNode = newNodesToDisplayOrdered[i]

      if (currentNode === desiredNode) {
        // Node is already in the correct position, do nothing.
        currentNode = currentNode.nextSibling
      } else if (currentNode) {
        // The desiredNode needs to be here.
        // If it's already in the container, insertBefore will move it.
        // If it's new, it will be inserted.
        this.el.insertBefore(desiredNode, currentNode)
      } else {
        // No more existing children in contentWrapper, append the rest.
        this.el.append(desiredNode)
      }
    }

    // Remove any trailing DOM nodes that are not in newNodesToDisplayOrdered.
    while (currentNode) {
      const node = currentNode
      currentNode = currentNode.nextSibling
      node.remove()
    }

    this.renderedNodes.clear()
    this.renderedNodes = nextRenderedNodesMap

    if (this.lastFocused !== undefined) {
      const node = this.renderedNodes.get(this.lastFocused)
      node?.focus({ preventScroll: true })
    }
  }

  // MARK: destroy
  // =============

  destroy() {
    super.destroy()
    this.css?.remove()
    this.css = undefined
    this.el.style.removeProperty("--space-top")
    this.el.style.removeProperty("--space-bottom")
    this.renderedNodes.clear()
  }
}

/**
 * Creates a virtual scroller for a list of items.
 * @param {string | HTMLElement} el
 * @param {VirtualizableOptions} options
 */
export function virtualizable(el, options) {
  return new Virtualizable(el, options)
}
