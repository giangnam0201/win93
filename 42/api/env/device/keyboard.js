/* eslint-disable guard-for-in */

// [1] Use capture to prevent canceled events to impact "keys" and "codes".

export class Keyboard {
  listeners = 0
  isListening = false

  keys = {}
  codes = {}
  strokes = {}

  constructor(options) {
    // aliases
    Object.defineProperties(this.keys, {
      space: { enumerable: false, get: () => this.keys[" "] },
      ctrl: { enumerable: false, get: () => this.keys.control },
      esc: { enumerable: false, get: () => this.keys.escape },
      del: { enumerable: false, get: () => this.keys.delete },
    })

    if (options?.signal) this.addSignal(options.signal)
  }

  #signals = new Set()
  addSignal(signal) {
    if (!signal) return
    this.#signals.add(signal)
    signal.addEventListener("abort", this)
  }

  onabort(e) {
    this.#signals.delete(e.target)
    e.target.removeEventListener("abort", this)
    this.forget()
  }

  onkeydown(e) {
    let { key, code, repeat } = e
    if (repeat === false) {
      if (e.ctrlKey) this.keys.control = true
      if (e.shiftKey) this.keys.shift = true
      if (e.metaKey) this.keys.meta = true
      if (e.altKey) this.keys.alt = true

      key = key.toLocaleLowerCase()
      this.keys[key] = true
      this.codes[code] = true
      // Allow keyup event to remove a "key" from it's "code"
      this.strokes[code] ??= { counter: 0, keys: [] }
      this.strokes[code].counter++
      this.strokes[code].keys.push(key)
      if (key === "altgraph") {
        this.strokes[code].keys.push("alt")
        this.keys.alt = true
      }
    }
  }

  onkeyup(e) {
    const { code } = e
    // Allow non-capturing events to access keyboard.codes before cleanup
    queueMicrotask(() => {
      if (!e.ctrlKey) delete this.keys.control
      if (!e.shiftKey) delete this.keys.shift
      if (!e.metaKey) delete this.keys.meta
      if (!e.altKey && !("altgraph" in this.keys)) delete this.keys.alt

      delete this.codes[code]
      if (this.strokes[code]) {
        this.strokes[code].keys.forEach((key) => delete this.keys[key])
        this.strokes[code].counter--
        if (this.strokes[code].counter === 0) this.strokes[code].keys.length = 0
      }
    })
  }

  // The keyup event is not called if a keydown shortcut
  // set the focus outside the document.
  // We must clean all pressed keys on blur.
  onblur() {
    const desc = Object.getOwnPropertyDescriptors(this.keys)
    for (const key in desc) if (desc[key].value) delete this.keys[key]
    for (const key in this.codes) delete this.codes[key]
    for (const key in this.strokes) delete this.strokes[key]
  }

  // The keydown events are not called on drag
  ondragover(e) {
    if (e.ctrlKey) this.keys.control = true
    else delete this.keys.control
    if (e.shiftKey) this.keys.shift = true
    else delete this.keys.shift
    if (e.metaKey) this.keys.meta = true
    else delete this.keys.meta
    if (e.altKey) this.keys.alt = true
    else delete this.keys.alt
  }

  forget() {
    this.listeners--
    if (this.listeners <= 0) {
      globalThis.removeEventListener("keydown", this, true)
      globalThis.removeEventListener("keyup", this, true)
      globalThis.removeEventListener("dragover", this)
      globalThis.removeEventListener("blur", this)
      this.isListening = false
      this.listeners = 0
      for (const signal of this.#signals) {
        signal.removeEventListener("abort", this)
        this.#signals.clear()
      }
    }
  }

  listen(signal) {
    this.listeners++
    this.addSignal(signal)
    if (!this.isListening) {
      globalThis.addEventListener("keydown", this, true /* [1] */)
      globalThis.addEventListener("keyup", this, true /* [1] */)
      globalThis.addEventListener("dragover", this)
      globalThis.addEventListener("blur", this)
      this.isListening = true
    }
    return this.forget.bind(this)
  }

  handleEvent(e) {
    this[`on${e.type}`](e)
  }

  [Symbol.toPrimitive]() {
    return JSON.stringify(this, null, 2)
  }

  toString() {
    return this[Symbol.toPrimitive]()
  }

  toJSON() {
    return { keys: this.keys, codes: this.codes }
  }
}

export const keyboard = new Keyboard()
