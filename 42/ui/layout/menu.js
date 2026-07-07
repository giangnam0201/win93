/* eslint-disable complexity */
import { Component } from "../../api/gui/Component.js"
import { getDesktopRealm } from "../../api/env/realm/getDesktopRealm.js"
import { render, toPlanString } from "../../api/gui/render.js"
import { positionable } from "../../api/gui/trait/positionable.js"
import { virtualizable } from "../../api/gui/trait/virtualizable.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { hook } from "../../lib/event/hook.js"
import { listenEventMap, on } from "../../lib/event/on.js"
import { uid } from "../../api/uid.js"
import { isPromiseLike } from "../../lib/type/any/isPromiseLike.js"
import { i18n } from "../../api/i18n.js"
import { queueTask } from "../../lib/timing/queueTask.js"
import { AimZone } from "../../api/gui/AimZone.js"
import { repaintThrottle } from "../../lib/timing/repaintThrottle.js"
import { createFuzzySearch } from "../../lib/algo/fuzzySearch.js"
import { fuzzyField } from "../../api/gui/helper/fuzzyField.js"
import { toTitleCase } from "../../lib/type/string/transform.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"

/**
 * @import {Positionable} from "../../api/gui/trait/positionable.js"
 * @typedef {HTMLElement & {value?: string, ariaControlsElements?: HTMLElement[]}} OpenerElement
 */

/** @type {MenuComponent[]} */
const menuChain = []

let forgetGlobalClick
const desktopRealm = getDesktopRealm()
const inDesktopRealm = desktopRealm === window

/**
 * @param {OpenerElement} opener
 */
function ensureOpener(opener) {
  if (!opener) opener = /** @type {OpenerElement} */ (document.activeElement)
  opener.id ||= uid()
  return opener
}

export function closeAllMenus(opener, options) {
  let lastOpener
  for (let i = menuChain.length - 1; i >= 0; i--) {
    const menuEl = menuChain[i]
    if (menuEl.contains(opener)) {
      if (options?.stealFocus !== false) menuEl.focus()
      menuEl.highlight(opener.dataset.index, opener)
      menuChain.length = i + 1
      return
    }
    lastOpener = menuEl.openerEl
    menuEl.close({ ignoreChain: true })
  }

  menuChain.length = 0

  if (lastOpener?.role === "menuitem") {
    const menuEl = /** @type {MenuComponent} */ (
      lastOpener.parentElement?.parentElement
    )
    if (menuEl?.highlight) {
      if (options?.fromAction) {
        menuEl.highlight(-1)
        if (options?.stealFocus !== false) {
          const focusTarget = /** @type {HTMLElement} */ (
            menuEl.savedFocus ?? menuEl.openerEl
          )
          focusTarget?.focus?.()
        }
      } else {
        if (options?.stealFocus !== false) menuEl.focus()
        menuEl.highlight(lastOpener.dataset.index, lastOpener)
      }
      lastOpener = undefined
    }
  }

  if (options?.stealFocus !== false && !options?.fromAction) {
    lastOpener?.focus()
  }

  forgetGlobalClick?.()
  forgetGlobalClick = undefined
}

function keyeventProxyToHoveredMenu(menuEl, e) {
  if (menuEl.isHovered) {
    if (menuEl !== document.activeElement) {
      e.preventDefault()
      e.stopPropagation()
      menuEl.pauseFocusEvent = true
      menuEl.focus()
      menuEl.pauseFocusEvent = false
      menuEl.dispatchEvent(new e.constructor(e.type, e))
    }
    return true
  }
}

function menubarCycleSubmenu(dir) {
  const menuEl = /** @type {MenuComponent} */ (document.activeElement)
  if (menuEl?.role === "menubar") {
    menuEl[`highlight${dir}`]()
    if (menuEl.currentItem?.ariaHasPopup) {
      menuEl.openSubmenu(menuEl.currentItem.dataset.index, menuEl.currentItem)
    }
  }
}

// MARK: Aim
// =========

