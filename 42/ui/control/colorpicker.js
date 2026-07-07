/* @read https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper */

import { Control } from "../../api/gui/Control.js"
import { Color } from "../../lib/syntax/color.js"

export class ColorpickerControl extends Control {
  static plan = {
    tag: "ui-colorpicker",
    tabIndex: -1,
    on: {
      focus: (e, target) => {
        if (target === document.activeElement) {
          target.#inputEl.focus()
        }
      },
    },

    props: {},
  }

  /** @type {HTMLInputElement} */
  #inputEl

  valueChanged() {
    if (!this.#inputEl) return
    this.#inputEl.value = this.value
    this.#inputEl.scrollLeft = this.#inputEl.scrollWidth
  }

  setValue(val, options) {
    if (this.color) this.color.update(val)
    else this.color = new Color(val)
    super.setValue(this.color.hex, options)
  }

  // async showPicker() {}

  render() {
    this.color = new Color(this.value)
    return [
      {
        tag: "input",
        type: "color",
        role: "none",
        value: this.color.hex,
        on: {
          "input || change": (e, target) => {
            this.setValue(target.value, { fromInput: true })
          },
        },
        created: (el) => {
          this.#inputEl = el
        },
      },
    ]
  }
}

export const colorpicker = Control.define(ColorpickerControl)
