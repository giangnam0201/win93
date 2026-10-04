import { Component } from "../../api/gui/Component.js"

const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const keyboard = {
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  Comma: 12,
  KeyL: 13,
  Period: 14,
  Semicolon: 15,
  Slash: 16,
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
  Digit9: 25,
  KeyO: 26,
  Digit0: 27,
  KeyP: 28,
  BracketLeft: 29,
}

/**
 * Convert a MIDI number or scientific pitch name (C4 = 60) to MIDI.
 * @param {number | string} value
 */
export function pianoNote(value) {
  if (typeof value === "number" || /^\d+$/.test(value)) return Number(value)
  const match = /^([a-g])([#b]?)(-?\d+)$/i.exec(value)
  if (!match) return Number.NaN
  return (
    (Number(match[3]) + 1) * 12 +
    names.indexOf(match[1].toUpperCase()) +
    (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0)
  )
}

/**
 * A polyphonic piano with MIDI events, colored marks and latched notes.
 * `from` and `to` are inclusive MIDI numbers or scientific pitch names.
 * `viewFrom` and `viewTo` set the initially visible range when scrolling.
 * `keyboardOctave` sets the computer keyboard's lower C (default C3).
 * `holdKey` defaults to Space; set it to false to disable keyboard holds.
 * Emits `noteon` / `noteoff` with { note, name, velocity, channel },
 * and `midimessage` with { data }. Connect MIDI input through `midi(data)`.
 */
export class PianoComponent extends Component {
  static plan = {
    tag: "ui-piano",
    tabIndex: 0,
    props: {
      from: true,
      to: true,
      viewFrom: { attribute: "viewfrom" },
      viewTo: { attribute: "viewto" },
      readonly: true,
      keyboardOctave: { attribute: "keyboardoctave" },
      holdKey: { attribute: "holdkey" },
      droneless: true,
    },
  }

  #keys = new Map()
  #keyBounds = new Map()
  #marks = new Map()
  #active = new Map()
  #held = new Set()
  #inputs = new Map()
  #pointers = new Map()
  #holdKeyActive = false
  channel = 0

  get from() {
    return this.getAttribute("from") ?? "24"
  }
  set from(value) {
    this.setAttribute("from", value)
  }
  get to() {
    return this.getAttribute("to") ?? "95"
  }
  set to(value) {
    this.setAttribute("to", value)
  }
  get viewFrom() {
    return this.getAttribute("viewfrom")
  }
  set viewFrom(value) {
    this.setAttribute("viewfrom", value)
  }
  get viewTo() {
    return this.getAttribute("viewto")
  }
  set viewTo(value) {
    this.setAttribute("viewto", value)
  }
  get keyboardOctave() {
    return Number(this.getAttribute("keyboardoctave") ?? 3)
  }
  set keyboardOctave(value) {
    this.setAttribute("keyboardoctave", value)
  }
  get holdKey() {
    const value = this.getAttribute("holdkey")
    if (value === null) return "Space"
    return value.toLowerCase() === "false" ? false : value
  }
  set holdKey(value) {
    this.setAttribute("holdkey", value)
  }
  get droneless() {
    return this.hasAttribute("droneless")
  }
  set droneless(value) {
    this.toggleAttribute("droneless", Boolean(value))
  }
  get readonly() {
    return this.hasAttribute("readonly")
  }
  set readonly(value) {
    this.toggleAttribute("readonly", Boolean(value))
  }

  get activeNotes() {
    return [...this.#active.keys()]
  }

  /**
   * Replace display marks without changing the sounding notes.
   * @param {Iterable<number | string | { note: number | string, color?: string }>} notes
   * @param {string} [color]
   */
  mark(notes = [], color = "var(--piano-active-color, var(--accent-color))") {
    this.#marks.clear()
    for (const item of notes) {
      const note = typeof item === "object" ? item.note : item
      const markColor = typeof item === "object" ? (item.color ?? color) : color
      this.#marks.set(pianoNote(note), markColor)
    }
    for (const note of this.#keys.keys()) this.#paint(note)
  }

  /** Update display state without emitting MIDI or applying hold behavior. */
  setActive(note, active) {
    note = pianoNote(note)
    if (active) this.#active.set(note, this.#active.get(note) ?? this.channel)
    else {
      this.#active.delete(note)
      this.#held.delete(note)
    }
    this.#paint(note)
  }

  /** Start a note; source identifies the physical key, pointer or MIDI input. */
  noteOn(
    note,
    {
      velocity = 100,
      channel = this.channel,
      source = `note:${note}`,
      hold = this.#holdKeyActive,
    } = {},
  ) {
    note = pianoNote(note)
    if (
      !Number.isInteger(note) ||
      note < 0 ||
      note > 127 ||
      this.#inputs.has(source)
    ) {
      return
    }
    this.#inputs.set(source, note)
    if (hold && this.#held.has(note)) {
      this.#held.delete(note)
      this.#stop(note)
      return
    }
    if (hold) this.#held.add(note)
    else this.#held.delete(note)
    if (this.#active.has(note)) return
    this.#active.set(note, channel)
    this.#paint(note)
    this.#emit(note, velocity, channel, true)
  }

  /** Release an input while retaining notes latched by hold key or pointer exit. */
  noteOff(note, { source = `note:${note}` } = {}) {
    note = pianoNote(note)
    this.#inputs.delete(source)
    if (this.#held.has(note) || [...this.#inputs.values()].includes(note)) {
      return
    }
    this.#stop(note)
  }

  /** Route MIDI through the hold logic; other messages pass through unchanged. */
  midi(data) {
    const status = data[0] & 0xf0
    const channel = data[0] & 0x0f
    const source = `midi:${channel}:${data[1]}`
    if (status === 0x90 && data[2] > 0) {
      this.noteOn(data[1], { velocity: data[2], channel, source })
    } else if (status === 0x80 || status === 0x90) {
      this.noteOff(data[1], { source })
    } else {
      if (status === 0xb0 && [120, 123].includes(data[1])) this.releaseAll()
      this.dispatchEvent(new CustomEvent("midimessage", { detail: { data } }))
    }
  }

  /** Stop every note, including drones, before changing or closing a voice. */
  releaseAll() {
    this.#inputs.clear()
    this.#held.clear()
    this.#pointers.clear()
    for (const note of this.#active.keys()) this.#stop(note)
  }

  /** Stop every note retained by hold-key or drag-out behavior. */
  releaseHeld() {
    const held = [...this.#held]
    this.#held.clear()
    for (const note of held) {
      if (![...this.#inputs.values()].includes(note)) this.#stop(note)
    }
  }

  #stop(note) {
    if (!this.#active.has(note)) return
    const channel = this.#active.get(note)
    this.#active.delete(note)
    this.#paint(note)
    this.#emit(note, 0, channel, false)
  }

  #emit(note, velocity, channel, on) {
    const name = names[note % 12] + (Math.floor(note / 12) - 1)
    this.dispatchEvent(
      new CustomEvent(on ? "noteon" : "noteoff", {
        detail: { note, name, velocity, channel },
      }),
    )
    this.dispatchEvent(
      new CustomEvent("midimessage", {
        detail: { data: [(on ? 0x90 : 0x80) | channel, note, velocity] },
      }),
    )
  }

  #paint(note) {
    const keyEl = this.#keys.get(note)
    if (!keyEl) return
    keyEl.classList.toggle("active", this.#active.has(note))
    keyEl.setAttribute("aria-pressed", String(this.#active.has(note)))
    const color = this.#marks.get(note)
    keyEl.classList.toggle("marked", color !== undefined)
    if (color) keyEl.style.setProperty("--piano-mark-color", color)
    else keyEl.style.removeProperty("--piano-mark-color")
  }

  #canPlay(event) {
    if (this.readonly || !this.isConnected || event.defaultPrevented) {
      return false
    }
    const dialogEl = this.closest("ui-dialog")
    if (dialogEl && !dialogEl.hasAttribute("active")) return false
    return !event.target.closest?.(
      "input, textarea, select, ui-menu, ui-listbox, [contenteditable]:not([contenteditable=false])",
    )
  }

  #releaseKeyboard() {
    for (const [source, note] of this.#inputs) {
      if (source.startsWith("key:")) this.noteOff(note, { source })
    }
    this.#holdKeyActive = false
  }

  #isHoldKey(event) {
    if (this.holdKey === false) return false
    return [event.code, event.key].some(
      (value) => value?.toLowerCase() === this.holdKey.toLowerCase(),
    )
  }

  #keyAtPoint(clientX, clientY) {
    const pianoRect = this.getBoundingClientRect()
    if (
      clientX < pianoRect.left ||
      clientX >= pianoRect.right ||
      clientY < pianoRect.top ||
      clientY >= pianoRect.bottom
    ) {
      return
    }

    let whiteKeyEl
    for (const keyEl of this.#keys.values()) {
      const rect = keyEl.getBoundingClientRect()
      if (
        clientX >= rect.left &&
        clientX < rect.right &&
        clientY >= rect.top &&
        clientY < rect.bottom
      ) {
        if (keyEl.classList.contains("ui-piano__key--black")) return keyEl
        whiteKeyEl = keyEl
      }
    }
    return whiteKeyEl
  }

  created() {
    const { signal } = this
    window.addEventListener(
      "keydown",
      (event) => {
        if (!this.#canPlay(event)) return
        if (this.#isHoldKey(event)) {
          event.preventDefault()
          this.#holdKeyActive = true
          if (!event.repeat) {
            for (const note of this.#active.keys()) this.#held.add(note)
          }
          return
        }
        if (event.key === "Backspace") {
          event.preventDefault()
          this.releaseHeld()
          return
        }
        const offset = keyboard[event.code]
        if (
          offset === undefined ||
          event.repeat ||
          event.altKey ||
          event.metaKey
        ) {
          return
        }
        event.preventDefault()
        this.noteOn((this.keyboardOctave + 1) * 12 + offset, {
          source: `key:${event.code}`,
        })
      },
      { signal },
    )
    window.addEventListener(
      "keyup",
      (event) => {
        if (this.#isHoldKey(event)) {
          this.#holdKeyActive = false
          return
        }
        const source = `key:${event.code}`
        if (this.#inputs.has(source)) {
          this.noteOff(this.#inputs.get(source), { source })
        }
      },
      { signal },
    )
    window.addEventListener("blur", () => this.#releaseKeyboard(), { signal })
    window.addEventListener("pagehide", () => this.releaseAll(), { signal })
    document.addEventListener(
      "ui:dialog.activate",
      (event) => {
        if (!event.target.contains(this)) this.#releaseKeyboard()
      },
      { signal },
    )
    this.addEventListener(
      "pointerdown",
      (event) => {
        const keyEl = event.target.closest(".ui-piano__key")
        if (this.readonly || event.button !== 0 || !keyEl) return
        event.preventDefault()
        this.focus({ preventScroll: true })
        const note = Number(keyEl.dataset.note)
        this.#pointers.set(event.pointerId, {
          note,
          wasActive: this.#active.has(note),
        })
        this.noteOn(note, {
          source: `pointer:${event.pointerId}`,
        })
      },
      { signal },
    )
    window.addEventListener(
      "pointermove",
      (event) => {
        if (!this.#pointers.has(event.pointerId)) return
        const source = `pointer:${event.pointerId}`
        const { note: previous, wasActive } = this.#pointers.get(
          event.pointerId,
        )
        const keyEl = this.#keyAtPoint(event.clientX, event.clientY)
        if (!keyEl) {
          if (wasActive) {
            this.#held.delete(previous)
            this.#stop(previous)
          } else if (!this.droneless && this.#active.has(previous)) {
            this.#held.add(previous)
          }
          this.noteOff(previous, { source })
          this.#pointers.delete(event.pointerId)
          return
        }
        const note = Number(keyEl.dataset.note)
        if (note === previous) return
        this.noteOff(previous, { source })
        this.#pointers.set(event.pointerId, {
          note,
          wasActive: this.#active.has(note),
        })
        this.noteOn(note, { source })
      },
      { capture: true, signal },
    )
    const release = (event) => {
      if (!this.#pointers.has(event.pointerId)) return
      const { note } = this.#pointers.get(event.pointerId)
      this.#pointers.delete(event.pointerId)
      this.noteOff(note, { source: `pointer:${event.pointerId}` })
    }
    window.addEventListener("pointerup", release, { capture: true, signal })
    window.addEventListener("pointercancel", release, {
      capture: true,
      signal,
    })
  }

  updated(key) {
    if (!this.isRendered) return
    if (["from", "to", "viewfrom", "viewto"].includes(key)) this.rerender()
    if (key === "readonly" && this.readonly) this.releaseAll()
  }

  rendered() {
    if (this.viewFrom === null || this.viewTo === null) {
      this.style.removeProperty("--piano-view-key-count")
      return
    }

    const from = Math.max(pianoNote(this.from), pianoNote(this.viewFrom))
    const to = Math.min(pianoNote(this.to), pianoNote(this.viewTo))
    const start = this.#keyBounds.get(from)?.start
    const end = this.#keyBounds.get(to)?.end
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      this.style.removeProperty("--piano-view-key-count")
      return
    }
    this.style.setProperty("--piano-view-key-count", end - start)
    this.scrollLeft = this.#keys.get(from)?.offsetLeft ?? 0
  }

  render() {
    this.#keys.clear()
    this.#keyBounds.clear()
    const from = Math.max(0, pianoNote(this.from))
    const to = Math.min(127, pianoNote(this.to))
    let position = 0
    const content = []
    for (let note = from; note <= to; note++) {
      const black = names[note % 12].includes("#")
      if (note === from && black) position = 0.25
      const name = names[note % 12] + (Math.floor(note / 12) - 1)
      this.#keyBounds.set(note, {
        start: position - (black ? 0.25 : 0),
        end: position + (black ? 0.25 : 1),
      })
      content.push({
        tag: `span.ui-piano__key${black ? ".ui-piano__key--black" : ""}`,
        role: "button",
        title: name,
        aria: { label: name, pressed: this.#active.has(note) },
        dataset: { note },
        style: { "--piano-position": position },
        created: (el) => {
          this.#keys.set(note, el)
          this.#paint(note)
        },
      })
      if (!black) position++
      else if (note === from || note === to) position += 0.25
    }
    return {
      tag: "div.ui-piano__keys",
      style: { "--piano-key-count": position },
      content,
    }
  }

  disconnected() {
    this.releaseAll()
  }
  destroyed() {
    this.releaseAll()
  }
}

export const piano = Component.define(PianoComponent)
