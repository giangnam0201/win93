import { Component } from "../../api/gui/Component.js"
import { getRects } from "../../lib/dom/getRects.js"
import { forceRectLayout } from "../../lib/algo/forceRectLayout.js"
import { animateTo } from "../../lib/type/element/animate.js"

export const PIVOTS = {
  CENTER: "center",
  TOP_LEFT: "top-left",
  TOP_RIGHT: "top-right",
  BOTTOM_RIGHT: "bottom-right",
  BOTTOM_LEFT: "bottom-left",
}

export const PIVOT_ORDER = [
  PIVOTS.CENTER,
  PIVOTS.TOP_LEFT,
  PIVOTS.TOP_RIGHT,
  PIVOTS.BOTTOM_LEFT,
  PIVOTS.BOTTOM_RIGHT,
]

export class WorkspaceComponent extends Component {
  static plan = {
    tag: "ui-workspace",
    active: true,
  }

  /** @type {import("./dock.js").DockComponent} */
  dock

  tracker = []
  lastPivotIndex = -1

  /**
   * Returns a Map of pivot -> count from active dialogs.
   * @returns {Map<string, number> | undefined}
   */
  getPivotCounts() {
    const counts = new Map(PIVOT_ORDER.map((p) => [p, 0]))
    for (const dialogEl of this.tracker) {
      if (dialogEl.pivot) {
        counts.set(dialogEl.pivot, (counts.get(dialogEl.pivot) ?? 0) + 1)
      }
    }
    return counts
  }

  /**
   * Finds the best pivot for a new dialog.
   * @returns {string | undefined}
   */
  findAvailablePivot() {
    // if (this.tracker.size > 5) return "center"

    const counts = this.getPivotCounts()

    // Prefer center if no dialogs there
    if (counts.get(PIVOTS.CENTER) === 0) {
      this.lastPivotIndex = 0
      return PIVOTS.CENTER
    }

    // Find minimum count
    let minCount = Infinity
    for (const count of counts.values()) {
      if (count < minCount) minCount = count
    }

    // Return first pivot with minimum count, starting from after the last assigned pivot
    // This ensures proper round-robin cycling when counts are equal
    const len = PIVOT_ORDER.length
    for (let i = 0; i < len; i++) {
      const idx = (this.lastPivotIndex + 1 + i) % len
      const pivot = PIVOT_ORDER[idx]
      if (counts.get(pivot) === minCount) {
        this.lastPivotIndex = idx
        return pivot
      }
    }

    return PIVOTS.CENTER
  }

  cycleDialogUp() {
    this.dock ??= document.querySelector("ui-dock")
    if (!this.dock) return

    if (this.dock.children.length === 0) return

    const children = Array.from(this.dock.children)

    let activeItem
    for (const item of children) {
      if (item.ariaPressed === "true") activeItem = item
    }

    if (!activeItem) return

    const index = children.indexOf(activeItem)
    const nextIndex = (index + 1) % children.length
    const nextItem = children[nextIndex]

    nextItem.dispatchEvent(new PointerEvent("pointerdown"))
  }

  cycleDialogDown() {
    this.dock ??= document.querySelector("ui-dock")
    if (!this.dock) return

    if (this.dock.children.length === 0) return

    const children = Array.from(this.dock.children)

    let activeItem
    for (const item of children) {
      if (item.ariaPressed === "true") activeItem = item
    }

    if (!activeItem) return

    const index = children.indexOf(activeItem)
    const nextIndex = (index - 1 + children.length) % children.length
    const nextItem = children[nextIndex]

    nextItem.dispatchEvent(new PointerEvent("pointerdown"))
  }

  async autoOrganize() {
    /** @type {any[]} */
    const dialogs = Array.from(this.querySelectorAll("ui-dialog")).filter(
      (el) =>
        !el.classList.contains("hide") &&
        !el.hasAttribute("maximized") &&
        /** @type {HTMLElement} */ (el).style.display !== "none",
    )

    if (dialogs.length === 0) return

    const rects = await getRects(dialogs, { relative: true, root: this })

    const center = {
      x: this.clientWidth / 2,
      y: this.clientHeight / 2,
    }

    const bounds = {
      x: 0,
      y: 0,
      width: this.clientWidth,
      height: this.clientHeight,
    }

    forceRectLayout(rects, { center, bounds })

    const animations = []
    for (const rect of rects) {
      /** @type {any} */
      const dialog = rect.target
      const x = Math.round(rect.x)
      const y = Math.round(rect.y)
      animations.push(
        animateTo(dialog, { translate: `${x}px ${y}px` }).then(() => {
          dialog.x = x
          dialog.y = y
        }),
      )
    }

    await Promise.all(animations)

    /** @type {any[]} */
    const sorted = dialogs.sort((a, b) => a.y - b.y)
    let z =
      Number(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--z-dialog",
        ),
      ) || 100

    for (const dialog of sorted) {
      dialog.z = z++
    }
  }
}

export const workspace = Component.define(WorkspaceComponent)

// overlapping
// tiled

export class WorkspacesComponent extends Component {
  static plan = {
    tag: "ui-workspaces",
  }

  /** @type {WorkspaceComponent} */
  get current() {
    return this.querySelector("ui-workspace[active]")
  }

  render() {
    if (this.childNodes.length > 0) return
    return { tag: "ui-workspace" }
  }
}

export const workspaces = Component.define(WorkspacesComponent)
