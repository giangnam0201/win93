import "../media/picto.js"

import { Control } from "../../api/gui/Control.js"
import { dispatch } from "../../lib/event/dispatch.js"

export class ReplyControl extends Control {
  static plan = {
    tag: "ui-reply",
    tabIndex: -1,
    on: {
      focus: (e, target) => {
        if (target === document.activeElement) {
          target.#inputEl.focus()
        }
      },
    },
  }

  /** @type {HTMLInputElement} */
  #inputEl

  valueChanged() {
    if (!this.#inputEl) return
    this.#inputEl.value = this.value
    this.#inputEl.scrollLeft = this.#inputEl.scrollWidth
  }

  send() {
    const event = dispatch(this, "ui:reply.send", {
      cancelable: true,
      detail: { value: this.#inputEl.value },
    })
    if (event.defaultPrevented) return
    this.value = ""
  }

  render() {
    return [
      {
        tag: "textarea.fluid.fluid-max.clear",
        enterKeyHint: "send",
        // rows: 1,
        role: "none",
        style: {
          // "--lines": 1,
          // "transition": "block-size 0.01s",
          // "max-height": "300px",
        },
        value: this.value,
        on: {
          "input || change": (e, target) => {
            this.setValue(target.value, { fromInput: true })
            dispatch(this.#inputEl, "ui.layout")
          },
          // "focus": () => {
          //   this.#inputEl.style.setProperty("--lines", "4")
          //   dispatch(this.#inputEl, "ui.layout")
          // },
          // "blur": () => {
          //   this.#inputEl.style.setProperty("--lines", "1")
          //   dispatch(this.#inputEl, "ui.layout")
          // },
          "Enter": (e) => {
            if (e.shiftKey) return
            this.send()
            return false
          },
        },
        created: (el) => {
          this.#inputEl = el
        },
      },
      {
        tag: "button.addon",
        picto: "leaf",
        on: {
          "disrupt": true,
          "pointerdown || Enter || Space": () => {
            this.send()
          },
        },
      },
    ]
  }
}

export const reply = Control.define(ReplyControl)
