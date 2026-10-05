/* eslint-disable prefer-destructuring */
import { Trait } from "../Trait.js"
import { keyboard } from "../../env/device/keyboard.js"
import { configure } from "../../configure.js"
import { noop } from "../../../lib/type/function/noop.js"

const DEFAULTS = {
  signal: undefined,
  key: "shift",
  audioContext: undefined,
  onRecord: noop,
  onPlayback: noop,
  onStop: noop,
}

const SHARED_CLOCKS = new WeakMap()

class AudioClockWrapper {
  constructor(base) {
    this.base = base
    this.events = new Set()
  }

  now() {
    return this.base.context?.currentTime
  }

  setTimeout(fn, delay, guaranteed = false) {
    let immediate = true
    const callback = (ev) => {
      if (immediate) immediate = false
      else this.events.delete(ev)
      fn(ev)
    }
    const event = this.base.setTimeout(callback, delay)
    if (guaranteed && event && "func" in event) event.onexpired = event.func
    if (immediate) {
      immediate = false
      this.events.add(event)
    }
    return event
  }

  callbackAtTime(fn, time, guaranteed = false) {
    let immediate = true
    const callback = (ev) => {
      if (immediate) immediate = false
      else this.events.delete(ev)
      fn(ev)
    }
    const event = this.base.callbackAtTime(callback, time)
    if (guaranteed && event && "func" in event) event.onexpired = event.func
    if (immediate) {
      immediate = false
      this.events.add(event)
    }
    return event
  }

  start() {
    this.base.start?.()
  }

  stop() {
    for (const e of this.events) e.clear()
    this.events.clear()
  }
}

class TimerWrapper {
  constructor(Timer, signal) {
    this.events = []
    this.timer = new Timer((time) => this.tick(time), 16, { signal })

    this.now = globalThis.document?.timeline?.currentTime
      ? () => /** @type {number} */ (document.timeline.currentTime) / 1000
      : () => performance.now() / 1000
  }

  tick(time) {
    const now = (time ?? performance.now()) / 1000
    while (this.events.length > 0 && this.events[0].time <= now) {
      this.events.shift().func()
    }
  }

  setTimeout(fn, delay) {
    return this.callbackAtTime(fn, this.now() + delay)
  }

  callbackAtTime(fn, time) {
    const event = {
      func: fn,
      time,
      clear: () => {
        const i = this.events.indexOf(event)
        if (i > -1) this.events.splice(i, 1)
      },
    }
    let i = 0
    while (i < this.events.length && this.events[i].time < time) i++
    this.events.splice(i, 0, event)
    return event
  }

  start() {
    this.timer.start()
  }

  stop() {
    this.timer.stop()
    this.events.length = 0
  }
}

export class Recordable extends Trait {
  static name = "Recordable"

  recording = false
  playing = false
  points = []
  startTime = 0
  playbackStartTime = 0
  playbackIndex = 0
  duration = 0

  constructor(el, options) {
    super(el, options)
    this.config = configure(DEFAULTS, options)
    const { signal } = this
    this.key = this.config.key

    this.el.addEventListener("input", () => this.handleInput(), { signal })
    keyboard.listen(signal)
    globalThis.addEventListener("keyup", (e) => this.handleKeyup(e), {
      signal,
      capture: true,
    })

    globalThis.addEventListener(
      "blur",
      () => {
        if (this.recording) {
          this.stopRecording()
          this.startPlayback()
        }
      },
      { signal },
    )

    signal?.addEventListener("abort", () => {
      this.stopPlayback()
      this.stopRecording()
    })

    this.initClock()
  }

