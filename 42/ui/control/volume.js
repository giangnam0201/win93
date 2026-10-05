import { NumericControl } from "../../api/gui/Control.js"
import { bindAudioParam } from "../../lib/audio/bindAudioParam.js"
import { LevelNode } from "../../lib/audio/visualizer/LevelNode.js"
import { paintThread } from "../../lib/graphic/paintThread.js"
import { setFractionProp } from "../../lib/type/element/setControlData.js"
import { scale } from "../../lib/type/number/math.js"
import { defer } from "../../lib/type/promise/defer.js"

const WORKER_URL = new URL("./volume/level.w.js", import.meta.url)

export class VolumeControl extends NumericControl {
  static plan = {
    tag: "ui-volume",
    options: {
      valueType: "number",
      dispatchChange: false,
    },
  }

  scale = "dB"

  #init = { min: -70, max: 6 }

  get step() {
    return this.rangeEl.step
  }
  set step(value) {
    this.rangeEl.step = value
    this.#setFractionProp()
  }

  get min() {
    return this.rangeEl.min
  }
  set min(value) {
    this.rangeEl.min = value
    this.#setFractionProp()
    this.#setZeroProp()
  }

  get max() {
    return this.rangeEl.max
  }
  set max(value) {
    this.rangeEl.max = value
    this.#setFractionProp()
    this.#setZeroProp()
  }

  get value() {
    return this.rangeEl.value
  }
  set value(value) {
    this.rangeEl.value = value
    this.#setFractionProp()
  }

  get valueAsNumber() {
    return this.rangeEl.valueAsNumber
  }
  set valueAsNumber(value) {
    this.rangeEl.valueAsNumber = value
    this.#setFractionProp()
  }

  get small() {
    return this.hasAttribute("small")
  }
  set small(value) {
    this.toggleAttribute("small", Boolean(value))
  }

  #setFractionProp(options) {
    if (options?.ignoreRange !== true) setFractionProp(this.rangeEl)
    this.style.setProperty(
      "--fraction",
      this.rangeEl.style.getPropertyValue("--fraction"),
    )
  }

  #setZeroProp() {
    if (this.min) this.#init.min = Number(this.min)
    if (this.max) this.#init.max = Number(this.max)
    const { height, min, max } = this.#init
    this.style.setProperty(
      "--zero-pos",
      `${height - Math.round(scale(0, min, max, 0, height))}px`,
    )
  }

  #audioParam
  get audioParam() {
    return this.#audioParam
  }
  set audioParam(audioParam) {
    this.#audioParam = audioParam
    if (audioParam) {
      this.toggleAttribute("readonly", false)
      bindAudioParam(this, audioParam, { signal: this.signal })
    } else {
      this.toggleAttribute("readonly", true)
    }
  }

  #audioInput
  get audioInput() {
    return this.#audioInput
  }
  set audioInput(audioNode) {
    this.#audioInput = audioNode
    if (this.audioPipe) {
      if (this.audioPipe.context === audioNode.context) {
        audioNode.connect(this.audioPipe)
        this.setChannelCss(audioNode.channelCount)
        return
      }

      this.audioPipe.destroy()
    }

    const { signal } = this
    LevelNode.init(this.#audioInput.context, { signal }).then((levelNode) => {
      this.audioPipe = levelNode
      audioNode.connect(levelNode)
      this.setChannelCss(audioNode.channelCount)
      this.#send({ levelNode: levelNode.port }, [levelNode.port])
    })
  }

  setChannelCss(channelCount) {
    this.style.setProperty("--channels", `${100 / channelCount}%`)
  }

  async #send(message, transfer) {
    await this.threadReady
    this.thread.carry(message, transfer)
  }

  constructed() {
    this.rangeEl = document.createElement("input")
    this.rangeEl.tabIndex = -1
    this.rangeEl.type = "range"
    this.rangeEl.ariaOrientation = "vertical"
    this.threadReady = defer()
  }

  async render() {
    await document.fonts.ready // ?

    const { signal } = this

    if (this.min) this.#init.min = Number(this.min)
    if (this.max) this.#init.max = Number(this.max)
    if (this.small) this.#init.hold = false

    const { canvas, thread } = paintThread(WORKER_URL, {
      signal,
      init: this.#init,
      resize: (width, height) => {
        this.#init.height = height
        this.#setZeroProp()
      },
    })

    this.canvas = canvas
    thread.then((thread) => {
      this.thread = thread
      this.threadReady.resolve()
    })

    return [
      {
        tag: ".ui-volume__indicator-container > .ui-volume__indicator.ui-volume__indicator--left",
      },
      {
        tag: ".ui-volume__box",
        content: [
          {
            tag: ".ui-volume__meter",
            content: [
              {
                tag: ".ui-volume__accent",
                content: this.canvas,
              },
              { tag: ".ui-volume__zero-db" },
            ],
          },
        ],
      },
      {
        tag: ".ui-volume__indicator-container > .ui-volume__indicator.ui-volume__indicator--right",
      },
      this.rangeEl,
    ]
  }

  created() {
    const { signal } = this

    this.recordable = true

    if (this.dataset.audioParam !== "true") {
      this.toggleAttribute("readonly", true)
    }

    this.#setFractionProp({ ignoreRange: true })

    this.rangeEl.addEventListener(
      "input", //
      () => this.#setFractionProp({ ignoreRange: true }),
      { signal },
    )
  }
}

export const volume = NumericControl.define(VolumeControl)
