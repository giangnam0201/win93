import { Canceller } from "../../lib/class/Canceller.js"
import { ensureElement } from "../../lib/type/element/ensureElement.js"

const { ELEMENT_NODE } = Node

const _EVENTS = Symbol.for("Emitter.EVENTS")
const _INSTANCES = Symbol.for("Trait.INSTANCES")

export class Trait {
  #isTrait = true

  static isTrait(val) {
    return val && typeof val === "object" ? #isTrait in val : false
  }

  static INSTANCES = _INSTANCES

  /**
   * @param {string | HTMLElement} el
   * @param {object} [options]
   */
  constructor(el, options) {
    el = ensureElement(el)

    const name = options?.name ?? this.constructor.name.toLowerCase()

    el[_INSTANCES] ??= {}
    const previous = el[_INSTANCES][name]
    if (previous) previous.destroy()
    el[_INSTANCES][name] = this

    this.el = el
    this.name = name

    const { cancel, signal } = new Canceller()
    this.cancel = cancel
    this.signal = signal

    options?.signal?.addEventListener("abort", () => this.destroy())
  }

  destroy() {
    this.cancel(`${this.name} destroyed`)

    if (_EVENTS in this) {
      // @ts-ignore
      this.emit("destroy", this).off("*")
      delete this[_EVENTS]
    }

    if (this.el && this.el.nodeType === ELEMENT_NODE) {
      delete this.el[_INSTANCES][this.name]
    }
  }
}
