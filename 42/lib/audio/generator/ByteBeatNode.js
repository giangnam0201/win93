import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"
import { Emittable } from "../../class/mixin/Emittable.js"

const supportSAB = globalThis.SharedArrayBuffer !== undefined

/* MARK: Node
------------- */

export class ByteBeatNode extends Emittable(AudioProcessorNode) {
  static module = import.meta.url

  #t
  #formula
  #mode

  /** @type {AudioParam} */ bits
  /** @type {AudioParam} */ sampleRate
  /** @type {AudioParam} */ gain

  constructor(context, options = {}) {
    let { formula, mode, t, paused, listen, ...parameterData } = options

    paused ??= true
    formula ??= "0"
    t ??= 0

    super(context, "bytebeat", {
      processorOptions: { formula, mode, paused, t, listen },
      outputChannelCount: [2],
      parameterData,
    })

    const { port1, port2 } = new MessageChannel()
    port1.onmessage = ({ data }) => this.emit("error", data)
    this.port.postMessage({ errorPort: port2 }, [port2])

    this.setParameters()

    if (options?.listen !== false) {
      this.port.onmessage = ({ data }) => {
        if (data.initSAB) {
          this.#t = new Float64Array(data.initSAB)
        } else {
          this.port.onmessage = ({ data }) => {
            this.#t = data
          }
        }
      }
    }

    this.paused = paused
    this.#formula = formula
    this.#mode = mode
    this.#t = t
  }

  get t() {
    return supportSAB ? this.#t[0] : this.#t
  }
  set t(t) {
    if (supportSAB) {
      this.#t[0] = t
    } else {
      this.#t = t
      this.port.postMessage({ t })
    }
  }

  get formula() {
    return this.#formula
  }
  set formula(formula) {
    this.#formula = formula
    this.port.postMessage({ formula })
  }

  get mode() {
    return this.#mode
  }
  set mode(mode) {
    this.#mode = mode
    this.port.postMessage({ mode })
  }

  update({ formula, mode, t }) {
    const message = {}

    if (mode !== undefined) {
      this.#mode = mode
      message.mode = mode
    }

    if (formula !== undefined) {
      this.#formula = formula
      message.formula = formula
    }

    if (t !== undefined) {
      if (supportSAB) {
        this.#t[0] = t
      } else {
        this.#t = t
        message.t = t
      }
    }

    if (Object.keys(message).length > 0) {
      this.port.postMessage(message)
    }
  }

  playAt(t) {
    this.t = t
    this.paused = false
    this.port.postMessage({ paused: false })
  }

  play() {
    this.paused = false
    this.port.postMessage({ paused: false })
  }

  pause() {
    this.paused = true
    this.port.postMessage({ paused: true })
  }

  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }
}

/* MARK: Processor
------------------ */

import { compileBytebeat } from "./ByteBeat/compileBytebeat.js"

class BytebeatProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "gain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
      },
      {
        name: "bits",
        defaultValue: 8,
        minValue: 1,
        maxValue: 31,
      },
      {
        name: "sampleRate",
        defaultValue: 8000,
        minValue: 1,
        maxValue: 192_000,
      },
    ]
  }

  constructor(options) {
    super(options)

    this.paused = options.processorOptions.paused ?? true
    this.formula = options.processorOptions.formula ?? "0"

    const sab = supportSAB
      ? new SharedArrayBuffer(Float64Array.BYTES_PER_ELEMENT)
      : new ArrayBuffer(Float64Array.BYTES_PER_ELEMENT)

    this.t = new Float64Array(sab)
    this.t[0] = options.processorOptions.t ?? 0

    if (options.processorOptions.listen !== false) {
      this.port.postMessage({ initSAB: supportSAB ? sab : false })
      this.listen = !supportSAB
    }

    this.setMode(options.processorOptions.mode)

    this.port.onmessage = ({ data }) => {
      if ("errorPort" in data) {
        this.errorPort = data.errorPort
        this.compile(this.formula)
      }

      if ("t" in data) {
        this.t[0] = data.t
      }

      let shouldCompile = false

      if ("formula" in data) {
        this.formula = data.formula
        shouldCompile = true
      }

      if ("mode" in data) {
        this.setMode(data.mode)
        shouldCompile = true
      }

      if (shouldCompile) this.compile(this.formula)

      if ("paused" in data) this.paused = Boolean(data.paused)

      if ("listen" in data) {
        this.port.postMessage({ initSAB: supportSAB ? sab : false })
        this.listen = !supportSAB
      }
    }
  }

  setMode(mode = "bytebeat") {
    mode = mode.toLowerCase()
    this.mode = mode
    if (mode === "floatbeat" || mode === "funcbeat") {
      this.normalize = (value, gainValue) =>
        Math.max(Math.min(value, 1), -1) * gainValue
    } else if (mode === "signed bytebeat") {
      this.normalize = (value, gainValue, mask, divisor) =>
        (((value + 128) & mask) / divisor) * gainValue
    } else {
      this.normalize = (value, gainValue, mask, divisor) =>
        ((value & mask) / divisor) * gainValue
    }
  }

  normalizeSample(value, gainValue, mask, divisor) {
    const sample = this.normalize(value, gainValue, mask, divisor)
    return Number.isFinite(sample) ? sample : 0
  }

  /** @type {Function} */
  generator = () => 0

  compile(formula) {
    const res = compileBytebeat(formula, {
      mode: this.mode,
      fallback: this.generator,
      onError: (err) => this.errorPort.postMessage(err),
    })
    if (Array.isArray(res)) this.errorPort.postMessage(res[0])
    else this.generator = res
  }

  /**
   * @param {Float32Array[][]} _
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} parameters
   */
  process(_, [[leftChannel, rightChannel]], { gain, bits, sampleRate: rate }) {
    if (this.paused) return this.running

    const constantBits = bits.length === 1
    const isFuncbeat = this.mode === "funcbeat"

    let mask = (1 << bits[0]) - 1
    let divisor = 1 << (bits[0] - 1)

    rightChannel[0] = 0

    let left
    let right

    for (let i = 0; i < leftChannel.length; i++) {
      if (!constantBits) {
        mask = (1 << bits[i]) - 1
        divisor = 1 << (bits[i] - 1)
      }

      const gainValue = gain[i % gain.length]
      const rateValue = rate[i % rate.length]
      const t = ~~((this.t[0]++ * rateValue) / sampleRate)
      const value = isFuncbeat
        ? this.generator(t / rateValue, rateValue)
        : this.generator(t)

      if (Array.isArray(value)) {
        left = this.normalizeSample(value[0], gainValue, mask, divisor)
        right = this.normalizeSample(value[1], gainValue, mask, divisor)
      } else {
        left = this.normalizeSample(value, gainValue, mask, divisor)
        right = left
      }

      leftChannel[i] = left
      rightChannel[i] = right
    }

    if (this.listen) this.port.postMessage(this.t[0])

    return this.running
  }
}

AudioProcessor.define("bytebeat", BytebeatProcessor)
