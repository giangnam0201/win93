import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

/**
 * @typedef {["sine", "square", "sawtooth", "triangle"]} PhaseOscillatorType
 */

function failMessage(value, type) {
  return `The provided value '${value}' is not a valid enum value of type ${type}.`
}

/* MARK: Node
------------- */

export class PhaseOscillatorNode extends AudioProcessorNode {
  static module = import.meta.url

  static types = ["sine", "square", "sawtooth", "triangle"]

  /** @type {AudioParam} */ gain
  /** @type {AudioParam} */ phase
  /** @type {AudioParam} */ duty
  /** @type {AudioParam} */ frequency
  /** @type {AudioParam} */ sync

  /** @type {string} */ #type
  paused = true

  constructor(context, options = {}) {
    let { paused, type, ...parameterData } = options
    type ??= "sine"

    if (!PhaseOscillatorNode.types.includes(type)) {
      throw new TypeError(
        `Failed to construct 'PhaseOscillatorNode': ${failMessage(type, "PhaseOscillatorType")}`,
      )
    }

    super(context, "phase-oscillator", {
      processorOptions: { type },
      parameterData,
      outputChannelCount: [1],
    })

    this.setParameters()

    this.#type = type
    this.paused = paused ?? true
  }

  get type() {
    return this.#type
  }
  set type(type) {
    if (!PhaseOscillatorNode.types.includes(type)) {
      console.warn(failMessage(type, "PhaseOscillatorType"))
      return
    }

    this.#type = type
    this.port.postMessage({ type })
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

const saw = (v) => v - Math.floor(v)

/**
 * @see https://github.com/Flarp/better-oscillator
 */
class PhaseOscillatorProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "gain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
      },
      {
        name: "frequency",
        defaultValue: 440,
        minValue: Number.EPSILON,
        maxValue: 20_000,
      },
      {
        name: "duty",
        defaultValue: 0.5,
        minValue: 0.000_001,
        maxValue: 0.999_999,
      },
      {
        name: "phase",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
      },
      {
        name: "sync",
        defaultValue: 0,
        minValue: 0,
      },
    ]
  }

  constructor(options) {
    super(options)

    this.paused = options.processorOptions.paused ?? true

    this.phase = 0
    this.syncPhase = 0
    this.prevSyncPhase = 0

    this.setType(options.processorOptions.type ?? "sine")

    this.port.onmessage = ({ data }) => {
      if ("paused" in data) {
        this.paused = Boolean(data.paused)
      } else if (data.type) {
        this.setType(data.type)
      }
    }
  }

  setType(type) {
    this.type = type
    this.generator = this[type]
  }

  // sine wave made using bulit-in Math.sin
  sine(main, phase) {
    return Math.sin((main + this.phase + phase) * 2 * Math.PI)
  }

  // pulse wave using difference of phase shifted saws and variable DC threshold
  square(main, phase, i, params) {
    const duty = params.duty[i % params.duty.length]
    const temp = main + this.phase + phase
    return saw(temp) - saw(temp + duty) > 0 ? 1 : -1
  }

  // sawtooth wave using linear piecewise floor
  sawtooth(main, phase) {
    return 2 * saw(main + this.phase + phase) - 1
  }

  // triangle wave using absolute value of amplitude shifted sawtooth wave
  triangle(main, phase) {
    return 4 * Math.abs(saw(main + this.phase + phase) - 1 / 2) - 1
  }

  /**
   * @param {Float32Array[][]} _
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} params
   */
  process(_, [output], params) {
    if (this.paused) return this.running

    const channel = output[0]
    const outlen = channel.length

    let back = 0

    for (let i = 0; i < 128; i++) {
      const gain = params.gain[i % params.gain.length]
      const freq = params.frequency[i % params.frequency.length]
      const phase = params.phase[i % params.phase.length]
      const sync = params.sync[i % params.sync.length]

      this.syncPhase = this.prevSyncPhase % (sync / sampleRate)

      if (sync !== 0 && this.prevSyncPhase >= sync / sampleRate) {
        this.phase = 0
        back = i
      }

      this.prevSyncPhase = this.syncPhase
      const main = (freq * (i - back)) / sampleRate

      channel[i] = this.generator(main, phase, i, params) * gain

      this.prevSyncPhase += 1 / sampleRate
    }

    this.phase +=
      (params.frequency[params.frequency.length === 1 ? 0 : outlen - 1] *
        outlen) /
      sampleRate

    this.phase %= sampleRate

    return this.running
  }
}

AudioProcessor.define("phase-oscillator", PhaseOscillatorProcessor)
