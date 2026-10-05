import { Component } from "../../api/gui/Component.js"
import { menu } from "../layout/menu.js"

const CHANNEL_COUNT = 16
const ACTIVE_DURATION = 100

/** MIDI input/output and channel selector. */
export class MidiComponent extends Component {
  static plan = {
    tag: "ui-midi",
    props: {
      indicator: true,
      keep: true,
      label: true,
      mode: true,
      picto: true,
      small: true,
    },
  }

  access = null
  port = null
  channel = 0
  #app = null
  #accessPromise = null
  #restorePromise = null
  #menuEl = null
  #menuView = null
  #portIndicators = new Map()
  #channelIndicators = new Array(CHANNEL_COUNT)
  #activityTimers = new WeakMap()
  #inputHandlers = new Map()
  #savedPortId = null
  #savedPortName = null

  get app() {
    return this.#app
  }
  set app(value) {
    this.#app = value
    this.#prepareSavedSelection()
  }

  get indicator() {
    return this.hasAttribute("indicator")
  }
  set indicator(value) {
    this.toggleAttribute("indicator", Boolean(value))
  }

  get keep() {
    return this.getAttribute("keep") ?? ""
  }
  set keep(value) {
    if (value) this.setAttribute("keep", value)
    else this.removeAttribute("keep")
  }

  get mode() {
    return this.getAttribute("mode") ?? "input"
  }
  set mode(value) {
    this.setAttribute("mode", value)
  }

  get label() {
    return this.getAttribute("label") ?? "MIDI"
  }
  set label(value) {
    this.setAttribute("label", value)
  }

  get picto() {
    return this.getAttribute("picto") ?? "piano"
  }
  set picto(value) {
    this.setAttribute("picto", value === false ? "false" : value)
  }

  get small() {
    return this.hasAttribute("small")
  }
  set small(value) {
    this.toggleAttribute("small", Boolean(value))
  }

  get active() {
    return this.indicatorEl?.classList.contains("active") ?? false
  }
  set active(value) {
    this.indicatorEl?.classList.toggle("active", Boolean(value))
  }

  render() {
    return {
      tag: "button",
      type: "button",
      content: [
        this.picto !== "false" && { tag: "ui-picto", value: this.picto },
        { tag: "span.ui-midi__label", content: this.label },
        { if: this.indicator, tag: "span.ui-midi__indicator" },
      ],
      on: { click: () => this.open() },
    }
  }

  created() {
    this.buttonEl = this.querySelector("button")
    this.labelEl = this.querySelector(".ui-midi__label")
    this.indicatorEl = this.querySelector(".ui-midi__indicator")
    this.#updateLabel()
    if (this.app) this.#prepareSavedSelection()
  }

  async open() {
    if (!navigator.requestMIDIAccess) return
    await this.#restoreState()
    if (!(await this.#enable())) return
    await this.#showPorts()
  }

  async #prepareSavedSelection() {
    await this.#restoreState()
    if (!this.#savedPortId && !this.#savedPortName) return
    if (!navigator.requestMIDIAccess) return
    if (await this.#permissionGranted()) {
      this.#enable()
      return
    }
  }

  async #restoreState() {
    if (this.#restorePromise) return this.#restorePromise
    if (!this.app || !this.keep) return
    this.#restorePromise = (async () => {
      if (!this.app.state) await this.app.initState({})
      const saved = this.app.state[this.keep]
      if (!saved) return
      this.channel = Number(saved.channel) || 0
      this.#savedPortId = saved.portId
      this.#savedPortName = saved.portName
      this.#updateLabel()
    })()
    return this.#restorePromise
  }