  async initClock() {
    const ctx = this.config.audioContext
    if (ctx) {
      if (!SHARED_CLOCKS.has(ctx)) {
        const entry = {
          users: 0,
          promise: (async () => {
            const { AudioClock } = await import(
              "../../../lib/audio/AudioClock.js"
            )
            const clock = new AudioClock(ctx, { toleranceLate: 0.1 })
            await clock.init()
            clock.start()
            return clock
          })(),
        }
        SHARED_CLOCKS.set(ctx, entry)
      }
      const entry = SHARED_CLOCKS.get(ctx)
      entry.users++
      this.signal?.addEventListener("abort", async () => {
        if (--entry.users === 0) {
          try {
            const shared = await entry.promise
            if (entry.users === 0) {
              shared.destroy()
              if (SHARED_CLOCKS.get(ctx) === entry) SHARED_CLOCKS.delete(ctx)
            }
          } catch {}
        }
      })
      try {
        const shared = await entry.promise
        if (!this.signal?.aborted) this.clock = new AudioClockWrapper(shared)
      } catch {}
    } else {
      const { Timer } = await import("../../../lib/timing/Timer.js")
      this.clock = new TimerWrapper(Timer, this.signal)
    }
  }

  now() {
    return (
      this.clock?.now() ??
      this.config.audioContext?.currentTime ??
      performance.now() / 1000
    )
  }

  handleInput() {
    if (this._internalEvent) return
    if (this.config.audioContext?.state === "suspended") {
      this.config.audioContext.resume()
    }

    if (keyboard.keys[this.key]) {
      if (!this.recording) this.startRecording()
      this.recordPoint()
    } else if (this.playing) {
      this.stopPlayback()
    }
  }

  handleKeyup({ key }) {
    if (this.recording && key.toLowerCase() === this.key) {
      this.stopRecording()
      this.startPlayback()
    }
  }

  startRecording() {
    if (this.playing) this.stopPlayback()
    this.clock?.start()
    this.recording = true
    this.points = []
    this.startTime = this.now()
    this.recordPoint()
    this.config.onRecord?.()
  }

  recordPoint() {
    const time = this.now() - this.startTime
    const el = /** @type {HTMLInputElement} */ (this.el)
    const value = el.valueAsNumber ?? el.value
    if (
      this.points.length > 0 &&
      this.points[this.points.length - 1].value === value
    ) {
      return
    }
    this.points.push({ time, value })
  }

  stopRecording() {
    if (this.recording) {
      this.recording = false
      this.duration = this.now() - this.startTime
    }
  }

  startPlayback() {
    if (this.points.length === 0 || !this.clock) return
    this.playing = true
    this.playbackIndex = 0
    this.playbackStartTime = this.clock.now()
    this.clock.start()
    this.schedulePoints()
    this.config.onPlayback?.()
  }

  schedulePoints() {
    if (!this.playing) return
    const lookahead = 0.1
    const now = this.clock.now()
    const horizon = now - this.playbackStartTime + lookahead

    let lastValue = null

    while (this.playbackIndex < this.points.length) {
      const point = this.points[this.playbackIndex]
      if (point.time > horizon) break

      const time = this.playbackStartTime + point.time
      if (time <= now) {
        lastValue = point.value
      } else {
        this.clock.callbackAtTime(() => {
          if (!this.playing) return
          this.updateElement(point.value)
        }, time)
      }

      this.playbackIndex++
    }

    if (lastValue !== null) this.updateElement(lastValue)

    if (this.playbackIndex < this.points.length) {
      this.clock.setTimeout(() => this.schedulePoints(), lookahead / 2, true)
    } else {
      const duration = this.duration || this.points[this.points.length - 1].time
      this.clock.callbackAtTime(
        () => this.playing && this.startPlayback(),
        this.playbackStartTime + duration + 0.01,
        true,
      )
    }
  }

  updateElement(value) {
    this._internalEvent = true
    try {
      const el = /** @type {HTMLInputElement} */ (this.el)
      if (el.valueAsNumber === undefined) el.value = value
      else el.valueAsNumber = value
      el.dispatchEvent(new Event("input", { bubbles: true }))
    } finally {
      this._internalEvent = false
    }
  }

  stopPlayback() {
    this.playing = false
    this.clock?.stop()
    this.config.onStop?.()
  }
}

export function recordable(el, options) {
  return new Recordable(el, options)
}
