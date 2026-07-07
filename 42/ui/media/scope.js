import { Component } from "../../api/gui/Component.js"
import { paintThread } from "../../lib/graphic/paintThread.js"
import { defer } from "../../lib/type/promise/defer.js"

const supportSAB = globalThis.SharedArrayBuffer !== undefined
const WORKER_URL = new URL("./scope/scope.w.js", import.meta.url)

export class ScopeComponent extends Component {
  static plan = {
    tag: "ui-scope",
    props: {
      fill: true,
      mode: true,
    },
  }

  get mode() {
    return this.getAttribute("mode") ?? "auto"
  }
  set mode(value) {
    this.setAttribute("mode", value)
  }

  get fill() {
    return this.hasAttribute("fill")
  }
  set fill(value) {
    this.toggleAttribute("fill", Boolean(value))
  }

  get autoScale() {
    return this.hasAttribute("autoscale")
  }
  set autoScale(value) {
    this.toggleAttribute("autoscale", Boolean(value))
  }

  get audioPipe() {
    if (this.analyserNode) return this.analyserNode
    this.analyserNode = new AnalyserNode(this.audioContext)
    this.analyserReady.resolve()
    return this.analyserNode
  }

  #audioInput
  get audioInput() {
    return this.#audioInput
  }
  set audioInput(audioNode) {
    this.#audioInput = audioNode
    if (this.analyserNode) {
      if (this.analyserNode.context === audioNode.context) {
        audioNode.connect(this.analyserNode)
        return
      }

      this.analyserNode.disconnect()
    }

    this.audioContext = audioNode.context
    audioNode.connect(this.audioPipe)
  }

  updated(key, val) {
    if (key === "mode") return this.#setMode()
    this.thread?.configure({ [key]: val })
  }

  constructed() {
    this.threadReady = defer()
    this.analyserReady = defer()

    this.canvas = document.createElement("canvas")

    const { canvas, thread } = paintThread(WORKER_URL, {
      signal: this.signal,
      throttleExports: ["resize", "carry"],
    })

    thread.then((thread) => {
      this.thread = thread
      this.threadReady.resolve()
    })

    this.canvas = canvas
  }

  #setMode() {
    if (this.mode === "spectroscope") this.#setSpectroscope()
    else this.#setOscilloscope()
  }

  render() {
    this.#setMode()

    return {
      tag: ".ui-scope__box",
      content: {
        tag: ".ui-scope__accent",
        content: this.canvas,
      },
    }
  }

  created() {
    if (this.mode === "auto") {
      this.addEventListener(
        "pointerdown",
        () => {
          this.mode =
            this.mode === "spectroscope" //
              ? "oscilloscope"
              : "spectroscope"
        },
        { signal: this.signal },
      )
    }
  }

  #rafId

  loop() {
    this.draw()
    this.rafId = requestAnimationFrame(() => this.loop())
  }

  play() {
    if (!this.paused) return
    this.paused = false
    this.loop()
  }

  pause() {
    this.paused = true
    cancelAnimationFrame(this.#rafId)
  }

  paused = true
  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }

  // MARK: Oscilloscope
  // ------------------
  async #setOscilloscope() {
    await Promise.all([this.threadReady, this.analyserReady])
    if (this.mode === "spectroscope") return

    this.analyserNode.fftSize = 8192
    this.analyserNode.smoothingTimeConstant = 0.8

    let paintThreadOptions

    if (supportSAB) {
      const len =
        this.analyserNode.frequencyBinCount * Float32Array.BYTES_PER_ELEMENT
      let frame = 0

      const dataSAB = new SharedArrayBuffer(len)
      const data = new Float32Array(dataSAB)
      const dataTemp = new Float32Array(data.length)
      const frameSAB = new SharedArrayBuffer(4)
      const frameI32 = new Int32Array(frameSAB)
      paintThreadOptions = { dataSAB, frameSAB }
      this.draw = () => {
        this.analyserNode.getFloatTimeDomainData(dataTemp)
        data.set(dataTemp)
        frame = (frame + 1) % 100_000
        Atomics.store(frameI32, 0, frame)
        Atomics.notify(frameI32, 0)
      }
    } else {
      const data = new Float32Array(this.analyserNode.frequencyBinCount)
      paintThreadOptions = {
        frequencyBinCount: this.analyserNode.frequencyBinCount,
      }
      this.draw = () => {
        this.analyserNode.getFloatTimeDomainData(data)
        this.thread.carry(data)
      }
    }

    this.thread.configure({
      mode: "oscilloscope",
      fill: this.fill,
      autoScale: this.autoScale,
      ...paintThreadOptions,
    })

    this.play()
  }

  // MARK: Spectroscope
  // ------------------
  async #setSpectroscope() {
    await Promise.all([this.threadReady, this.analyserReady])
    if (this.mode === "oscilloscope") return

    this.analyserNode.fftSize = 16_384
    this.analyserNode.smoothingTimeConstant = 0.8
    this.analyserNode.minDecibels = -150
    this.analyserNode.maxDecibels = -10

    let paintThreadOptions

    if (supportSAB) {
      const len =
        this.analyserNode.frequencyBinCount * Uint8Array.BYTES_PER_ELEMENT
      let frame = 0

      const dataSAB = new SharedArrayBuffer(len)
      const data = new Uint8Array(dataSAB)
      const dataTemp = new Uint8Array(data.length)
      const frameSAB = new SharedArrayBuffer(4)
      const frameI32 = new Int32Array(frameSAB)

      // console.log(data.length, this.analyserNode.frequencyBinCount)

      paintThreadOptions = { dataSAB, frameSAB }

      this.draw = () => {
        this.analyserNode.getByteFrequencyData(dataTemp)
        data.set(dataTemp)
        frame = (frame + 1) % 100_000
        Atomics.store(frameI32, 0, frame)
        Atomics.notify(frameI32, 0)
      }
    } else {
      const data = new Uint8Array(this.analyserNode.frequencyBinCount)
      paintThreadOptions = {
        frequencyBinCount: this.analyserNode.frequencyBinCount,
      }
      this.draw = () => {
        this.analyserNode.getByteFrequencyData(data)
        this.thread.carry(data)
      }
    }

    this.thread.configure({
      mode: "spectroscope",
      nyquist: this.analyserNode.context.sampleRate / 2,
      fill: this.fill,
      ...paintThreadOptions,
    })

    this.play()
  }
}

export const scope = Component.define(ScopeComponent)
