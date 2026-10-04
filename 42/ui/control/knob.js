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
import {
  attachMidiLearnCommon,
  disarm as disarmMidiLearn,
  unbindElement as unbindMidi,
} from "../../api/os/midiControl.js"

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

    // MIDI Learn: hold "Alt" while this knob has focus (click or Tab to
    // focus it first, same as the existing Arrow key support below --
    // nothing new to wire up for that part) to arm it, then move a
    // physical MIDI controller -- the next Control Change or Note message
    // received anywhere gets bound to this knob specifically. Incoming
    // 0-127 values are scaled into this knob's own min/max range, same
    // math as the mouse drag above. The arm/disarm/unbind wiring itself is
    // attachMidiLearnCommon() from 42/api/os/midiControl.js, shared with
    // every other MIDI-learnable control in the OS -- it never requests
    // MIDI access on its own; arming here is a no-op until the user has
    // explicitly turned MIDI Control on elsewhere (Mixer's "Enable MIDI
    // Control" menu checkbox).
    const applyMidiValue = (value) => {
      const { min: midiMin, max: midiMax } = getNumericRange(this)
      const scaled = scale(value, 0, 127, midiMin, midiMax)
      if (scaled === this.valueAsNumber) return
      setValidNumericValue(this, scaled)
      this.dispatchEvent(new Event("input", { bubbles: true }))
      this.dispatchEvent(new Event("change", { bubbles: true }))
    }

    // Whether "Alt" is currently physically held with this knob focused --
    // gates Delete/Backspace below so the "reset to default value" gesture
    // a few lines down doesn't also fire on Alt+Delete (the unbind combo,
    // wired by attachMidiLearnCommon itself). Kept in sync via
    // onArmChange, the one thing this knob needs beyond the shared
    // arm/disarm/grace-period wiring every other MIDI-learnable control
    // uses as-is (see midiControl.js).
    let midiLearnArmed = false
    attachMidiLearnCommon(this, applyMidiValue, {
      onArmChange: (armed) => {
        midiLearnArmed = armed
      },
    })

    signal.addEventListener("abort", () => {
      disarmMidiLearn(this)
      unbindMidi(this)
    })

    on(
      this,
      { signal },
      {
        "dblclick || contextmenu || Delete": (e) => {
          // Bare Delete while "Alt" is held means "unbind", handled by
          // attachMidiLearnCommon()'s own keydown listener above -- don't
          // also reset the value here.
          if (e?.key === "Delete" && midiLearnArmed) return false
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
