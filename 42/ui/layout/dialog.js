/* eslint-disable max-depth */
/* eslint-disable complexity */
import "../media/picto.js"
import { PIVOTS } from "../desktop/workspaces.js"
import { Component } from "../../api/gui/Component.js"
import { movable } from "../../api/gui/trait/movable.js"
import { resizable } from "../../api/gui/trait/resizable.js"
import { repaintThrottle } from "../../lib/timing/repaintThrottle.js"

import { configure } from "../../api/configure.js"
import { toPlanObject } from "../../api/gui/render.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { until } from "../../lib/event/on.js"
import { uid } from "../../api/uid.js"
import { focusInside } from "../../lib/dom/focus.js"
import { isErrorLike } from "../../lib/type/any/isErrorLike.js"
import { normalizeError } from "../../lib/type/error/normalizeError.js"
import { saveStyles, setTemp } from "../../lib/type/element/setTemp.js"
import { isURLImage } from "../../lib/syntax/url/isURLImage.js"
import { animateTo } from "../../lib/type/element/animate.js"
import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { untilIframeEditable } from "../../lib/timing/untilIframeEditable.js"
import { logger } from "../../api/logger.js"
import { noop } from "../../lib/type/function/noop.js"
import { getDesktopRealm } from "../../api/env/realm/getDesktopRealm.js"
import { getFormData } from "../../lib/type/element/getFormData.js"
import { setFormData } from "../../lib/type/element/setFormData.js"
import { untilTreeReady } from "../../api/gui/untilTreeReady.js"
import { measure } from "../../lib/type/element/measure.js"
import { measureCSS } from "../../lib/cssom/measureCSS.js"
import { positionable } from "../../api/gui/trait/positionable.js"
import { keep } from "../../api/keep.js"
import { defer } from "../../lib/type/promise/defer.js"
import { sleep } from "../../lib/timing/sleep.js"
import { Emittable } from "../../lib/class/mixin/Emittable.js"
import { system } from "../../api/system.js"

/**
 * @import {App} from "../../api/os/App.js"
 * @import {Plan} from "../../api/gui/render.js"
 * @import {PictoComponent} from "../media/picto.js"
 * @import {WorkspaceComponent} from "../desktop/workspaces.js"
 */

const CSS_SUPPORTS_ROUND = CSS.supports("translate", "round(50%, 1px) 0")

const _axis = Symbol("Dialog.axis")
const _size = Symbol("Dialog.size")

let zDialog

const marginMeasure = measureCSS("--dialog-max-size-margin", { live: true })

export const dialogsState = system.env?.USER
  ? await keep("~/config/dialogs.json5")
  : {}

export const measures = {
  header: undefined,
}

function getHeaderOffset(el) {
  if (measures.header !== undefined) return measures.header
  const paddingTop = measureCSS(el, "padding-top")
  const borderTopWidth = measureCSS(el, "border-top-width")
  measures.header = paddingTop + borderTopWidth
  return measures.header
}

function tempMinWidth(dialog) {
  return setTemp(dialog.footerEl, {
    style: {
      overflow: "clip",
      width: "0px",
    },
  })
}

const DIALOG_OPTIONS = [
  "x",
  "y",
  "width",
  "height",

  "modal",
  "stealFocus",
  "clear",
  "inset",

  "label",
  "picto",
  "header",
  "footer",

  "resizable",
  "maximizable",
  "minimizable",
  "maximized",
  "dockable",
  "pivot",
  "pivotKind",
  "geometryKind",
  "workspace",

  "runtimeDefined",
  "saveRuntimeDefined",
  "skipSave",

  "beforeAgree",
  "agree",
  "afterAgree",
  "beforeDecline",
  "decline",
  "afterDecline",
]

export function extractDialogOptions(options, filter) {
  const dialogOptions = options.dialog ?? {}
  delete options.dialog

  for (const key of DIALOG_OPTIONS) {
    if (key in options) {
      if (filter?.includes(key)) continue
      dialogOptions[key] ??= options[key]
      delete options[key]
    }
  }

  return dialogOptions
}

/* MARK: dialog
--------------- */

/**
 * @param {Plan & {modal?: boolean, opener?: Element, workspace?: WorkspaceComponent}} plan
 * @param {{contained?: boolean, workspace?: WorkspaceComponent}} [options]
 * @returns {Promise<DialogComponent>}
 */
export async function dialog(plan, options) {
  if (options?.contained !== true) {
    const desktopRealm = getDesktopRealm()
    if (desktopRealm !== window && desktopRealm.sys42?.dialog) {
      plan = toPlanObject(plan)
      plan.opener ??= document.activeElement
      return desktopRealm.sys42?.dialog(plan, options)
    }
  }

  const el = new DialogComponent(plan)

  if (plan.modal) {
    document.documentElement.append(el)
  } else {
    const workspace = plan.workspace ?? options?.workspace
    if (workspace) el.workspace = workspace
    el.workspace.append(el)
  }

  await el.ready
  return el
}

/** @returns {WorkspaceComponent} */
function ensureWorkspace() {
  let workspace = /** @type {WorkspaceComponent} */ (
    document.querySelector("ui-workspace[active]")
  )

  if (workspace) return workspace

  workspace = /** @type {WorkspaceComponent} */ (
    document.querySelector("ui-workspace")
  )
  if (workspace) {
    workspace.setAttribute("active", "true")
    return workspace
  }

  const workspaces = document.createElement("ui-workspaces")
  workspace = /** @type {WorkspaceComponent} */ (
    document.createElement("ui-workspace")
  )
  workspace.setAttribute("active", "true")
  workspaces.append(workspace)
  document.body.append(workspaces)
  return workspace
}

/* MARK: DialogComponent
------------------------ */

export class DialogComponent extends Emittable(Component) {
  /** @type {App} */
  app

  /** @type {Function} */
  minimize

  /** @type {Function} */
  unminimize

  /** @type {Function} */
  contextMenu

  /** @type {HTMLElement} */
  headerEl
  /** @type {HTMLElement} */
  titleEl
  /** @type {PictoComponent} */
  pictoEl
  /** @type {HTMLElement} */
  titleTextEl
  /** @type {HTMLElement} */
  bodyEl
  /** @type {HTMLElement} */
  footerEl
  /** @type {HTMLElement} */
  contentEl
  /** @type {HTMLIFrameElement} */
  iframeEl
  /** @type {HTMLButtonElement} */
  maximizeButtonEl
  /** @type {HTMLElement} */
  menubarEl
  /** @type {HTMLElement} */
  openerEl
  /** @type {HTMLElement} */
  backdropEl

  /** @type {boolean} */
  animateMaximize

  /** @type {string} */
  sound
  /** @type {string} */
  icon

