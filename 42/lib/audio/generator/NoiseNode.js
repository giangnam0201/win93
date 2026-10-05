import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

/**
 * @typedef {["white", "pink", "brown"]} NoiseType
 */

function failMessage(value, type) {
  return `The provided value '${value}' is not a valid enum value of type ${type}.`
}

/* MARK: Node
------------- */

export class NoiseNode extends AudioProcessorNode {
  static module = import.meta.url

  static types = ["white", "pink", "brown"]

  /** @type {AudioParam} */ density
  /** @type {AudioParam} */ resolution
  /** @type {AudioParam} */ gain

  /** @type {string} */ #type
  paused = true

  constructor(context, options = {}) {
    let { paused, type, stereo, ...parameterData } = options
    type ??= "white"

    if (!NoiseNode.types.includes(type)) {
      throw new TypeError(
        `Failed to construct 'NoiseNode': ${failMessage(type, "NoiseType")}`,
      )
    }

    super(context, "noise", {
      processorOptions: { type },
      outputChannelCount: [stereo ? 2 : 1],
      parameterData,
    })

    this.setParameters()

    this.#type = type
    this.paused = paused ?? true
  }

  get type() {
    return this.#type
  }
  set type(type) {
    if (!NoiseNode.types.includes(type)) {
      console.warn(failMessage(type, "NoiseType"))
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

const { random } = Math

const BROWN_GAIN_COMPENSATION = 3.5
const PINK_GAIN_COMPENSATION = 0.11
let white

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process#examples
 */
class NoiseProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "density",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
      },
      {
        name: "resolution",
        defaultValue: 1,
        minValue: 0.001,
        maxValue: 1,
      },
      {
        name: "gain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
      },
    ]
  }

  constructor(options) {
    super(options)

    this.phase = 0
    this.lastSample = [0, 0]

    this.paused = options.processorOptions.paused ?? true

    this.setType(options.processorOptions.type ?? "white")

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

  white(samples, parameters, channelIdx) {
    for (let i = 0, l = samples.length; i < l; i++) {
      const density = parameters.density[i % parameters.density.length] ** 4
      if (random() > density) continue

      const gain = parameters.gain[i % parameters.gain.length] * (2 - density)
      this.phase += parameters.resolution[i % parameters.resolution.length]

      if (this.phase >= 1) {
        this.phase -= 1
        this.lastSample[channelIdx] = (random() * 2 - 1) * gain
      }

      samples[i] = this.lastSample[channelIdx]
    }
  }

  pink(samples, parameters, channelIdx) {
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0
    for (let i = 0, l = samples.length; i < l; i++) {
      const density = parameters.density[i % parameters.density.length] ** 4

      const gain = parameters.gain[i % parameters.gain.length]
      this.phase += parameters.resolution[i % parameters.resolution.length]

      white = random() * 2 - 1
      b0 = 0.998_86 * b0 + white * 0.055_517_9
      b1 = 0.993_32 * b1 + white * 0.075_075_9
      b2 = 0.969 * b2 + white * 0.153_852
      b3 = 0.8665 * b3 + white * 0.310_485_6
      b4 = 0.55 * b4 + white * 0.532_952_2
      b5 = -0.7616 * b5 - white * 0.016_898
      const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362

      if (this.phase >= 1) {
        this.phase -= 1
        this.lastSample[channelIdx] =
          random() > density //
            ? 0
            : out * PINK_GAIN_COMPENSATION * gain * (2 - density)
      }

      samples[i] = this.lastSample[channelIdx]

      b6 = white * 0.115_926
    }
  }

  brown(samples, parameters, channelIdx) {
    let lastOut = 0
    for (let i = 0, l = samples.length; i < l; i++) {
      const density = parameters.density[i % parameters.density.length] ** 4

      white = random() * 2 - 1
      lastOut = (lastOut + 0.02 * white) / 1.02

      const gain = parameters.gain[i % parameters.gain.length] * (2 - density)
      this.phase += parameters.resolution[i % parameters.resolution.length]

      if (this.phase >= 1) {
        this.phase -= 1
        this.lastSample[channelIdx] =
          random() > density ? 0 : lastOut * BROWN_GAIN_COMPENSATION * gain
      }

      samples[i] = this.lastSample[channelIdx]
    }
  }

  /**
   * @param {Float32Array[][]} _
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} parameters
   */
  process(_, [output], parameters) {
    if (this.paused) return this.running

    for (let channel = 0, l = output.length; channel < l; channel++) {
      this.generator(output[channel], parameters, channel)
    }

    return this.running
  }
}

AudioProcessor.define("noise", NoiseProcessor)
