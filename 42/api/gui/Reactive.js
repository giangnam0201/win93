import { Signal } from "../env/polyfill/globalThis.Signal.js"
import { parseTemplate } from "../../lib/syntax/template/parseTemplate.js"
import { flatten } from "../../lib/type/object/flatten.js"
import { locate } from "../../lib/type/object/locate.js"
import { allocate } from "../../lib/type/object/allocate.js"
import { SignalArray } from "./reactive/SignalArray.js"

export class Reactive {
  #watcher
  #pending = false
  effects = new Set()
  state = {}
  computed = {}
  signals = {
    state: {},
    computed: {},
  }

  constructor(options) {
    this.#watcher = new Signal.subtle.Watcher(async () => {
      if (!this.#pending) {
        this.#pending = true
        await 0 // queueMicrotask
        this.#pending = false
        for (const signal of this.#watcher.getPending()) signal.get()
        this.#watcher.watch()
      }
    })

    options?.signal?.addEventListener("abort", () => this.destroy())
  }

  addStateObject(state) {
    for (const [key, val] of flatten(state, { array: false })) {
      this.setState(key, val)
    }
  }

  addComputedObject(computed) {
    for (const [key, val] of flatten(computed, { array: false })) {
      this.setComputed(key, val)
    }
  }

  setState(loc, val, checkPrev) {
    if (checkPrev) val = locate(this.state, loc)

    if (Array.isArray(val)) {
      val = new SignalArray(val)
      const s = new Signal.State(val)
      allocate(this.state, loc, val)
      allocate(this.signals.state, loc, s)
      return s
    }

    const s = new Signal.State(val)
    const descriptor = { set: (value) => s.set(value), get: () => s.get() }
    allocate(this.state, loc, descriptor, { descriptor: true })
    allocate(this.signals.state, loc, s)
    return s
  }

  setComputed(loc, fn) {
    const computed = new Signal.Computed(() => fn(this))
    const descriptor = { get: () => computed.get() }
    allocate(this.computed, loc, descriptor, { descriptor: true })
    allocate(this.signals.computed, loc, computed)
    return computed
  }

  getSignal(loc) {
    const signal =
      locate(this.signals.computed, loc) ?? locate(this.signals.state, loc)
    if (signal === undefined) return this.setState(loc, void 0, true)
    return signal
  }

  registerLoc(el, loc, cb) {
    const signal = this.getSignal(loc)
    const effect = new Signal.Computed(() => {
      if (!el.isConnected) return
      cb(signal.get())
    })
    this.effects.add(effect)
  }

  register(el, val, cb) {
    if (typeof val === "string") {
      const { strings, substitutions } = parseTemplate(val)
      if (substitutions.length === 0) cb(val)
      else if (
        substitutions.length === 1 &&
        strings.length === 2 &&
        strings[0] === "" &&
        strings[1] === ""
      ) {
        this.registerLoc(el, substitutions[0], cb)
      } else {
        const values = []
        for (let i = 0, l = substitutions.length; i < l; i++) {
          values.push(this.getSignal(substitutions[i]))
        }

        const effect = new Signal.Computed(() => {
          if (!el.isConnected) return
          let out = strings[0]

          for (let i = 0, l = substitutions.length; i < l; i++) {
            out += values[i].get() + strings[i + 1]
          }

          cb(out)
        })
        this.effects.add(effect)
      }
    } else cb(val)
  }

  unwatch(effect) {
    this.effects.delete(effect)
    this.#watcher.unwatch(effect)
  }

  watch(effect) {
    this.effects.add(effect)
    this.#watcher.watch(effect)
    effect.get()
  }

  destroy() {
    for (const item of this.effects) this.#watcher.unwatch(item)
    this.effects.clear()
    this.state = undefined
    this.computed = undefined
    this.signals = undefined
    this.#watcher = undefined
  }
}
