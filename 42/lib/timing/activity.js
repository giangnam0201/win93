// https://github.com/dropbox/idle.ts
// https://github.com/WICG/idle-detection

import "../../api/env/polyfill/GamepadChangeEvent.js"
import { Emitter } from "../class/Emitter.js"

const EVENTS = [
  "keypress", //
  "keydown",
  "pointerdown",
  "pointermove",
  "scroll",
  "gamepadconnected",
  "gamepaddisconnected",
]

export class Activity extends Emitter {
  listeners = 0
  isListening = false

  constructor(options) {
    super()
    this.threshold = options?.threshold ?? 10_000
  }

  #state = "active"
  get state() {
    return this.#state
  }
  set state(state) {
    if (this.#state === state) return
    this.#state = state
    this.emit(state)
    this.emit("change", state)
  }

  #signals = new Set()
  addSignal(signal) {
    if (!signal) return
    this.#signals.add(signal)
    signal.addEventListener("abort", this)
  }

  #targets = new Set()
  addTarget(target) {
    if (target?.localName !== "iframe") return
    try {
      const win = target.contentWindow
      if (this.#targets.has(win)) return
      this.#targets.add(win)
      for (const item of EVENTS) win.addEventListener(item, this)
    } catch {}
  }
  removeTarget(target) {
    if (target?.localName !== "iframe") return
    try {
      const win = target.contentWindow
      if (!this.#targets.has(win)) return
      this.#targets.delete(win)
      for (const item of EVENTS) win.removeEventListener(item, this)
    } catch {}
  }

  forget() {
    this.listeners--
    if (this.listeners <= 0) {
      this.clearTimer()
      for (const item of EVENTS) globalThis.removeEventListener(item, this)
      this.isListening = false
      this.listeners = 0
      for (const target of this.#targets) {
        for (const item of EVENTS) target.removeEventListener(item, this)
        this.#targets.clear()
      }
      for (const signal of this.#signals) {
        signal.removeEventListener("abort", this)
        this.#signals.clear()
      }
    }
  }

  listen(options) {
    this.listeners++
    this.addSignal(options?.signal)
    if (!this.isListening) {
      const target = options?.target ?? globalThis
      for (const item of EVENTS) target.addEventListener(item, this)
      this.isListening = true
      this.setTimer()
    }
    return this.forget.bind(this)
  }

  handleEvent(e) {
    if (e.type === "abort") return this.forget()
    if (e.type === "gamepadconnected" || e.type === "gamepaddisconnected") {
      this.handleGamepads()
    }
    this.state = "active"
    this.setTimer()
  }

  #gamepads = new Set()
  handleGamepads() {
    for (const gamepad of this.#gamepads) {
      gamepad.removeEventListener("gamepadchange", this)
    }
    this.#gamepads.clear()
    for (const gamepad of navigator.getGamepads()) {
      if (!gamepad) continue
      this.#gamepads.add(gamepad)
      // @ts-ignore
      gamepad.addEventListener("gamepadchange", this)
    }
  }

  clearTimer() {
    cancelIdleCallback(this.idleId)
    clearTimeout(this.timerId)
  }

  setTimer() {
    this.clearTimer()
    this.idleId = requestIdleCallback(() => {
      this.timerId = setTimeout(() => {
        this.state = "idle"
      }, this.threshold)
    })
  }

  on(...args) {
    this.listen()
    // @ts-ignore
    return super.on(...args)
  }

  off(...args) {
    this.forget()
    // @ts-ignore
    return super.off(...args)
  }
}

export const activity = new Activity()