if (inDesktopRealm) {
  const aim = new AimZone({ selector: ":is(ui-menu) > li" })

  document.addEventListener("ui:menu.open", ({ target }) => {
    if (target.openerEl?.role !== "menuitem") return
    aim.setTarget(target, "horizontal")
    target.positionable.on("place", async () => {
      aim.setTarget(target, "horizontal")
    })
  })

  document.addEventListener("ui:menu.close", ({ target }) => {
    if (target === aim.target) aim.reset()
  })
}

// MARK: menu
// ==========

export async function menu(plan, options) {
  if (options?.inline) return new MenuComponent(plan)

  const opener = ensureOpener(options?.opener)

  if (opener.ariaExpanded === "true") {
    // If submenu is open by pointerover and then ArrowLeft is pressed
    if (options?.stealFocus !== false && opener.role === "menuitem") {
      opener.ariaControlsElements?.[0]?.focus()
    }
    return
  }

  if (options?.contained !== true) {
    if (!inDesktopRealm && desktopRealm.sys42?.menu) {
      const topRealmMenu = desktopRealm.sys42.menu
      if (window.frameElement && isInstanceOf(options.of, Event)) {
        const rect = window.frameElement.getBoundingClientRect()
        const x = options.of.x + rect.left
        const y = options.of.y + rect.top
        options.of = { x, y }
      }
      const menuEl = await topRealmMenu(plan, { ...options, opener })
      if (menuEl) {
        queueTask(() => {
          listenEventMap({
            signal: menuEl.signal,
            pointerdown: () => menuEl.close(),
          })
        })
      }
      return menuEl
    }
  }

  opener.ariaExpanded = "true"

  closeAllMenus(opener)
  queueTask(() => {
    forgetGlobalClick ??= listenEventMap({
      pointerdown: () => closeAllMenus(),
      blur: () => document.hasFocus() && closeAllMenus(),
    })
  })

  const el = new MenuComponent(plan)
  el.fromMenubar = options?.fromMenubar
  el.openerEl = opener
  opener.ariaControlsElements = [el]

  menuChain.push(el)
  document.body.append(el)

  await el.ready

  el.positionable = positionable(el, {
    signal: el.signal,
    preset:
      options?.preset ?? (opener.role === "menuitem" ? "submenu" : "popup"),
    of: options?.of ?? opener,
  })

  if (options?.stealFocus !== false) {
    el.pauseFocusEvent = true
    el.focus()
    el.pauseFocusEvent = false
    if (options?.highlightFirst !== false) el.highlightFirst()
  }

  dispatch(el, "ui:menu.open")

  return el
}

menu.closeAllMenus = closeAllMenus

// MARK: Menu
// ==========

export class MenuComponent extends Component {
  static plan = {
    tag: "ui-menu",
    role: "menu",
    id: true,
  }

  isMenubar = false
  isToolbar = false
  isBar = false

  fromMenubar = false
  autopick = true

  current = -1

  /** @type {OpenerElement} */
  openerEl

  /** @type {Positionable} */
  positionable

  emptyLabel = i18n("<empty menu>")

  pictoOnly = undefined
  displayPicto = undefined
  popupArrow = undefined
  fuzzySearch = undefined
  captureKeydown = undefined
  previewSubmenu = undefined
  /** @type {string | undefined} Overrides the default item role (menuitem). */
  itemRole = undefined

  isVertical = true

  _content
  get content() {
    return this._content
  }
  set content(content) {
    this._content = content
    if (this.isRendered) this.rerender()
  }

  #orientation
  get orientation() {
    return this.#orientation
  }
  set orientation(orientation) {
    this.#orientation = orientation
    this.isVertical = orientation !== "horizontal"
    if (this.isRendered) this.ariaOrientation = orientation
  }

  #virtualizable
  /** @protected */
  get virtualizable() {
    return this.#virtualizable
  }
  get totalItems() {
    return this.items.length - 1
  }

