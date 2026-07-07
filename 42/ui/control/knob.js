import { NumericControl } from "../../api/gui/Control.js"
import { Dragger } from "../../lib/dom/Dragger.js"
import { on } from "../../lib/event/on.js"
import {
  decrementNumericValue,
  getNumericMax,
  getNumericMin,
  getNumericRange,
  incrementNumericValue,
  setFractionProp,
  setValidNumericValue,
  stepsNumericValue,
} from "../../lib/type/element/setControlData.js"
import { scale } from "../../lib/type/number/math.js"

export class KnobControl extends NumericControl {
  static plan = {
    tag: "ui-knob",
    options: {
      valueType: "number",
      dispatchChange: false,
    },
  }

  get step() {
    return this.getAttribute("step") ?? ""
  }
  set step(value) {
    this.setAttribute("step", value)
  }

  get min() {
    return this.getAttribute("min") ?? ""
  }
  set min(value) {
    this.setAttribute("min", value)
  }

  get max() {
    return this.getAttribute("max") ?? ""
  }
  set max(value) {
    this.setAttribute("max", value)
  }

  get centerDetent() {
    return this.hasAttribute("centerdetent")
  }
  set centerDetent(value) {
    this.toggleAttribute("centerdetent", Boolean(value))
  }

  render() {
    return [
      {
        tag: ".ui-knob__ring-box",
        content: [
          { tag: ".ui-knob__center" }, //
          { tag: ".ui-knob__ring" },
        ],
      },
      {
        tag: ".ui-knob__cap-box",
        content: {
          tag: ".ui-knob__cap",
          content: {
            tag: ".ui-knob__indicator",
          },
        },
      },
    ]
  }

  valueChanged() {
    let val = this.valueAsNumber
    const { min, max } = getNumericRange(this)

    if (val > max) {
      val = max
      this.valueAsNumber = val
    }

    if (val < min) {
      val = min
      this.valueAsNumber = val
    }

    if (this.centerDetent) {
      const half = (max + min) / 2
      this.toggleAttribute("negative", val < half)
    }

    setFractionProp(this)
  }

  created() {
    const { signal } = this

    this.setAttribute("value", this.value)

    const distance = 125
    let min
    let max
    let startFraction = 0

    this.recordable = true

    this.dragger = new Dragger(this, {
      signal,
      start: () => {
        if (this.disabled) return false
        min = getNumericMin(this)
        max = getNumericMax(this)
        startFraction = (this.valueAsNumber - min) / (max - min)
      },
      drag: (x, y) => {
        const delta = (this.dragger.fromY - y) / distance

        const { valueAsNumber } = this
        setValidNumericValue(this, scale(startFraction + delta, 0, 1, min, max))

        if (valueAsNumber === this.valueAsNumber) return
        this.dispatchEvent(new Event("input", { bubbles: true }))
      },
      stop: () => {
        this.dispatchEvent(new Event("change", { bubbles: true }))
      },
    })

    on(
      this,
      { signal },
      {
        "dblclick || contextmenu || Delete": () => {
          if (this.dataset.audioParam) return false
          if (this.value === this.getAttribute("value")) return false
          this.value = this.getAttribute("value")
          this.dispatchEvent(new Event("input", { bubbles: true }))
          this.dispatchEvent(new Event("change", { bubbles: true }))
          return false
        },
      },
      {
        "repeatable": true,
        "ArrowUp || ArrowRight": () => incrementNumericValue(this),
        "ArrowDown || ArrowLeft": () => decrementNumericValue(this),
      },
      {
        wheel: ({ deltaY, altKey, ctrlKey }) => {
          if (this === document.activeElement && this.matches(":hover")) {
            stepsNumericValue(this, -deltaY, {
              fast: ctrlKey,
              slow: !ctrlKey && altKey,
            })
            return false
          }
        },
      },
      {
        selector: ".ui-knob__center",
        click: () => {
          const { min, max } = getNumericRange(this)
          const { valueAsNumber } = this
          setValidNumericValue(this, (max + min) / 2)
          if (valueAsNumber === this.valueAsNumber) return
          this.dispatchEvent(new Event("input", { bubbles: true }))
          this.dispatchEvent(new Event("change", { bubbles: true }))
        },
      },
    )
  }
}

export const knob = NumericControl.define(KnobControl)