  async #permissionGranted() {
    if (!navigator.permissions?.query) return false
    try {
      const status = await navigator.permissions.query({
        name: "midi",
        sysex: false,
      })
      return status.state === "granted"
    } catch {
      return false
    }
  }

  async #enable() {
    if (this.access) return this.access
    if (this.#accessPromise) return this.#accessPromise
    this.#accessPromise = navigator.requestMIDIAccess().then(
      (access) => {
        this.access = access
        access.addEventListener("statechange", () => this.#portsChanged(), {
          signal: this.signal,
        })
        this.#syncInputListeners()
        this.#restorePort()
        return access
      },
      () => {
        this.#accessPromise = null
        return null
      },
    )
    return this.#accessPromise
  }

  #restorePort() {
    const port = this.#ports().find(
      (item) =>
        item.id === this.#savedPortId ||
        (this.#savedPortName && item.name === this.#savedPortName),
    )
    if (port) this.#selectPort(port, true, false)
  }

  #ports() {
    return [
      ...this.access[this.mode === "output" ? "outputs" : "inputs"].values(),
    ]
  }

  #portsChanged() {
    this.#syncInputListeners()
    const current = this.#ports().find(
      ({ id, name }) =>
        id === (this.port?.id ?? this.#savedPortId) ||
        (this.#savedPortName && name === this.#savedPortName),
    )
    if (!current) {
      if (this.port) this.#selectPort(null, true, false)
    } else if (current !== this.port) this.#selectPort(current, true, false)
    if (this.#menuEl && this.#menuView === "ports") {
      this.#portIndicators.clear()
      this.#menuEl.content = this.#portItems()
    }
  }

  #syncInputListeners() {
    if (this.mode !== "input") return
    const inputs = new Map(this.#ports().map((port) => [port.id, port]))
    for (const [id, { port, handler }] of this.#inputHandlers) {
      if (inputs.get(id) === port) continue
      port.removeEventListener("midimessage", handler)
      this.#inputHandlers.delete(id)
    }
    for (const port of inputs.values()) {
      if (this.#inputHandlers.has(port.id)) continue
      const handler = (event) => this.#handleMessage(port, event)
      port.addEventListener("midimessage", handler)
      this.#inputHandlers.set(port.id, { port, handler })
    }
  }

  async #openMenu(view, items) {
    const menuEl = await menu(items, {
      opener: this.buttonEl,
      preset: "popup",
    })
    if (!menuEl) return
    menuEl.classList.add("ui-midi__menu")
    this.#menuEl = menuEl
    this.#menuView = view
    menuEl.signal.addEventListener("abort", () => {
      if (this.#menuEl !== menuEl) return
      this.#menuEl = null
      this.#menuView = null
    })
    return menuEl
  }

  #portItems() {
    const ports = this.#ports()
    return [
      {
        tag: "radio",
        name: "midi-port",
        checked: !this.port,
        label: "No device",
        action: () => {
          this.#selectPort(null, true)
          setTimeout(() => this.#showChannels())
        },
      },
      { tag: "hr" },
      ...(ports.length > 0
        ? ports.map((port) => ({
            tag: "radio",
            name: "midi-port",
            checked: port.id === this.port?.id,
            label: [
              {
                tag: "span.ui-midi__menu-label",
                content: port.name || port.id,
              },
              {
                tag: "span.ui-midi__indicator",
                created: (el) => this.#portIndicators.set(port.id, el),
              },
            ],
            action: () => {
              this.#selectPort(port, false)
              setTimeout(() => this.#showChannels())
            },
          }))
        : [{ label: "No MIDI devices", disabled: true }]),
    ]
  }

  async #showPorts() {
    this.#portIndicators.clear()
    await this.#openMenu("ports", this.#portItems())
  }

  async #showChannels() {
    const items = Array.from({ length: CHANNEL_COUNT }, (_, channel) => ({
      tag: "radio",
      name: "midi-channel",
      checked: channel === this.channel,
      label: [
        { tag: "span.ui-midi__menu-label", content: `Ch. ${channel + 1}` },
        {
          tag: "span.ui-midi__indicator",
          created: (el) => (this.#channelIndicators[channel] = el),
        },
      ],
      action: () => {
        this.channel = channel
        this.#save()
        this.#updateLabel()
        this.dispatchEvent(new Event("change", { bubbles: true }))
      },
    }))
    await this.#openMenu("channels", items)
  }

  #selectPort(port, notify = true, save = true) {
    this.port = port
    if (save) {
      this.#savedPortId = port?.id ?? null
      this.#savedPortName = port?.name ?? null
      this.#save()
    }
    this.#updateLabel()
    if (notify) this.dispatchEvent(new Event("change", { bubbles: true }))
  }

  #handleMessage(port, event) {
    const channel = event.data[0] & 0x0f
    this.#flash(this.#portIndicators.get(port.id))
    if (port !== this.port) return
    this.#flash(this.#channelIndicators[channel])
    if (channel !== this.channel) return
    this.#flash(this.indicatorEl)
    this.dispatchEvent(new CustomEvent("midimessage", { detail: event }))
  }

  send(data, timestamp) {
    if (!this.port || this.mode !== "output") return
    const message = [...data]
    message[0] = (message[0] & 0xf0) | this.channel
    this.port.send(message, timestamp)
    this.#flash(this.indicatorEl)
  }

  #flash(el) {
    if (!el) return
    el.classList.add("active")
    clearTimeout(this.#activityTimers.get(el))
    this.#activityTimers.set(
      el,
      setTimeout(() => el.classList.remove("active"), ACTIVE_DURATION),
    )
  }

  #save() {
    if (!this.app?.state || !this.keep) return
    this.app.state[this.keep] = {
      portId: this.#savedPortId,
      portName: this.#savedPortName,
      channel: this.channel,
    }
  }

  #updateLabel() {
    if (!this.labelEl || !this.indicatorEl) return
    const portName = this.port?.name || this.port?.id || this.#savedPortName
    this.labelEl.textContent = portName
      ? `${portName} - Ch. ${this.channel + 1}`
      : this.label
    this.indicatorEl.hidden = !this.indicator || !this.port
  }

  destroyed() {
    this.#menuEl?.close()
    for (const { port, handler } of this.#inputHandlers.values()) {
      port.removeEventListener("midimessage", handler)
    }
    this.#inputHandlers.clear()
  }
}

Component.define(MidiComponent)
