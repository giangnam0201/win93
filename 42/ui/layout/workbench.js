import { pointer } from "../../api/env/device/pointer.js"
import { Component } from "../../api/gui/Component.js"
import { focusInside } from "../../lib/dom/focus.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { untilAttributeChanged } from "../../lib/type/element/untilAttributeChanged.js"
import { menu } from "./menu.js"

/** @import { ToolbarComponent } from "../../ui/layout/menu.js" */

export class WorkbenchComponent extends Component {
  static plan = {
    tag: "ui-workbench",
  }

  #pointerMoveTimerId
  #idleTimerId

  get active() {
    return this.hasAttribute("active")
  }
  set active(value) {
    const oldValue = this.hasAttribute("active")
    const newValue = Boolean(value)
    this.toggleAttribute("active", newValue)
    if (oldValue !== newValue) dispatch(this, "ui:workbench.active-change")
    if (!newValue && document.activeElement.hasAttribute("area")) {
      if (!focusInside(this.mainEl)) {
        // @ts-ignore
        document.activeElement.blur()
        this.focus()
      }
    }
  }

  created() {
    const { signal } = this

    let main
    for (const item of this.children) {
      if (item.hasAttribute("area") || item.hasAttribute("data-area")) continue
      main = item
    }

    // eslint-disable-next-line unicorn/no-this-assignment
    main ??= this
    this.mainEl = main

    document.addEventListener(
      "pointerlockchange",
      () => {
        clearTimeout(this.#pointerMoveTimerId)
        clearTimeout(this.#idleTimerId)
        this.active = !document.pointerLockElement
      },
      { signal },
    )

    this.addEventListener(
      "contextmenu",
      (e) => {
        e.preventDefault()
        this.active = false
        if (pointer.isTouch) {
          const toolbars = []
          for (const toolbarEl of /** @type {NodeListOf<ToolbarComponent>} */ (
            this.querySelectorAll("ui-toolbar")
          )) {
            if (toolbars.length > 0) toolbars.push("---")
            toolbars.push(...toolbarEl.items)
          }
          menu(toolbars, { of: e })
        }
      },
      { signal },
    )

    this.addEventListener(
      "pointerleave",
      async (e) => {
        if (e.pointerType === "touch") return
        clearTimeout(this.#pointerMoveTimerId)
        clearTimeout(this.#idleTimerId)
        const popupExpendedEl = /** @type {HTMLElement} */ (
          this.querySelector('[aria-haspopup][aria-expanded="true"]')
        )
        if (popupExpendedEl) {
          await untilAttributeChanged(
            popupExpendedEl,
            { "aria-expanded": "false" },
            { signal },
          )
        }
        this.#pointerMoveTimerId = setTimeout(() => {
          this.active = false
        }, 250)
      },
      { signal },
    )

    this.addEventListener(
      "pointerdown",
      ({ target }) => {
        if (target === main || main.contains(target)) {
          this.active = false
        }
      },
      { signal },
    )

    this.addEventListener(
      "mousemove",
      ({ target, buttons }) => {
        clearTimeout(this.#pointerMoveTimerId)
        clearTimeout(this.#idleTimerId)

        if (document.pointerLockElement !== null) return

        const popupExpendedEl = /** @type {HTMLElement} */ (
          this.querySelector('[aria-haspopup][aria-expanded="true"]')
        )

        if (popupExpendedEl) return

        if (target === main || main.contains(target)) {
          this.active = true
          this.#idleTimerId = setTimeout(() => {
            this.active = false
          }, 2500)
        } else if (buttons === 0) {
          this.active = true
        } else {
          this.active = false
        }
      },
      { signal },
    )
  }
}

export const workbench = Component.define(WorkbenchComponent)
