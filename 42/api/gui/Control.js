// https://dev.to/stuffbreaker/custom-forms-with-web-components-and-elementinternals-4jaj
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement

import { Component } from "./Component.js"

const requiredInput = document.createElement("input")
requiredInput.required = true

export class Control extends Component {
  #isControl = true
  static isControl(val) {
    return val && typeof val === "object" ? #isControl in val : false
  }

  static formAssociated = true
  static observedAttributes = ["value"]
  #internals

  constructor(plan) {
    super(plan)
    this.#internals = this.attachInternals()
  }

  #type
  get type() {
    this.#type ??= this.localName.startsWith("ui-")
      ? this.localName.slice(3)
      : this.localName
    return this.#type
  }

  get form() {
    return this.#internals.form
  }

  get labels() {
    return this.#internals.labels
  }

  get name() {
    return this.getAttribute("name")
  }
  set name(value) {
    this.setAttribute("name", value)
  }

  get disabled() {
    return this.hasAttribute("disabled")
  }
  set disabled(value) {
    this.toggleAttribute("disabled", Boolean(value))
  }

  get required() {
    return this.hasAttribute("required")
  }
  set required(value) {
    this.toggleAttribute("required", Boolean(value))
  }

  // MARK: Value
  // -----------

  #value = ""
  get value() {
    return String(this.#value)
  }
  set value(value) {
    this.setValue(value)
  }

  setValue(value, options) {
    this.#value = value
    this.#internals.setFormValue(value)
    this.setValidity()

    if (options?.fromInput !== true) this.valueChanged(value)

    if (this.config.dispatchChange !== false) {
      this.dispatchEvent(new Event("change", { bubbles: true }))
    }
  }

  valueChanged(_) {}

  // MARK: Validity
  // --------------

  setValidity() {
    if (this.required && !this.#value) {
      this.#internals.setValidity(
        { valueMissing: true },
        requiredInput.validationMessage,
      )
    } else {
      this.#internals.setValidity({ valueMissing: false })
    }
  }

  // MARK: recordable
  // ----------------

  #recordable
  get recordable() {
    return this.hasAttribute("recordable")
  }
  set recordable(value) {
    this.toggleAttribute("recordable", Boolean(value))
    if (value) {
      this.#recordable?.destroy()
      if (!value) return
      Promise.all([
        import("../configure.js"),
        import("./trait/recordable.js"),
        import("../env/realm/getDesktopRealm.js"),
      ]).then(([{ configure }, { recordable }, { getDesktopRealm }]) => {
        const { signal } = this
        const audioContext = getDesktopRealm().sys42.mixer.context
        // let audioContext
        let options = /** @type {any} */ (value)
        if (typeof value === "string") options = { key: options }
        const config = configure({ signal, audioContext }, options)
        this.#recordable = recordable(this, config)
      })
    }
  }

  formDisabledCallback(disabled) {
    console.log("formDisabled", disabled)
  }

  formResetCallback() {
    console.log("formReset")
  }

  checkValidity() {
    return this.#internals.checkValidity()
  }

  reportValidity() {
    return this.#internals.reportValidity()
  }

  get validity() {
    return this.#internals.validity
  }

  get validationMessage() {
    return this.#internals.validationMessage
  }

  connectedCallback() {
    super.connectedCallback()
    this.setValidity()
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0
  }

  attributeChangedCallback(key, prev, value) {
    super.attributeChangedCallback(key, prev, value)
    if (key === "value") this.value = value
  }
}

export class NumericControl extends Control {
  get valueAsNumber() {
    return Number(this.value)
  }
  set valueAsNumber(value) {
    this.value = /** @type {any} */ (value)
  }
}
