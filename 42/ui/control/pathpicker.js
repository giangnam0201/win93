import "../media/picto.js"

import { Control } from "../../api/gui/Control.js"
import { filePickerOpen } from "../desktop/explorer.js"
import { dispatch } from "../../lib/event/dispatch.js"

export class PathpickerControl extends Control {
  static plan = {
    tag: "ui-pathpicker",
    tabIndex: -1,
    on: {
      focus: (e, target) => {
        if (target === document.activeElement) {
          target.#inputEl.focus()
        }
      },
    },

    props: {
      accept: true,
      multiple: true,
      directory: true,
      startIn: true,
    },
  }

  get accept() {
    return this.getAttribute("accept")
  }
  set accept(value) {
    this.setAttribute("accept", value)
  }

  get multiple() {
    return this.hasAttribute("multiple")
  }
  set multiple(value) {
    this.toggleAttribute("multiple", Boolean(value))
  }

  get directory() {
    return this.hasAttribute("directory")
  }
  set directory(value) {
    this.toggleAttribute("directory", Boolean(value))
  }

  get startIn() {
    return this.getAttribute("startin")
  }
  set startIn(value) {
    this.setAttribute("startin", value)
  }

  get excludeAcceptAllOption() {
    return this.hasAttribute("excludeacceptalloption")
  }
  set excludeAcceptAllOption(value) {
    this.toggleAttribute("excludeacceptalloption", Boolean(value))
  }

  /** @type {HTMLInputElement} */
  #inputEl

  valueChanged() {
    if (!this.#inputEl) return
    this.#inputEl.value = this.value
  }

  async showPicker() {
    let path = this.value
    let event = dispatch(this, "ui:before-picker", {
      cancelable: true,
      detail: { path },
    })
    if (event.defaultPrevented) return
    path = event.detail.path

    const id = this.name
      ? `input-path-${this.name}`
      : this.id
        ? `input-path-${this.id}`
        : undefined

    const res = await filePickerOpen({
      id,
      path,
      startIn: this.startIn,
      accept: this.accept,
      multiple: this.multiple,
      directory: this.directory,
      excludeAcceptAllOption: this.excludeAcceptAllOption,
    })
    if (!res.ok) return

    path = res.selection.join(", ")
    event = dispatch(this, "ui:after-picker", {
      cancelable: true,
      detail: { path },
    })
    if (event.defaultPrevented) return
    this.value = event.detail.path
    this.dispatchEvent(new Event("input", { bubbles: true }))
  }

  render() {
    return [
      {
        tag: "input.clear",
        role: "none",
        value: this.value,
        on: {
          "input || change": (e, target) => {
            this.setValue(target.value, { fromInput: true })
          },
        },
        created: (el) => {
          this.#inputEl = el
        },
      },
      {
        tag: "button.addon",
        picto: "folder-open", // folder-search
        on: {
          "disrupt": true,
          "pointerdown || Enter || Space": () => this.showPicker(),
        },
      },
    ]
  }
}

export const pathpicker = Control.define(PathpickerControl)