  // MARK: activate
  // --------------
  activate(idx, e, target) {
    if (target?.disabled || target?.dataset.disabled === "true") return

    if (target.localName === "label") {
      target = target.querySelector("input")
      if (target.type === "radio") {
        if (!target.checked) target.checked = true
      } else target.checked = !target.checked
      target.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true }),
      )
      target.dispatchEvent(
        new Event("change", { bubbles: true, cancelable: true }),
      )
    }

    this.items[idx]?.action?.(e, target)
    target.dispatchEvent(new CustomEvent("ui:menuitem.activate"))

    if (!e.ctrlKey) closeAllMenus(undefined, { fromAction: true })
  }

  // MARK: openSubmenu
  // --------------
  openSubmenu(idx, opener, options) {
    idx = Number(idx)
    if (idx in this.items === false) return
    opener ??= this.#virtualizable.scrollToElement(idx)?.firstChild

    if (opener.disabled || opener.dataset.disabled === "true") return

    return menu(this.items[idx].content, {
      opener,
      signal: this.signal,
      preset: this.isBar ? "popup" : "submenu",
      fromMenubar: this.isMenubar,
      ...options,
    })
  }

  // MARK: closeSubmenus
  // -------------------
  closeSubmenus() {
    if (this.currentItem) closeAllMenus(this.currentItem, { stealFocus: false })
  }

  // MARK: highlight
  // ---------------
  highlight(idx, currentItem) {
    idx = Number(idx)
    if (this.current === idx) return

    this.currentItem?.classList.remove(`${this.itemClass}--highlight`)

    if (idx === -1) {
      this.last = this.current
      this.current = idx
      this.currentItem = undefined
      this.ariaActiveDescendantElement = null
      return
    }

    this.current = idx

    if (currentItem) {
      this.currentItem = currentItem
    } else {
      this.pauseScrollEvent = true
      this.currentItem = this.#virtualizable.scrollToElement(idx)?.firstChild
      queueTask(() => (this.pauseScrollEvent = false))
    }

    if (!this.currentItem) return false
    if (
      this.currentItem.disabled ||
      this.currentItem.dataset.disabled === "true"
    ) {
      return false
    }
    this.lastDisabledItem = undefined

    this.currentItem.classList.add(`${this.itemClass}--highlight`)
    this.dispatchEvent(new Event("ui:menu.highlight", { bubbles: true }))

    this.ariaActiveDescendantElement =
      this.currentItem.localName === "label"
        ? this.currentItem.querySelector("input")
        : this.currentItem

    return this.currentItem
  }

  highlightPrev(n) {
    let idx = this.current - (n ? Math.min(n, this.totalItems) : 1)
    if (idx < 0) idx = this.totalItems
    if (this.highlight(idx) === false) {
      if (this.currentItem === this.lastDisabledItem) return
      this.lastDisabledItem ??= this.currentItem
      this.highlightPrev()
    }
  }

  highlightNext(n) {
    let idx = this.current + (n ? Math.min(n, this.totalItems) : 1)
    if (idx > this.totalItems) idx = 0
    if (this.highlight(idx) === false) {
      if (this.currentItem === this.lastDisabledItem) return
      this.lastDisabledItem ??= this.currentItem
      this.highlightNext()
    }
  }

  highlightFirst(options) {
    if (options?.restoreLast && this.last) {
      if (this.last in this.items && this.items[this.last].disabled !== true) {
        return this.highlight(this.last)
      }
      this.last = undefined
    }
    this.highlight(this.totalItems)
    this.highlightNext()
  }

  highlightLast() {
    this.highlight(0)
    this.highlightPrev()
  }

  // MARK: renderItem
  // ----------------
  renderItem(plan, index) {
    if (!plan) return

    if (plan === "---") return document.createElement("hr")

    if (plan.spacer) {
      if (!this.isBar) return document.createElement("hr")
      const div = document.createElement("div")
      div.className = this.isVertical ? "ma-b-auto" : "ma-l-auto"
      return div
    }

    const tag = plan.tag ?? `button.${this.itemClass}`

    const isCheckbox = plan.tag ? plan.tag.startsWith("checkbox") : false
    const isRadio = plan.tag ? plan.tag.startsWith("radio") : false
    const needLabel = isCheckbox || isRadio

    const control = {
      ...plan,
      tag,
      role:
        this.itemRole ??
        (isCheckbox
          ? "menuitemcheckbox"
          : isRadio
            ? "menuitemradio"
            : "menuitem"),
      tabIndex: -1,
      aria: {},
      picto: undefined,
      action: undefined,
      shortcut: undefined,
    }

    // control.id ??= `menuitem_${this.id}_${index}`

    const wrapper = needLabel
      ? {
          tag: this.isToolbar
            ? `label.${this.itemClass}.button.pointer-instant`
            : `label.${this.itemClass}`,
          role: "none",
        }
      : control

    wrapper.content = []

    if (this.isMenubar ? this.displayPicto : this.displayPicto !== false) {
      wrapper.picto = plan.picto
    }

    wrapper.dataset = { index }

    if (this.isToolbar) {
      control.disabled = plan.disabled
    } else {
      wrapper.dataset.disabled = plan.disabled
    }

    let { label } = plan

    if (!label) {
      if (plan.title) {
        label = plan.title
      } else if (isRadio) {
        if (control.value) {
          label = toTitleCase(String(control.value))
        }
      } else if (isCheckbox) {
        if (control.name) {
          label = toTitleCase(String(control.name))
        }
      }
    }

    if (
      wrapper.picto &&
      ((!plan.label && wrapper.picto) ||
        (this.isToolbar && this.pictoOnly !== false))
    ) {
      wrapper.tag += `.${this.itemClass}--picto-only`
    }

    if (plan.picto && this.isToolbar && this.pictoOnly !== false) {
      wrapper.title = toPlanString(label)
    } else if (plan.shortcut && !this.isBar) {
      wrapper.aria.keyshortcuts = plan.shortcut
      wrapper.content = [
        { tag: "span", content: label },
        { tag: "kbd", aria: { hidden: true }, content: plan.shortcut },
      ]
    } else if (label) {
      wrapper.content = [
        { tag: "span", content: label }, //
      ]
    }

    if (needLabel) {
      wrapper.content.unshift(control)
    }

    if (plan.content) {
      wrapper.aria.haspopup = "menu"
      if (wrapper.content && (!this.isBar || this.popupArrow === true)) {
        wrapper.content.push({
          tag: "ui-picto",
          value: this.isVertical ? "right" : "down",
        })
      }
    }

    const el = render({
      tag: "li",
      role: "none",
      class: control.role === "menuitemradio" ? "list-item--radio" : undefined,
      content: wrapper,
    })

    return el
  }

  /* MARK: inited
  --------------- */

  inited() {
    this.isHovered = false

    this.tabIndex = 0

    this.orientation ??=
      this.isToolbar || this.isMenubar //
        ? "horizontal"
        : "vertical"

    this.ariaOrientation = this.orientation

    this.itemClass = this.isToolbar ? "ui-toolbar__item" : "ui-menu__menuitem"

    const { signal } = this
    this.#virtualizable = virtualizable(this, {
      signal,
      renderElement: (item, i) => this.renderItem(item, i),
      usePadding: this.isBar,
      buffer: this.isBar ? Infinity : 5,
    })

    this.addEventListener(
      "pointerdown",
      () => {
        const active = document.activeElement
        if (active && active !== this && !this.contains(active)) {
          if (!active.closest("ui-menu, ui-menubar, ui-toolbar")) {
            this.savedFocus = active
          }
        }
      },
      { capture: true, signal },
    )

    this.addEventListener(
      "focusin",
      (e) => {
        const active = /** @type {HTMLElement} */ (e.relatedTarget)
        if (active && active !== this && !this.contains(active)) {
          if (!active.closest("ui-menu, ui-menubar, ui-toolbar")) {
            this.savedFocus = active
          }
        }
      },
      { signal },
    )
  }

  /* MARK: render
  --------------- */

  async render() {
    let items = this._content ?? []

    if (typeof items === "function") {
      items = await items(this)
    } else if (isPromiseLike(items)) {
      items = await items
    }

    if (this.signal.aborted) return

    hook(this, `ui:${this.role}.items`, { items })

    this.items = items
    this.current = -1
    this.currentItem = undefined
    this.last = undefined
    this.lastDisabledItem = undefined
    this.ariaActiveDescendantElement = null

    if (this.fuzzySearch !== false) {
      const fuzzySearch = createFuzzySearch(this.items, {
        getText: (obj) => {
          if (!obj) return
          if (obj.disabled !== true) {
            if (obj.label && typeof obj.label === "string") return obj.label
            if (
              obj.tag?.startsWith("checkbox") &&
              typeof obj.name === "string"
            ) {
              return obj.name
            }
            if (obj.value && typeof obj.value === "string") return obj.value
          }
        },
      })

      this.fuzzyField = fuzzyField(
        this,
        { fuzzySearch, signal: this.signal },
        ({ index }) => this.highlight(index),
      )
    }

    if (this.#virtualizable) {
      this.#virtualizable.items = items
    } else {
      for (let i = 0, l = items.length; i < l; i++) {
        this.append(this.renderItem(items[i], i))
      }
    }

    if (items.length === 0 && !this.isBar) {
      return {
        tag: "li",
        role: "none",
        content: [
          {
            tag: `.${this.itemClass}.${this.itemClass}--empty`,
            content: this.emptyLabel,
            dataset: { disabled: true, index: 0 },
          },
        ],
      }
    }
  }

  /* MARK: created
  ---------------- */

  created() {
    let pointer
    let activateIfNotScrolling = false

    const scrollHandler = repaintThrottle(() => {
      if (!pointer) return

      let target = /** @type {HTMLElement} */ (
        document.elementFromPoint(pointer.x, pointer.y)
      )

      while (target && target.parentElement?.parentElement !== this) {
        target = target.parentElement
      }

      if (target) {
        this.highlight(target.dataset.index, target)
      }
    })

    const upHandler = (e, target) => {
      if (e.pointerType !== "touch") return
      if (e.type === "pointerup" && activateIfNotScrolling) {
        this.activate(target.dataset.index, e, target)
      }
      activateIfNotScrolling = false
    }
    const downHandler = (e, target) => {
      const isDown = e.type === "pointerdown"
      const isMove = !isDown

      if (isMove && this.autopick === false) return

      const isTouch = e.pointerType === "touch"

      e.preventDefault()
      if (isDown) e.stopPropagation()

      pointer = e
      this.isHovered = true
      if (isDown) activateIfNotScrolling = false
      const idx = Number(target.dataset.index)

      const isChanging = this.current !== idx

      if (isDown && isChanging) this.closeSubmenus()
      const itemFound = this.highlight(idx, target)
      if (isMove && isChanging) this.closeSubmenus()

      if (itemFound === false) return

      if (
        this.isMenubar && //
        isMove &&
        document.activeElement !== this
      ) {
        return
      }

      if (target.ariaHasPopup) {
        if (target.ariaExpanded !== "true") {
          this.openSubmenu(idx, target, { stealFocus: false })
        }
      } else if (isDown) {
        if (isTouch) activateIfNotScrolling = true
        else this.activate(target.dataset.index, e, target)
      }
    }

    const ArrowOpen = this.isVertical ? "ArrowRight" : "ArrowDown"
    const ArrowClose = this.isVertical ? "ArrowLeft" : "ArrowUp"

    on(
      this,
      { signal: this.signal },
      { contextmenu: (e) => e.preventDefault() },
      { selector: "label", click: (e) => e.preventDefault() },

      {
        "pointerdown": () => {
          this.isHovered = true
          this.pauseFocusEvent = true
          this.focus()
          this.pauseFocusEvent = false
        },
        "pointerenter": () => {
          this.isHovered = true
        },
        "pointerleave || blur": (e) => {
          if (e.pointerType === "touch") return
          this.isHovered = false
          this.highlight(-1)
          pointer = undefined
        },
        "focus": () => {
          if (this.pauseFocusEvent) return
          this.highlightFirst({ restoreLast: true })
        },
        "scroll": () => {
          if (this.pauseScrollEvent) return
          scrollHandler()
        },
      },

      {
        prevent: true,
        Escape: () => closeAllMenus(),
        Home: () => {
          this.closeSubmenus()
          this.highlightFirst()
        },
        End: () => {
          this.closeSubmenus()
          this.highlightLast()
        },
        [`Backspace || ${ArrowClose}`]: (e) => {
          closeAllMenus(this.openerEl)
          if (this.fromMenubar && e.key === "ArrowLeft") {
            menubarCycleSubmenu("Prev")
          }
        },
        [`Enter || Space || ${ArrowOpen}`]: (e) => {
          if (!this.currentItem) return
          if (this.currentItem.ariaHasPopup) {
            this.openSubmenu(this.current, this.currentItem)
          } else if (e.key !== ArrowOpen) {
            this.activate(this.current, e, this.currentItem)
          } else if (this.fromMenubar) {
            closeAllMenus(this.openerEl)
            if (this.fromMenubar && e.key === "ArrowRight") {
              menubarCycleSubmenu("Next")
            }
          }
        },
      },

      {
        repeatable: true,
        prevent: true,
        [this.isVertical ? "ArrowUp" : "ArrowLeft"]: () => {
          this.closeSubmenus()
          this.highlightPrev()
          if (this.previewSubmenu && this.currentItem.ariaHasPopup) {
            this.openSubmenu(this.current, this.currentItem, {
              stealFocus: false,
            })
          }
        },
        [this.isVertical ? "ArrowDown" : "ArrowRight"]: () => {
          this.closeSubmenus()
          this.highlightNext()
          if (this.previewSubmenu && this.currentItem.ariaHasPopup) {
            this.openSubmenu(this.current, this.currentItem, {
              stealFocus: false,
            })
          }
        },
        PageUp: () => {
          this.closeSubmenus()
          this.highlightPrev(10)
        },
        PageDown: () => {
          this.closeSubmenus()
          this.highlightNext(10)
        },
      },

      {
        "selector": `.${this.itemClass}`,
        "pointerup || pointercancel": upHandler,
        [this.isToolbar //
          ? "pointerdown"
          : "pointermove || pointerdown"]: downHandler,
      },

      window,
      this.captureKeydown === false
        ? undefined
        : {
            capture: true,
            keydown: (e) => {
              if (keyeventProxyToHoveredMenu(this, e) === true) return
              for (const menuEl of menuChain) {
                if (keyeventProxyToHoveredMenu(menuEl, e) === true) return
              }
            },
          },
    )
  }

  /* MARK: close
  -------------- */

  close(options) {
    const opener = this.openerEl
    if (opener) {
      if (opener.ownerDocument === document) {
        opener.ariaExpanded = "false"
        opener.ariaControlsElements = null
      } else {
        // Prevent a blur event form top realm to set expanded to false before checking it in menu()
        queueTask(() => {
          opener.ariaExpanded = "false"
          opener.ariaControlsElements = null
        })
      }
    }

    if (options?.ignoreChain !== true) {
      for (let i = menuChain.length - 1; i >= 0; i--) {
        const menuEl = menuChain[i]
        if (menuEl === this) {
          menuChain.length = i
          break
        }
        menuEl.close()
      }
    }

    dispatch(this, `ui:${this.role}.close`)
    this.destroy()
  }

  destroyed() {
    this.fuzzyField = undefined
  }
}

// MARK: Menubar
// =============

export class MenubarComponent extends MenuComponent {
  isMenubar = true
  isBar = true

  static plan = {
    tag: "ui-menubar",
    role: "menubar",
    id: true,
  }
}

// MARK: Toolbar
// =============

export class ToolbarComponent extends MenuComponent {
  isToolbar = true
  isBar = true

  static plan = {
    tag: "ui-toolbar",
    role: "toolbar",
    id: true,
  }
}

export const inlineMenu = Component.define(MenuComponent)
export const menubar = Component.define(MenubarComponent)
export const toolbar = Component.define(ToolbarComponent)