  #workspace
  get workspace() {
    if (this.#workspace) return this.#workspace
    this.#workspace = ensureWorkspace()
    return this.#workspace
  }

  set workspace(workspace) {
    this.#workspace = workspace
  }

  get tracker() {
    return this.workspace.tracker
  }

  static plan = {
    tag: "ui-dialog",
    role: "dialog",
    id: true,
    props: {
      active: true,
      maximized: true,
      pivot: true,
      pivotKind: true,
      geometryKind: true,
    },
    skipRender: [
      "content",
      "beforeContent",
      "afterContent",

      "width",
      "height",

      "label",
      "picto",
      "header",
      "body",
      "footer",

      "opener",

      "modal",
      "stealFocus",
      "clear",
      "inset",

      "buttons",

      "maximized",

      "resizable",
      "maximizable",
      "minimizable",
      "dockable",
      "closable",

      "runtimeDefined",
      "saveRuntimeDefined",
      "skipSave",

      "beforeAgree",
      "agree",
      "afterAgree",
      "beforeDecline",
      "decline",
      "afterDecline",

      "randomPosition",

      // "sound",
      // "icon",
    ],
  }

  get title() {
    return this.titleTextEl.textContent
  }
  set title(value) {
    this.titleTextEl.textContent = value
    dispatch(this, "ui:dialog.title-change", { detail: value })
  }

  // Alias for title
  get label() {
    return this.title
  }
  set label(value) {
    this.title = value
  }

  get picto() {
    return this.pictoEl.value
  }
  set picto(value) {
    this.pictoEl.ready.then(() => {
      this.pictoEl.classList.toggle("hide", !value)
      this.pictoEl.value = value
      dispatch(this, "ui:dialog.picto-change", { detail: value })
    })
  }

  get active() {
    return this.hasAttribute("active")
  }
  set active(value) {
    this.toggleAttribute("active", Boolean(value))
  }

  #position
  get position() {
    return this.#position
  }
  set position(options) {
    const { signal } = this
    const config = configure({ signal, dynamic: false }, options)
    this.#position = positionable(this, config)
  }

  get positionable() {
    return this.#position
  }
  set positionable(position) {
    this.position = position
  }

  /* MARK: position
  ----------------- */

  #x
  get x() {
    return this.#x
  }
  set x(value) {
    this.#x = Math.round(value)
    this[_axis]()
  }

  #y
  get y() {
    return this.#y
  }
  set y(value) {
    this.#y = Math.round(value)
    this[_axis]()
  }

  #z
  get z() {
    return this.#z
  }
  set z(value) {
    this.#z = Number(value)
    const z = String(value)
    this.style.zIndex = z
    if (this.backdropEl) this.backdropEl.style.zIndex = z
    if (this.#lockZIndex !== undefined) this.#lockZIndex = z
  }

  #pivot = null
  get pivot() {
    return this.#pivot
  }
  set pivot(value) {
    this.#pivot = value
    dispatch(this, "ui:dialog.pivot-change", { detail: value })
  }

  #pivotKind
  get pivotKind() {
    return this.#pivotKind ?? "normal"
  }
  set pivotKind(value) {
    this.#pivotKind = value
  }

  #geometryKind
  get geometryKind() {
    return this.#geometryKind
  }
  set geometryKind(value) {
    this.#geometryKind = value
  }

  /** @type {{x: number, y: number} | null} */
  #savedPivotPosition = null
  /** @type {number | null} */
  #width = null
  /** @type {number | null} */
  #height = null
  /** @type {{width: number, height: number} | null} */
  #bodyDelta = null
  #hasExplicitSize = false

  /* MARK: size
  ------------- */

  get width() {
    return this.#width
  }

  set width(value) {
    this.#width = Math.round(value)
    this[_size]()
  }

  get height() {
    return this.#height
  }

  set height(value) {
    this.#height = Math.round(value)
    this[_size]()
  }

  get outerWidth() {
    if (this.#width == null || !this.#bodyDelta) return null
    return this.#width + this.#bodyDelta.width
  }

  set outerWidth(value) {
    if (!this.#bodyDelta) return
    this.width = value - this.#bodyDelta.width
  }

  get outerHeight() {
    if (this.#height == null || !this.#bodyDelta) return null
    return this.#height + this.#bodyDelta.height
  }

  set outerHeight(value) {
    if (!this.#bodyDelta) return
    this.height = value - this.#bodyDelta.height
  }

  /**
   * Determines the pivot based on dialog center position.
   * Center zone is a 30% rectangle in the middle of the container.
   * @returns {Promise<string>} The pivot constant.
   */
  async detectPivot() {
    const { width: w, height: h } = await measure(this, { mode: "size" })
    if (!this.isConnected) return
    const width = Math.round(w)
    const height = Math.round(h)
    const centerX = this.x + width / 2
    const centerY = this.y + height / 2

    const container = this.parentElement
    const cw = container.clientWidth
    const ch = container.clientHeight

    if (
      centerX >= cw * 0.35 &&
      centerX <= cw * 0.65 &&
      centerY >= ch * 0.35 &&
      centerY <= ch * 0.65
    ) {
      return PIVOTS.CENTER
    }

    const isTop = centerY < ch / 2
    const isLeft = centerX < cw / 2

    return isTop
      ? isLeft
        ? PIVOTS.TOP_LEFT
        : PIVOTS.TOP_RIGHT
      : isLeft
        ? PIVOTS.BOTTOM_LEFT
        : PIVOTS.BOTTOM_RIGHT
  }

  /**
   * Gets the target position for a pivot (dialog centered in quadrant).
   * If the dialog exceeds its quadrant on either axis, falls back to CENTER.
   * Only applies the fallback for auto-assigned pivots; explicit pivots are
   * preserved. Position is always clamped to >= 0.
   * @param {string} pivot
   * @param {{ isAutoPivot?: boolean }} [options]
   * @returns {Promise<{x: number, y: number, pivot: string}>}
   */
  async getPivotPosition(pivot, { isAutoPivot } = {}) {
    if (!this.isConnected) return
    const container = this.parentElement
    const cw = container.clientWidth
    const ch = container.clientHeight
    const { width: w, height: h } = await measure(this, {
      mode: "size",
      subpixel: false,
    })
    const width = Math.round(w)
    const height = Math.round(h)

    const margin = marginMeasure.value

    if (isAutoPivot && pivot !== PIVOTS.CENTER) {
      if (width > cw / 2 || height > ch / 2) pivot = PIVOTS.CENTER
    }

    let x = cw / 2
    let y = ch / 2
    if (pivot !== PIVOTS.CENTER) {
      x = (cw * (pivot.includes("right") ? 3 : 1)) / 4
      y = (ch * (pivot.includes("bottom") ? 3 : 1)) / 4
    }

    x = Math.round(x - width / 2 - margin)
    y = Math.round(y - height / 2 - margin)

    const maxX = Math.max(0, cw - width)
    const maxY = Math.max(0, ch - height)
    const minX = width <= cw - margin * 2 ? margin : 0
    const minY = height <= ch - margin * 2 ? margin : 0

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY)),
      pivot,
    }
  }

  #idleId
  #initedPosition = true
  #allowGeometryStateSave = false

  #queueSaveGeometry() {
    if (!this.geometryKind) return

    const saveable = new Set(this.#userModified)
    if (this.saveRuntimeDefined) {
      for (const key of this.runtimeDefined) saveable.add(key)
    }

    // Remove skipped properties from saveable
    if (this.plan.skipSave) {
      if (this.plan.skipSave === true) return
      for (const key of this.plan.skipSave) saveable.delete(key)
    }

    if (saveable.size === 0) return

    if (this.#idleId) cancelIdleCallback(this.#idleId)

    this.#idleId = requestIdleCallback(() => {
      const current = dialogsState[this.geometryKind]
      const next = { ...current }

      if (saveable.has("x")) next.x = this.x
      if (saveable.has("y")) next.y = this.y
      if (saveable.has("width") && this.#width != null) {
        next.width = this.#width
      }
      if (saveable.has("height") && this.#height != null) {
        next.height = this.#height
      }
      if (saveable.has("maximized")) next.maximized = this.maximized

      if (
        current &&
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height &&
        current.maximized === next.maximized
      ) {
        return
      }

      dialogsState[this.geometryKind] = next
    })
  }

  updatePosition() {
    const x = Number.isFinite(this.#x) ? `${this.#x}px` : this.#x
    const y = Number.isFinite(this.#y) ? `${this.#y}px` : this.#y
    this.style.translate = `${x} ${y}`
  }

  [_axis] = repaintThrottle(() => this.updatePosition())

  updateSize() {
    const w = this.outerWidth
    const h = this.outerHeight
    if (w != null) this.style.width = `${w}px`
    if (h != null) this.style.height = `${h}px`
  }

  [_size] = repaintThrottle(() => this.updateSize())

  /* MARK: maximize
  ----------------- */

  maximize() {
    this.maximized = true
  }

  restore() {
    this.maximized = false
  }

  toggleMaximize(force = !this.maximized) {
    this.maximized = force
  }

  #restoreStyle
  #unsetStyle = []
  get maximized() {
    if (!this.maximizable) return false
    return this.hasAttribute("maximized")
  }
  set maximized(value) {
    if (!this.maximizable) return

    const { animateMaximize } = this

    value = Boolean(value)
    this.toggleAttribute("maximized", value)
    if (this.#allowGeometryStateSave) this.saveMaximized()
    // if (this.app) this.app.state.dialog.maximized = value

    this.ready.then(async () => {
      const computedStyle = getComputedStyle(this)

      this.movable.enabled = !value
      if (this.resizable) this.resizable.enabled = !value
      if (this.maximizeButtonEl) {
        // @ts-ignore
        this.maximizeButtonEl.firstChild.value = value ? "restore" : "maximize"
        this.maximizeButtonEl.ariaLabel = value ? "Restore" : "Maximize"
      }

      if (value) {
        this.#unsetStyle.length = 0
        this.#restoreStyle = saveStyles(this, [
          "width", //
          "height",
          "translate",
          "rotate",
        ])

        if (!this.#restoreStyle.width) {
          this.#restoreStyle.width = computedStyle.width
          this.#unsetStyle.push("width")
        }

        if (!this.#restoreStyle.height) {
          this.#restoreStyle.height = computedStyle.height
          this.#unsetStyle.push("height")
        }

        this.#restoreStyle.maxWidth = computedStyle.maxWidth
        this.#restoreStyle.maxHeight = computedStyle.maxHeight

        if (animateMaximize === false) {
          this.style.width = "100%"
          this.style.height = "100%"
          this.style.maxWidth = "100%"
          this.style.maxHeight = "100%"
          this.style.translate = "0 0"
          this.style.rotate = "0deg"
        } else {
          await animateTo(this, {
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            translate: "0 0",
            rotate: "0deg",
          })
        }
        dispatch(this, "ui:dialog.maximize")
      } else if (this.#restoreStyle) {
        const restoreStyle = { ...this.#restoreStyle }
        if (restoreStyle.translate) {
          const [tx, ty] = restoreStyle.translate.split(" ")
          restoreStyle.translate = CSS_SUPPORTS_ROUND
            ? `round(down, ${tx}, 1px) round(down, ${ty}, 1px)`
            : `${tx} ${ty}`
        }
        await animateTo(this, restoreStyle)
        for (const item of this.#unsetStyle) this.style.removeProperty(item)
        this.style.removeProperty("max-width")
        this.style.removeProperty("max-height")
        dispatch(this, "ui:dialog.restore")
      }
    })
  }

  /* MARK: fixOverlap
  ------------------- */

  async fixOverlap() {
    if (!this.isConnected) return
    if (this.maximized) return

    const container = this.parentElement

    const margin = marginMeasure.value

    const [
      { width, height }, //
      { width: cw, height: ch },
    ] = await measure([this, container], { mode: "size" })

    // Skip staircase if dialog is larger than its available space (respecting margins),
    // but still run the final boundary clamp below
    const skipStaircase = width >= cw - margin * 2 || height >= ch - margin * 2

    const allDialogs = []
    let top = null
    for (const dialogEl of this.tracker) {
      if (dialogEl === this || !dialogEl.isConnected) continue
      if (dialogEl.fixOverlapReady?.isPending) continue

      allDialogs.push(dialogEl)

      if (dialogEl.maximized) continue
      if (this.geometryKind) {
        if (dialogEl.geometryKind !== this.geometryKind) continue
      } else {
        if (dialogEl.pivot !== this.pivot) continue
        if (dialogEl.pivotKind !== this.pivotKind) continue
      }

      if (!top || dialogEl.z > top.z) top = dialogEl
    }

    const offset = this.headerEl
      ? this.headerEl.clientHeight + getHeaderOffset(this)
      : margin * 2

    const maxX = cw - width - margin
    const maxY = ch - height - margin
    const minX = width <= cw - margin * 2 ? margin : 0
    const minY = height <= ch - margin * 2 ? margin : 0

    if (top && !skipStaircase) {
      let tx = top.x + offset
      let ty = top.y + offset

      if (!Number.isFinite(tx)) {
        throw new TypeError(
          `Invalid overlap calculation top.x: ${top.x}, offset: ${offset}`,
        )
      }
      if (!Number.isFinite(ty)) {
        throw new TypeError(
          `Invalid overlap calculation top.y: ${top.y}, offset: ${offset}`,
        )
      }

      if (tx > maxX) tx = minX
      if (ty > maxY) ty = minY

      this.#x = tx
      this.#y = ty

      // Final check for exact (x,y) collisions with ANY existing dialog
      // Ensure that fixOverlap NEVER places two dialogs at the same position.
      let collision = true
      let safety = 0
      while (collision && safety < 100) {
        collision = false
        for (const dialogEl of allDialogs) {
          if (
            Math.abs(dialogEl.x - this.#x) < 1 &&
            Math.abs(dialogEl.y - this.#y) < 1
          ) {
            this.#x += offset
            this.#y += offset
            if (this.#x > maxX) this.#x = minX
            if (this.#y > maxY) this.#y = minY
            collision = true
            safety++
            break
          }
        }
      }
    }

    // Final boundary clamp — dialog must never go outside container
    this.#x = Math.max(minX, Math.min(this.#x, Math.max(0, cw - width)))
    this.#y = Math.max(minY, Math.min(this.#y, Math.max(0, ch - height)))

    this.updatePosition()

    if (!this.isConnected) return
    const pivot = await this.detectPivot()
    if (pivot && pivot !== this.pivot) this.pivot = pivot
  }

  /* MARK: close
  -------------- */

  closed = false
  close(ok = false) {
    this.closed = true
    if (!this.isConnected || this.dataset.willDisconnect) return

    const event = dispatch(this, "ui:dialog.close", {
      cancelable: true,
      detail: { ok },
    })

    const hadIframeFocused = this.iframeEl?.contentWindow?.document.hasFocus()
    const { activeElement } = document
    const wasFocused =
      this.contains(activeElement) ||
      (this.iframeEl && hadIframeFocused) ||
      activeElement === document.body ||
      activeElement === document.documentElement

    if (event.defaultPrevented) {
      if (this.dataset.willDisconnect) {
        this.#removeBackdrop?.()
        this.untrack(hadIframeFocused, wasFocused)
      }

      return
    }

    this.#removeBackdrop?.()
    this.remove()
    this.untrack(hadIframeFocused, wasFocused)
  }

  remove() {
    const event = dispatch(this, "ui:dialog.before-remove", {
      cancelable: true,
    })
    if (event.defaultPrevented) return
    super.remove()
  }

  untrack(hadIframeFocused, wasFocused) {
    const idx = this.tracker.indexOf(this)
    if (idx !== -1) this.tracker.splice(idx, 1)
    this.restoreOpenerFocus(hadIframeFocused, wasFocused)
    if (this.tracker.length > 0) this.tracker.at(-1)?.activate()
  }

  restoreOpenerFocus(hadIframeFocused, wasFocused) {
    if (wasFocused === false) return false

    if (hadIframeFocused) {
      // Force focus on document when existing iframe
      const input = document.createElement("input")
      input.style.cssText = /* style */ `
        position: absolute;
        opacity: 0;
        translate: -100% 0;`
      document.documentElement.append(input)
      input.focus()
      input.blur()
      input.remove()
    }

    if (!document.hasFocus()) return false

    if (this.openerEl && this.openerEl !== document.activeElement) {
      if (this.openerEl.isConnected) {
        const { ownerDocument } = this.openerEl
        if (!ownerDocument.hasFocus() && ownerDocument.defaultView) {
          ownerDocument.defaultView.focus()
        }

        this.openerEl.focus?.()
      }
    }

    return this.openerEl === document.activeElement
  }

  /* MARK: activate
  ----------------- */

  activate(options) {
    if (!this.isConnected) return

    if (this.active) return

    const event = dispatch(this, "ui:dialog.before-activate", {
      cancelable: true,
    })
    if (event.defaultPrevented) return

    const lockZIndex = this.#lockZIndex
    this.moveToTop({ deactivateOthers: true })
    if (lockZIndex !== undefined) this.z = lockZIndex

    this.active = true
    if (options?.focus !== false) this.setFocusInside()

    const idx = this.tracker.indexOf(this)
    if (idx !== -1) this.tracker.splice(idx, 1)
    this.tracker.push(this)

    dispatch(this, "ui:dialog.activate")

    if (options?.wiggle) {
      const wiggleX = this.maximized ? 0 : this.#x
      const wiggleY = this.maximized ? 0 : this.#y
      animateTo(this, [
        { translate: `${wiggleX - 8}px ${wiggleY}px` },
        { translate: `${wiggleX + 6}px ${wiggleY}px` },
        { translate: `${wiggleX - 4}px ${wiggleY}px` },
        { translate: `${wiggleX}px ${wiggleY}px` },
      ])
    }
  }

  setFocusInside() {
    if (this.iframeEl) {
      try {
        this.iframeEl.contentWindow.focus()
      } catch {}
    } else if (
      this.pivotKind.includes("alert") ||
      this.classList.contains("ui-dialog-about")
    ) {
      focusInside(this.footerEl)
    } else {
      focusInside(this.bodyEl, this.footerEl)
    }
  }

  #lockZIndex = undefined

  get isLocked() {
    return this.#lockZIndex !== undefined
  }

  lockZIndex(value = this.z) {
    this.#lockZIndex = Number(value)
    this.z = this.#lockZIndex
  }

  unlockZIndex() {
    this.#lockZIndex = undefined
  }

  moveToTop(options) {
    let max = this.z

    for (const dialogEl of this.tracker) {
      if (dialogEl === this || !dialogEl.isConnected) continue
      if (options?.deactivateOthers) dialogEl.active = false
      max = Math.max(max, dialogEl.z)
    }

    this.z = max + 1
  }

  moveToBottom() {
    let min = this.z

    for (const dialogEl of this.tracker) {
      if (dialogEl === this || !dialogEl.isConnected) continue
      min = Math.min(min, dialogEl.z)
    }

    this.z = min - 1
  }

  moveUp() {
    let nextZ = Infinity

    for (const dialogEl of this.tracker) {
      if (dialogEl === this || !dialogEl.isConnected) continue
      if (dialogEl.z > this.z && dialogEl.z < nextZ) {
        nextZ = dialogEl.z
      }
    }

    if (nextZ !== Infinity) {
      this.z = nextZ + 1
    }
  }

  moveDown() {
    let nextZ = -Infinity

    for (const dialogEl of this.tracker) {
      if (dialogEl === this || !dialogEl.isConnected) continue
      if (dialogEl.z < this.z && dialogEl.z > nextZ) {
        nextZ = dialogEl.z
      }
    }

    if (nextZ !== -Infinity) {
      this.z = nextZ - 1
    }
  }

  /* MARK: center
  --------------- */

  async moveToCenter(options) {
    if (this.maximized) return

    if (options?.animate !== false) {
      await animateTo(this, {
        top: "50%",
        left: "50%",
        translate: CSS_SUPPORTS_ROUND
          ? "round(down, -50%, 1px) round(down, -50%, 1px)"
          : "-50% -50%",
      })
    }

    const { x, y } = await measure(this)

    this.style.removeProperty("translate")
    this.style.removeProperty("top")
    this.style.removeProperty("left")

    this.#x = x
    this.#y = y
    this.style.top = "0"
    this.style.left = "0"
    this.updatePosition()

    if (options?.fixOverlap !== false) await this.fixOverlap()
  }

  /* MARK: resize
  --------------- */

  async resize(width, height, options) {
    if (!this.isConnected) return

    if (isHashmapLike(width)) {
      options = width
    } else {
      options ??= {}
      options.width = width
      options.height = height
    }

    if (options.width === this.#width && options.height === this.#height) return

    if (this.maximized) {
      if (options?.forceMaximized !== true) return
      this.maximized = false
    }

    const widthCss =
      options.width === undefined
        ? false
        : Number.isFinite(options.width)
          ? `${options.width}px`
          : options.width

    const heightCss =
      options.height === undefined
        ? false
        : Number.isFinite(options.height)
          ? `${options.height}px`
          : options.height

    for (const anim of this.getAnimations()) anim.cancel()

    const margin = marginMeasure.value

    const { subpixel } = options

    const restoreMinWidth = tempMinWidth(this)

    let wasHidden = false
    if (this.classList.contains("hide")) {
      wasHidden = true
      this.classList.toggle("hide", false)
      this.classList.toggle("invisible", true)
    }

    const restoreDialogAdaptiveSize = (rect) => {
      this.style.width = Math.ceil(rect.width) + "px"
      this.style.height = Math.ceil(rect.height) + "px"
      restoreMinWidth()

      if (widthCss) {
        this.bodyEl.style.removeProperty("width")
      }

      if (heightCss) {
        this.bodyEl.style.removeProperty("height")
        this.bodyEl.style.removeProperty("flex-basis")
      }
    }

    const { animationName } = this.dataset

    const parentWidth = this.parentElement.clientWidth
    const parentHeight = this.parentElement.clientHeight

    this.classList.remove("animated", animationName)

    if (
      widthCss ||
      heightCss ||
      (options.width === undefined && options.height === undefined)
    ) {
      // Use center pivot for options.center, otherwise use dialog's pivot
      const animPivot = options.center ? PIVOTS.CENTER : this.pivot

      // Get current sizes
      const [dialogSize, bodySize] = await Promise.all([
        measure(this, { mode: "size", subpixel }),
        measure(this.bodyEl, { mode: "size", contentBox: true, subpixel }),
      ])
      const dialogRect = {
        width: dialogSize.width,
        height: dialogSize.height,
      }
      const bodyRect = {
        width: bodySize.width,
        height: bodySize.height,
      }

      let targetBodyWidth
      let targetBodyHeight

      if (widthCss === false && heightCss === false) {
        // Restore to auto-size: measure intrinsic dimensions
        const restoreMinWidth = tempMinWidth(this)
        const savedWidth = this.style.width
        const savedHeight = this.style.height
        this.style.removeProperty("width")
        this.style.removeProperty("height")
        this.bodyEl.style.removeProperty("width")
        this.bodyEl.style.removeProperty("height")
        const intrinsicSize = await measure(this.bodyEl, {
          mode: "size",
          contentBox: true,
          subpixel,
        })
        targetBodyWidth = intrinsicSize.width
        targetBodyHeight = intrinsicSize.height
        this.style.width = savedWidth
        this.style.height = savedHeight
        restoreMinWidth()
      } else {
        targetBodyWidth = widthCss
          ? Number.parseFloat(widthCss)
          : bodyRect.width
        targetBodyHeight = heightCss
          ? Number.parseFloat(heightCss)
          : bodyRect.height
      }

      // Calculate max allowed dialog size based on CSS constraints
      const maxDialogWidth = parentWidth - margin * 2
      const maxDialogHeight = parentHeight - margin * 2

      // Calculate target dialog size (clamped to container max)
      const unconstrained = {
        width: dialogRect.width + (targetBodyWidth - bodyRect.width),
        height: dialogRect.height + (targetBodyHeight - bodyRect.height),
      }

      const targetDialogWidth = Math.min(unconstrained.width, maxDialogWidth)
      const targetDialogHeight = Math.min(unconstrained.height, maxDialogHeight)

      // Check if we're expanding to overflow
      const willOverflow =
        unconstrained.width > maxDialogWidth ||
        unconstrained.height > maxDialogHeight

      // Check if current size is already at max (overflowed)
      const isOverflowed =
        dialogRect.width >= maxDialogWidth - 1 ||
        dialogRect.height >= maxDialogHeight - 1

      // Store pre-resize position when expanding to overflow
      if (willOverflow && !isOverflowed) {
        this.#savedPivotPosition = { x: this.x, y: this.y }
      }

      // Calculate effective deltas (constrained)
      const widthDelta = targetDialogWidth - dialogRect.width
      const heightDelta = targetDialogHeight - dialogRect.height

      // Calculate position offset
      let targetX = this.x
      let targetY = this.y
      let restoreToSaved = false

      if (isOverflowed && !willOverflow && this.#savedPivotPosition) {
        // Shrinking from overflow - restore to saved position
        targetX = this.#savedPivotPosition.x
        targetY = this.#savedPivotPosition.y
        restoreToSaved = true
      } else {
        // Normal resize or expanding to overflow - use pivot-based offset
        switch (animPivot) {
          case PIVOTS.TOP_RIGHT:
            targetX -= widthDelta
            break
          case PIVOTS.BOTTOM_RIGHT:
            targetX -= widthDelta
            targetY -= heightDelta
            break
          case PIVOTS.BOTTOM_LEFT:
            targetY -= heightDelta
            break
          case PIVOTS.CENTER:
            targetX -= widthDelta / 2
            targetY -= heightDelta / 2
            break
          // TOP_LEFT: no offset needed
        }

        // Clamp position to keep dialog within container bounds
        const limitX = parentWidth - targetDialogWidth
        const limitY = parentHeight - targetDialogHeight

        const maxX = Math.max(0, limitX - margin)
        const maxY = Math.max(0, limitY - margin)
        const minX = limitX < margin ? 0 : margin
        const minY = limitY < margin ? 0 : margin

        targetX = Math.max(minX, Math.min(targetX, maxX))
        targetY = Math.max(minY, Math.min(targetY, maxY))

        // Hard clamp to container bounds
        targetX = Math.max(0, Math.min(targetX, Math.max(0, limitX)))
        targetY = Math.max(0, Math.min(targetY, Math.max(0, limitY)))
      }

      if (options?.animate === false) {
        if (widthCss) {
          this.bodyEl.style.width = widthCss
        }

        if (heightCss) {
          this.bodyEl.style.flexBasis = "auto"
          this.bodyEl.style.height = heightCss
        }

        this.x = targetX
        this.y = targetY
        this.style.width = `${targetDialogWidth}px`
        this.style.height = `${targetDialogHeight}px`
        this.updatePosition()

        if (restoreToSaved) {
          this.#savedPivotPosition = null
        }
      } else {
        const ms = Number.isFinite(options.animate) ? options.animate : 450

        // Set explicit start sizes on dialog (sub-pixel accurate)
        this.style.width = `${dialogRect.width}px`
        this.style.height = `${dialogRect.height}px`

        const { signal } = this
        const restoreScrollbars = setTemp(this.bodyEl, {
          signal,
          style: { overflow: "hidden" },
        })

        // Animate with explicit from/to keyframes for perfect control
        const anim = await animateTo(this, {
          from: {
            width: `${dialogRect.width}px`,
            height: `${dialogRect.height}px`,
            translate:
              subpixel && CSS_SUPPORTS_ROUND
                ? `round(down, ${this.x}px, 1px) round(down, ${this.y}px, 1px)`
                : `${this.x}px ${this.y}px`,
          },
          to: {
            width: `${targetDialogWidth}px`,
            height: `${targetDialogHeight}px`,
            translate:
              subpixel && CSS_SUPPORTS_ROUND
                ? `round(down, ${targetX}px, 1px) round(down, ${targetY}px, 1px)`
                : `${targetX}px ${targetY}px`,
          },
          ms,
        })

        restoreScrollbars()

        // Check if animation was cancelled
        if (animateTo.cancelledAnims.has(anim)) {
          const { width, height } = await measure(this, {
            mode: "size",
            subpixel,
          })
          restoreDialogAdaptiveSize({ width, height })
          return
        }

        if (!this.isConnected) return

        // Update position after animation
        this.x = targetX
        this.y = targetY

        // Clear saved position if we restored to it
        if (restoreToSaved) {
          this.#savedPivotPosition = null
        }
      }
    }

    const rect = await measure(this, { subpixel })
    const bodyRect = await measure(this.bodyEl, {
      mode: "size",
      subpixel,
      contentBox: true,
    })
    this.#width = bodyRect.width
    this.#height = bodyRect.height
    this.#bodyDelta = {
      width: rect.width - bodyRect.width,
      height: rect.height - bodyRect.height,
    }

    const right = parentWidth - rect.x + rect.width
    const bottom = parentHeight - rect.y + rect.height
    const limitX = parentWidth - rect.width
    const limitY = parentHeight - rect.height

    const marginX = limitX < margin ? 0 : margin
    const marginY = limitY < margin ? 0 : margin

    if (right < 0) this.x += Math.round(right) - marginX
    if (bottom < 0) this.y += Math.round(bottom) - marginY

    restoreDialogAdaptiveSize(rect)

    if (options.center) await this.moveToCenter(options)

    if (options.save !== false) this.saveGeometry()

    if (wasHidden) {
      this.classList.toggle("hide", true)
      this.classList.toggle("invisible", false)
    }
  }

  /* MARK: render
  --------------- */

  stealFocus = true
  maximizable = true
  minimizable = true
  dockable = true

  runtimeDefined = new Set()
  saveRuntimeDefined = false
  #userModified = new Set()

  #removeBackdrop

  render({
    content,
    beforeContent,
    afterContent,

    width,
    height,

    label,
    picto,
    header,
    body,
    footer,

    opener,

    modal,
    stealFocus,
    clear,
    inset,

    buttons,

    beforeAgree,
    agree,
    afterAgree,
    beforeDecline,
    decline,
    afterDecline,

    maximized,

    maximizable,
    minimizable,
    dockable,
    closable,
  }) {
    // const openerEl =
    //   (typeof opener === "string" ? document.querySelector(opener) : opener) ??
    //   document.activeElement

    // let current = openerEl
    // while (current && current.closest) {
    //   const menuEl = current.closest("ui-menu, ui-menubar, ui-toolbar")
    //   if (menuEl) {
    //     if (menuEl.savedFocus) {
    //       current = menuEl.savedFocus
    //       break
    //     } else if (menuEl.openerEl) {
    //       current = menuEl.openerEl
    //     } else {
    //       break
    //     }
    //   } else {
    //     break
    //   }
    // }

    // this.openerEl = /** @type {HTMLElement} */ (current)

    this.openerEl = /** @type {HTMLElement} */ (
      (typeof opener === "string" ? document.querySelector(opener) : opener) ??
        document.activeElement
    )

    if (clear) this.classList.add("clear")

    if (header) header = toPlanObject(header)

    let footerContent
    if (footer) {
      const { content, ...rest } = toPlanObject(footer)
      footerContent = content
      footer = rest
    }

    const hasDialogButtons =
      agree !== undefined ||
      decline !== undefined ||
      beforeAgree !== undefined ||
      afterAgree !== undefined ||
      beforeDecline !== undefined ||
      afterDecline !== undefined

    if (footer == null && hasDialogButtons) {
      footerContent = createDialogButtons({
        beforeAgree,
        agree,
        afterAgree,
        beforeDecline,
        decline,
        afterDecline,
      })
      footer = {}
    }

    if (modal) {
      this.ariaModal = "true"
      document.body.inert = true
      this.backdropEl = document.createElement("div")
      this.backdropEl.className = "ui-dialog__backdrop"
      this.backdropEl.onclick = () => this.close(false)
      this.before(this.backdropEl)

      this.#removeBackdrop = () => {
        document.body.inert = false
        this.backdropEl?.remove()
        this.backdropEl = undefined
        this.#removeBackdrop = undefined
      }
    }

    if (Array.isArray(buttons)) {
      buttons = { after: buttons }
    }

    /** @type any[] */
    const buttonsPlan = []

    if (closable !== false) {
      buttonsPlan.push({
        tag: "button.ui-dialog__button.ui-dialog__button--close",
        picto: "close",
        aria: { label: "Close" },
        onclick: () => this.close(),
      })
    }

    this.minimized = false
    this.minimizable = minimizable ?? true
    this.dockable = dockable ?? true
    this.stealFocus = stealFocus ?? true

    if (maximizable === false) {
      this.maximizable = false
    } else {
      this.maximizable = true
      buttonsPlan.unshift({
        tag: "button.ui-dialog__button.ui-dialog__button--maximize",
        picto: "maximize",
        aria: { label: "Maximize" },
        onclick: () => this.toggleMaximize(),
      })
    }

    if (maximized) {
      const { maximizable, animateMaximize } = this
      this.animateMaximize = false
      this.maximizable = true

      this.maximized = true

      this.animateMaximize = animateMaximize
      this.maximizable = maximizable
    }

    const id = this.id + "-title"
    this.setAttribute("aria-labelledby", id)

    label = {
      tag: "span.ui-dialog__title__text-container",
      content: {
        tag: "span.ui-dialog__title__text",
        content: label,
      },
    }

    const bodyClass =
      inset === "shallow" ? { "inset-shallow": true } : { inset }

    const plan = [
      configure(
        {
          tag: "header",
          class: {
            "ui-dialog__header": true,
            "hide": header === false,
          },
          content: [
            {
              tag: ".ui-dialog__buttons.ui-dialog__buttons--before",
              content: buttons?.before,
            },
            {
              tag: ".ui-dialog__title-container",
              content: {
                tag: "h2.ui-dialog__title",
                id,
                content: [
                  {
                    tag: "ui-picto.ui-dialog__picto",
                    class: { hide: !picto },
                    value: picto,
                  },
                  label,
                ],
              },
              ondblclick:
                maximizable === false //
                  ? undefined
                  : () => this.toggleMaximize(),
            },
            {
              tag: ".ui-dialog__buttons.ui-dialog__buttons--extra",
              content: buttons?.after,
            },
            {
              tag: ".ui-dialog__buttons",
              content: buttonsPlan,
            },
          ],
        },
        header,
      ),

      beforeContent,

      configure(
        {
          class: {
            "ui-dialog__body": true,
            "rows": true,
            ...bodyClass,
          },
          content,
          style: {
            flexBasis: "auto",
            width,
            height,
          },
        },
        body,
      ),

      afterContent,

      configure(
        {
          tag: "footer",
          class: {
            "ui-dialog__footer": true,
            "hide": !footer,
          },
        },
        footer,
        {
          content: {
            tag: ".ui-dialog__footer__content",
            content: footerContent,
          },
          // content: footerContent,
        },
      ),
    ]

    return { tag: ".ui-dialog__clip", content: plan }
  }

  saveSize() {
    this.#userModified.add("width").add("height")
    this.#queueSaveGeometry()
  }

  savePosition() {
    this.#userModified.add("x").add("y")
    this.#queueSaveGeometry()
  }

  saveGeometry() {
    this.saveSize()
    this.savePosition()
  }

  saveMaximized() {
    this.#userModified.add("maximized")
    this.#queueSaveGeometry()
  }

  /* MARK: created
  ---------------- */

  async created() {
    const { opacity } = this.style
    this.style.opacity = "0"

    const event = dispatch(this, "ui:dialog.before-open", { cancelable: true })
    if (event.defaultPrevented) {
      this.destroy()
      return
    }

    this.#initElements()
    this.#initZIndex()

    // Register in tracker early so concurrent dialogs can see each other
    this.tracker.push(this)
    this.geometryReady = defer()
    this.fixOverlapReady = defer()

    if (this.plan.skipAutoPosition === true) {
      if (this.plan.randomPosition) this.randomPosition({ init: true })
      else this.updatePosition()
      if (this.x !== undefined) this.style.left = "0"
      if (this.y !== undefined) this.style.top = "0"

      this.style.removeProperty("opacity")
      this.geometryReady.resolve()
      this.fixOverlapReady.resolve()

      // await untilTreeReady(this)
      this.#addTraits()
      await this.#revealDialog()
      return
    }

    let overlapFixed = false
    const pendingFixOverlap = []
    for (const dialogEl of this.tracker) {
      if (dialogEl === this) continue
      if (dialogEl.fixOverlapReady?.isPending) {
        pendingFixOverlap.push(dialogEl.fixOverlapReady)
      }
    }

    if (pendingFixOverlap.length > 0) {
      await Promise.race([
        sleep(2000).then(() => {
          if (overlapFixed) return
          // Force resolve pending fixOverlapReady promises after 2 seconds
          for (const dialogEl of this.tracker) {
            if (dialogEl === this) continue
            if (dialogEl.fixOverlapReady?.isPending) {
              dialogEl.fixOverlapReady.resolve()
            }
          }
        }),
        Promise.all(pendingFixOverlap).then(() => {
          overlapFixed = true
        }),
      ])
    }

    if (this.plan.runtimeDefined) {
      this.runtimeDefined = new Set(this.plan.runtimeDefined)
    }

    if (this.plan.saveRuntimeDefined) this.saveRuntimeDefined = true

    await untilTreeReady(this)

    this.#addTraits()

    if (this.position) {
      const { x, y } = await this.position.ready
      this.#x = x
      this.#y = y
      this.pivot ??= await this.detectPivot()
      this.geometryReady.resolve()
      this.fixOverlapReady.resolve()
    } else {
      await this.#initSizeAndPosition()
    }

    this.#restoreSavedMaximizedState()

    if (opacity) this.style.opacity = opacity
    else this.style.removeProperty("opacity")

    await this.#revealDialog()

    this.#allowGeometryStateSave = true

    this.#queueSaveGeometry()
  }

  /* MARK: #addTraits
  ------------------- */

  #addTraits() {
    const { signal } = this

    if (this.plan.movable !== false) {
      this.movable = movable(this, {
        signal,
        handlerSelector: ".ui-dialog__header",
        moveToTop: false,
        skipSize: true,
        style: { position: "absolute" },
        start: (x, y) => {
          // TODO: restore position if maximized
          // if (this.maximized) this.restore()

          // Ensure dialog's translate is set before repaintThrottle
          this.style.translate = `${x}px ${y}px`
        },
        drag: (x, y) => {
          this.emit("move", x, y)
        },
        stop: () => {
          if (this.signal.aborted) return
          this.detectPivot().then((pivot) => {
            this.pivot = pivot
            this.savePosition()
          })
        },
      })
    }

    if (this.plan.resizable !== false) {
      this.resizable = resizable(this, {
        signal,
        handleSize: "8px",
        // handleSidesSize: "min(20%, 50px)",
        // handles: ["e", "s", "w", "nw", "ne", "sw", "se"],
        ...(isHashmapLike(this.plan.resizable)
          ? this.plan.resizable
          : undefined),
        stop: (data) => {
          if (this.signal.aborted) return
          if (!data || !this.#bodyDelta) return
          if (data.width !== undefined) {
            this.#width = Math.max(0, data.width - this.#bodyDelta.width)
          }
          if (data.height !== undefined) {
            this.#height = Math.max(0, data.height - this.#bodyDelta.height)
          }
          this.saveSize()
          if (data.x !== undefined) this.#x = data.x
          if (data.y !== undefined) this.#y = data.y
          this.detectPivot().then((pivot) => {
            this.pivot = pivot
            this.savePosition()
          })
        },
      })
    }
  }

  /* MARK: #revealDialog
  ---------------------- */

  async #revealDialog() {
    const { signal } = this

    dispatch(this, "ui:dialog.open")

    const activateWithoutFocus = () => this.activate({ focus: false })
    this.addEventListener("pointerdown", activateWithoutFocus, { signal })
    this.addEventListener("focusin", activateWithoutFocus, { signal })

    this.activate({
      focus: this.stealFocus && document.hasFocus(),
    })

    if (this.iframeEl) {
      const options = { capture: true, signal }
      try {
        const win = await untilIframeEditable(this.iframeEl)
        win.addEventListener("pointerdown", activateWithoutFocus, options)
        win.addEventListener("focus", activateWithoutFocus, options)
      } catch {}
    }
  }

  /* MARK: #initElements
  ---------------------- */

  #initElements() {
    this.headerEl = this.querySelector(".ui-dialog__header")
    this.titleEl = this.querySelector(".ui-dialog__title")
    this.pictoEl = this.querySelector(".ui-dialog__picto")
    this.titleTextEl = this.querySelector(".ui-dialog__title__text")
    this.bodyEl = this.querySelector(".ui-dialog__body")
    this.footerEl = this.querySelector(".ui-dialog__footer")
    this.contentEl =
      this.querySelector(".ui-dialog-demand__content") ?? this.bodyEl
    this.maximizeButtonEl = this.querySelector(".ui-dialog__button--maximize")
    this.menubarEl = this.querySelector(
      ":scope > .ui-dialog__clip > ui-menubar",
    )

    if (
      this.bodyEl.children.length === 1 &&
      this.bodyEl.firstElementChild.localName === "iframe"
    ) {
      this.iframeEl = /** @type {HTMLIFrameElement} */ (
        this.bodyEl.firstElementChild
      )
    }
  }

  /* MARK: #initZIndex
  -------------------- */

  #initZIndex() {
    zDialog ??= Number(
      getComputedStyle(document.documentElement).getPropertyValue("--z-dialog"),
    )
    this.z = zDialog + this.tracker.length
  }

  /* MARK: randomPosition
  ------------------------ */

  // async randomPosition() {
  //   if (!this.isConnected) return
  //   this.style.top = "0"
  //   this.style.left = "0"
  //   const container = this.parentElement
  //   const [
  //     { width: w, height: h }, //
  //     { width: cw, height: ch },
  //   ] = await measure([this, container], {
  //     mode: "size",
  //     subpixel: false,
  //   })
  //   // const margin = marginMeasure.value
  //   // const x = Math.round(Math.random() * (cw - w - margin * 2) + margin)
  //   // const y = Math.round(Math.random() * (ch - h - margin * 2) + margin)
  //   const x = Math.round(Math.random() * (cw - w))
  //   const y = Math.round(Math.random() * (ch - h))
  //   this.#x = x
  //   this.#y = y
  //   this.updatePosition()
  // }

  randomPosition(options) {
    if (!this.isConnected) return
    this.style.top = "0"
    this.style.left = "0"
    const container = this.parentElement
    const cw = container.clientWidth
    const ch = container.clientHeight
    const w = this.clientWidth
    const h = this.clientHeight
    const x = Math.round(Math.random() * (cw - w))
    const y = Math.round(Math.random() * (ch - h))
    if (options?.init) {
      this.#x ??= x
      this.#y ??= y
    } else {
      this.#x = x
      this.#y = y
    }
    this.updatePosition()
  }

  #restoreSavedMaximizedState() {
    if (!this.geometryKind) return
    if (Object.hasOwn(this.plan, "maximized")) return
    if (this.runtimeDefined.has("maximized")) return

    const saved = dialogsState[this.geometryKind]
    if (typeof saved?.maximized !== "boolean") return

    const { maximizable, animateMaximize } = this
    this.animateMaximize = false
    this.maximizable = true
    this.maximized = saved.maximized
    this.animateMaximize = animateMaximize
    this.maximizable = maximizable
  }

  /* MARK: #initSizeAndPosition
  ---------------------------- */

  async #initSizeAndPosition() {
    const cStyles = window.getComputedStyle(this)
    const minInlineSize = Number.parseInt(cStyles.minInlineSize, 10)
    const minBlockSize = Number.parseInt(cStyles.minBlockSize, 10)
    const definedMinInlineSize = this.style.minInlineSize || this.style.minWidth
    const definedMinBlockSize = this.style.minBlockSize || this.style.minHeight

    this.style.minInlineSize = "auto"
    this.style.minBlockSize = "auto"

    const restoreMinWidth = tempMinWidth(this)

    if (this.bodyEl.style.width) {
      this.style.width = "auto"
    }

    if (this.bodyEl.style.height) {
      this.style.height = "auto"
      this.bodyEl.style.flexBasis = "auto"
    }

    const [dialogRect, bodyRect] = await Promise.all([
      measure(this),
      measure(this.bodyEl, { mode: "size", contentBox: true }),
    ])
    const { x, y, width, height } = dialogRect
    this.#width = Math.round(bodyRect.width)
    this.#height = Math.round(bodyRect.height)
    this.#bodyDelta = {
      width: Math.round(width - bodyRect.width),
      height: Math.round(height - bodyRect.height),
    }

    if (this.plan.randomPosition) {
      this.geometryReady.resolve()
      this.fixOverlapReady.resolve()
      this.randomPosition({ init: true })
      return
    }

    let appliedSavedSize = false

    // if (this.pivotKind !== "normal") this.pivot ??= PIVOTS.CENTER

    if (!this.style.top) {
      const sameKindDialog =
        this.geometryKind &&
        this.tracker.find(
          (dialogEl) =>
            dialogEl !== this &&
            dialogEl.isConnected &&
            dialogEl.geometryKind === this.geometryKind,
        )

      const saved = this.geometryKind ? dialogsState[this.geometryKind] : null

      const hasExplicitSize =
        Boolean(this.bodyEl.style.width) || Boolean(this.bodyEl.style.height)
      this.#hasExplicitSize = hasExplicitSize

      const skipSavedSize =
        this.runtimeDefined.has("width") || this.runtimeDefined.has("height")
      const skipSavedPosition =
        this.runtimeDefined.has("x") || this.runtimeDefined.has("y")

      // 1. RESOLVE SIZE (independent of position)
      const hasSavedWidth =
        !skipSavedSize && saved && Number.isFinite(saved.width)
      const hasSavedHeight =
        !skipSavedSize && saved && Number.isFinite(saved.height)

      if (hasSavedWidth || hasSavedHeight) {
        appliedSavedSize = true
        if (hasSavedWidth) this.#width = Math.round(saved.width)
        if (hasSavedHeight) this.#height = Math.round(saved.height)
        if (this.#bodyDelta) {
          this.style.width = `${this.#width + this.#bodyDelta.width}px`
          this.style.height = `${this.#height + this.#bodyDelta.height}px`
        }
      } else if (sameKindDialog && !sameKindDialog.#hasExplicitSize) {
        if (
          sameKindDialog.#width && //
          !this.plan.skipSave?.includes?.("width")
        ) {
          appliedSavedSize = true
          this.#width = sameKindDialog.#width
          if (this.#bodyDelta) {
            this.style.width = `${this.#width + this.#bodyDelta.width}px`
          }
        }
        if (
          sameKindDialog.#height &&
          !this.plan.skipSave?.includes?.("height")
        ) {
          appliedSavedSize = true
          this.#height = sameKindDialog.#height
          if (this.#bodyDelta) {
            this.style.height = `${this.#height + this.#bodyDelta.height}px`
          }
        }
      }

      // 2. RESOLVE POSITION
      const positionAuto = this.x === undefined && this.y === undefined

      if (positionAuto) {
        const hasSavedX =
          !skipSavedPosition &&
          !sameKindDialog &&
          saved &&
          Number.isFinite(saved.x)
        const hasSavedY =
          !skipSavedPosition &&
          !sameKindDialog &&
          saved &&
          Number.isFinite(saved.y)
        const hasSavedPosition = hasSavedX && hasSavedY

        if (hasSavedPosition) {
          this.#x = Math.round(saved.x)
          this.#y = Math.round(saved.y)

          // Clamp to viewport
          if (this.#bodyDelta && this.#width != null) {
            const dialogWidth = this.#width + this.#bodyDelta.width
            const dialogHeight = this.#height + this.#bodyDelta.height
            const { clientWidth, clientHeight } = this.parentElement
            const margin = marginMeasure.value
            const maxX = Math.max(0, clientWidth - dialogWidth)
            const maxY = Math.max(0, clientHeight - dialogHeight)
            const minX = dialogWidth <= clientWidth - margin * 2 ? margin : 0
            const minY = dialogHeight <= clientHeight - margin * 2 ? margin : 0

            this.#x = Math.max(minX, Math.min(this.#x, maxX))
            this.#y = Math.max(minY, Math.min(this.#y, maxY))
          }

          this.updatePosition()
          this.pivot ??= await this.detectPivot()
        } else {
          // Auto-position via pivot
          const isAutoPivot = this.pivot == null
          this.pivot ??= this.workspace.findAvailablePivot()
          const pos = await this.getPivotPosition(this.pivot, { isAutoPivot })
          this.pivot = pos.pivot
          this.#x = pos.x
          this.#y = pos.y
          // await this.fixOverlap()

          // Apply partially saved position
          if (hasSavedX) this.#x = Math.round(saved.x)
          if (hasSavedY) this.#y = Math.round(saved.y)
          if (hasSavedX || hasSavedY) this.updatePosition()
        }
      } else if (this.x === undefined || this.y === undefined) {
        this.#x ??= Math.round(x)
        this.#y ??= Math.round(y)
        this.updatePosition()
        this.pivot ??= await this.detectPivot()
      } else {
        this.pivot ??= await this.detectPivot()
      }

      this.style.top = "0"
      this.style.left = "0"
    }

    this.#initedPosition = false

    const finalWidth =
      appliedSavedSize && this.#bodyDelta && this.#width != null
        ? this.#width + this.#bodyDelta.width
        : width
    const finalHeight =
      appliedSavedSize && this.#bodyDelta && this.#height != null
        ? this.#height + this.#bodyDelta.height
        : height

    if (this.bodyEl.style.width) {
      this.style.width = `${Math.ceil(finalWidth)}px`
      this.bodyEl.style.removeProperty("width")
    }

    if (this.bodyEl.style.height) {
      this.style.height = `${Math.ceil(finalHeight)}px`
      this.bodyEl.style.removeProperty("height")
      this.bodyEl.style.removeProperty("flex-basis")
    }

    restoreMinWidth()
    this.style.minInlineSize =
      definedMinInlineSize || `${Math.min(finalWidth, minInlineSize)}px`
    this.style.minBlockSize =
      definedMinBlockSize || `${Math.min(finalHeight, minBlockSize)}px`

    this.geometryReady.resolve()
    await this.fixOverlap()
    this.fixOverlapReady.resolve()
  }

  destroyed() {
    dispatch(this, "ui:dialog.destroy")
    this.#removeBackdrop?.()
    const idx3 = this.tracker.indexOf(this)
    if (idx3 !== -1) this.tracker.splice(idx3, 1)
  }
}

Component.define(DialogComponent)

const trackerGetter = { get: () => ensureWorkspace().tracker }
Object.defineProperty(dialog, "tracker", trackerGetter)
Object.defineProperty(DialogComponent, "tracker", trackerGetter)

/* MARK: demand
=============== */

const DEFAULT_DEMAND = {
  class: { "ui-dialog-demand": true },
  role: "alertdialog",
  agree: "Ok",
  decline: "Cancel",
  pivot: "center",
}

function createDialogButtons(config) {
  const buttons = []

  if (config.agree !== undefined && config.agree !== false) {
    buttons.push({
      tag: "button.ui-dialog__agree",
      autofocus: true,
      type: "submit",
      onclick: (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        e.target.closest("ui-dialog").close(true)
      },
      content: config.agree === true ? "Ok" : config.agree,
      ...(typeof config.agree === "object"
        ? toPlanObject(config.agree)
        : undefined),
    })
  }

  if (config.decline !== undefined && config.decline !== false) {
    buttons.push({
      tag: "button.ui-dialog__decline",
      onclick: (e) => {
        e.stopPropagation()
        e.stopImmediatePropagation()
        e.target.closest("ui-dialog").close()
      },
      content: config.decline === true ? "Cancel" : config.decline,
      ...(typeof config.decline === "object"
        ? toPlanObject(config.decline)
        : undefined),
    })
  }

  return [
    config.beforeAgree,
    buttons[0],
    config.afterAgree,
    config.beforeDecline,
    buttons[1],
    config.afterDecline,
  ].filter(Boolean)
}

export async function demand(options) {
  const config = configure(DEFAULT_DEMAND, options)

  if (isHashmapLike(options.class)) {
    config.class = { ...DEFAULT_DEMAND.class, ...options.class }
  }

  let { content } = config

  // Handle discardable dialogs
  if (config.discardable) {
    const discardableId = config.discardable.id ?? config.discardable
    const { keep } = await import("../../api/keep.js")
    const confirms = await keep("~/config/confirms.json5", {})

    if (confirms[discardableId] === true) {
      return { detail: { ok: true }, target: null }
    }

    content = [
      content,
      {
        tag: ".ma-t",
        content: {
          tag: "checkbox",
          id: `discard-${discardableId}`,
          label: config.discardable.label ?? "Do not ask again",
          action: () => (confirms[discardableId] = true),
        },
      },
    ]
  }

  content = { tag: ".ui-dialog-demand__content.rows", content }

  let src = config.img

  if (config.icon) {
    src = isURLImage(config.icon)
      ? config.icon
      : await import("../../api/os/managers/iconsManager.js")
          .then(({ iconsManager }) => iconsManager.getIconPath(config.icon))
          .catch(noop)
  }

  if (src) {
    const img = new Image()
    img.src = src
    img.draggable = false
    img.fetchPriority = "high"
    img.style.userSelect = "none"
    img.setAttribute("aria-hidden", "true")

    await img.decode().catch((err) => logger.log(err))

    content = {
      tag: ".cols.shrink",
      style: { alignItems: "center" },
      content: [
        {
          tag: ".ui-dialog-demand__image.shrink.pa",
          style: { alignSelf: "start" },
          content: img,
        },
        content,
      ],
    }
  }

  config.dialog = extractDialogOptions(config)
  config.dialog.pivotKind ??= "demand"

  const dialogEl = await dialog(
    configure(
      {
        class: config.class,
        role: config.role,

        icon: config.icon,

        signal: config.signal,
        on: config.on,
        afterContent: config.afterContent,
        beforeContent: config.beforeContent,

        resizable: false,
        maximizable: false,
        minimizable: false,

        content,

        created(el) {
          let agreeEl
          el.addEventListener(
            "focusout",
            () => {
              agreeEl ??= el.querySelector(".ui-dialog__agree")
              agreeEl.classList.toggle("default", false)
            },
            { signal: el.signal },
          )
          el.addEventListener(
            "focusin",
            ({ target }) => {
              agreeEl ??= el.querySelector(".ui-dialog__agree")
              if (!agreeEl) return
              agreeEl.classList.toggle(
                "default",
                agreeEl === target || isDoneOnEnter(target),
              )
            },
            { signal: el.signal },
          )
        },
      },
      config.dialog,
    ),
  )

  return until(dialogEl, "ui:dialog.close")
}

/* MARK: alert
============== */

const DEFAULT_ALERT = {
  label: "Alert",
  class: { "ui-dialog-demand": true, "ui-dialog-alert": true },
  decline: undefined,
}

async function handleAlertError(error, config) {
  error = normalizeError(error)
  config.class = "ui-dialog-demand ui-dialog-alert ui-dialog-alert--error"

  if (config.label === DEFAULT_ALERT.label) {
    config.label = error.name
  }

  config.icon ??= "error"
  config.resizable = true

  if (error.stack) {
    const { displayError } = await import("../../api/log/displayError.js")
    const content = displayError(error, { skipMessage: true })
    config.afterContent = {
      tag: "samp.ui-dialog-alert__error.code.relative.block.grow.txt-pre.scroll-xy-auto.inset-shallow.pa.ma-b-false",
      content: [
        {
          tag: "button.reveal.sticky.float.top-gap.right-gap",
          picto: "clipboard",
          title: "Copy to clipboard",
          action: async (e, target) => {
            const { clipboard } = await import("../../api/io/clipboard.js")
            const text = `${error.message}\n${target.nextElementSibling.textContent}`
            clipboard.copy(text, { notif: true })
          },
        },
        {
          tag: "span",
          content,
        },
      ],
      async created(el) {
        const dialogEl = el.closest("ui-dialog")
        if (!dialogEl) return
        await dialogEl.ready
        dialogEl.resize()
        el.previousElementSibling.style.flexGrow = 0
        el.previousElementSibling.style.flexShrink = 0
        el.style.maxBlockSize = "none"
      },
    }
  }

  config.message = error.message

  logger.group("alert")
  logger.log(error)
  logger.groupCollapsed("details")
  logger.dir(error)
  logger.groupEnd()
  logger.groupEnd()
}

/**
 * @param {Plan} message
 * @param {any} [options]
 */
export async function alert(message = "", options) {
  let config

  if (isErrorLike(message)) {
    config = configure(DEFAULT_ALERT, options)
    await handleAlertError(message, config)
  } else if (options === undefined && message && isHashmapLike(message)) {
    // @ts-ignore
    config = configure(DEFAULT_ALERT, message)
  } else {
    config = configure(DEFAULT_ALERT, options)
    config.message = message
  }

  if (config.agree) {
    config.agree = toPlanObject(config.agree)
    config.agree.autofocus ??= true
  }

  config.content ??= {
    tag: ".pa-md",
    content: config.message,
  }

  await demand(config)
  return true
}

/* MARK: confirm
================ */

const DEFAULT_CONFIRM = {
  label: "Confirm",
  class: { "ui-dialog-demand": true, "ui-dialog-confirm": true },
}

/**
 * @param {Plan} message
 * @param {any} [options]
 */
export async function confirm(message = "", options) {
  if (options === undefined && message && typeof message === "object") {
    options = message
    message = options.message
  }

  const config = configure(DEFAULT_CONFIRM, options)

  if (config.agree) {
    config.agree = toPlanObject(config.agree)
    config.agree.autofocus = true
  }

  config.content = {
    tag: ".center-content-y.pa-md",
    content: { tag: ".ui-dialog-confirm__message", content: message },
  }

  const res = await demand(config)
  return Boolean(res.detail.ok)
}

/* MARK: prompt
=============== */

const DEFAULT_PROMPT = {
  label: "Prompt",
  class: { "ui-dialog-demand": true, "ui-dialog-prompt": true },
  tag: "input",
  value: "",
  prose: true,
  enterKeyHint: undefined,
}

/**
 * @param {Plan} message
 * @param {any} [options]
 */
export async function prompt(message = "", options) {
  if (options === undefined && message && typeof message === "object") {
    options = message
    message = options.message
  }

  if (typeof options === "string") options = { value: options }

  if (options?.tag === undefined && options?.value?.includes?.("\n")) {
    options ??= {}
    options.tag = "textarea"
    options.rows = 3
  }

  const config = configure(DEFAULT_PROMPT, options)

  const onEnter = config.tag.startsWith("textarea")
    ? { enterKeyHint: "enter", rows: 3 }
    : {
        enterKeyHint: config.enterKeyHint ?? "done",
        on: { Enter: checkIfDoneOnEnter },
      }

  const id = uid()

  config.content = {
    tag: ".rows",
    content: [
      config.beforefield,
      {
        // Don't use label element because text in prompt could be long and multiline.
        tag: ".control",
        aria: { hidden: true },
        content: message,
      },
      configure(
        {
          tag: config.tag,
          id,
          aria: { label: message ?? "" },
          prose: config.prose,
          value: config.value,
        },
        config.field,
        onEnter,
      ),
      config.afterfield,
    ],
  }

  const res = await demand(config)
  const field = res.target.querySelector("input,textarea,select")
  return res.detail.ok ? String(field.value) : undefined
}

/* MARK: form
================ */

function checkIfDoneOnEnter(e, target) {
  if (isDoneOnEnter(e.target)) {
    e.preventDefault()
    const dialogEl = target.closest("ui-dialog")
    if (dialogEl) {
      const agreeEl = dialogEl.querySelector(".ui-dialog__agree")
      if (agreeEl?.disabled) return
      dialogEl.close(true)
    }
  }
}

function isDoneOnEnter(el) {
  if (el.type === "checkbox" || el.type === "radio" || el.localName === "a") {
    return false
  }
  return (
    el.localName !== "button" &&
    // el.localName !== "textarea" &&
    (!el.enterKeyHint ||
      el.enterKeyHint === "done" ||
      el.enterKeyHint === "send")
  )
}

const DEFAULT_FORM = {
  label: "Form",
  class: "ui-dialog-demand ui-dialog-form",
  pivotKind: "form",
  resizable: true,
  minimizable: true,
}

export async function form(plan, options) {
  if (!plan) return

  const config = configure(DEFAULT_FORM, options)

  let fieldset = plan.fieldset ?? options?.fieldset
  delete plan.fieldset
  if (options) delete options.fieldset

  if (plan.tag?.startsWith("ui-tabs")) {
    fieldset ??= {}
    fieldset.class ??= {}
    fieldset.class["pa-x-false"] = true
    fieldset.class["pa-t-false"] = true
  }

  let fieldsetEl

  const events = [{ Enter: checkIfDoneOnEnter }]

  if (fieldset?.on) {
    if (Array.isArray(fieldset.on)) events.push(...fieldset.on)
    else Object.assign(events[0], fieldset.on)
    delete fieldset.on
  }

  const fieldsetClass = config.piled //
    ? { piled: true }
    : config.aligned === false
      ? undefined
      : { aligned: true }

  config.content = configure(
    {
      tag: "fieldset",
      class: {
        "ui-dialog-form__fieldset": true,
        "ma-t-xs": true,
        "ma-b-xxs": true,
        ...fieldsetClass,
      },
      role: "none",
      id: uid(),
      on: events,
      content: plan,
      created(el) {
        fieldsetEl = el
        if (options?.data) setFormData(el, options?.data)
        options?.created?.(el)
      },
    },
    fieldset,
  )

  const res = await demand(config)

  return res.detail.ok ? getFormData(fieldsetEl) : undefined
}
