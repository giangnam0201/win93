// PEARL FG-01 inspired stereo flanger

import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "flanger"

/* MARK: Node
------------- */

export class FlangerNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ manual
  /** @type {AudioParam} */ depth
  /** @type {AudioParam} */ feedback
  /** @type {AudioParam} */ speed

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class FlangerProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "manual", defaultValue: 0.003, minValue: 0.0005, maxValue: 0.01 }, // base delay (sec)
      { name: "depth", defaultValue: 0.002, minValue: 0, maxValue: 0.008 }, // modulation depth (sec)
      { name: "feedback", defaultValue: 0.3, minValue: -0.95, maxValue: 0.95 }, // feedback gain
      { name: "speed", defaultValue: 0.25, minValue: 0.01, maxValue: 20 }, // LFO Hz
    ]
  }

  constructor() {
    super()

    this._maxDelay = Math.floor(sampleRate * 0.02) // 20ms (classic flanger range)
    this._buffers = []
    this._writePos = []
    this._phase = []
    this._smoothedDelay = []
    this._initialized = false
  }

  _init(channelCount) {
    while (this._buffers.length < channelCount) {
      this._buffers.push(new Float32Array(this._maxDelay))
      this._writePos.push(0)
      this._phase.push(Math.random() * Math.PI * 2)
      this._smoothedDelay.push(0)
    }
    this._initialized = true
  }

  _readInterpolated(buffer, index) {
    const len = buffer.length
    const i1 = Math.floor(index)
    const frac = index - i1

    const i0 = (i1 - 1 + len) % len
    const i2 = (i1 + 1) % len
    const i3 = (i1 + 2) % len

    const y0 = buffer[i0]
    const y1 = buffer[i1]
    const y2 = buffer[i2]
    const y3 = buffer[i3]

    const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3
    const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
    const c = -0.5 * y0 + 0.5 * y2
    const d = y1

    return ((a * frac + b) * frac + c) * frac + d
  }

  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const channelCount = Math.max(2, output.length)
    if (!this._initialized) this._init(channelCount)

    const manual = parameters.manual[0]
    const depth = parameters.depth[0]
    const feedback = parameters.feedback[0]
    const speed = parameters.speed[0]

    for (let ch = 0; ch < channelCount; ch++) {
      const inData = input[ch] || input[0]
      const outData = output[ch]

      const buffer = this._buffers[ch]
      let wp = this._writePos[ch]
      let phase = this._phase[ch]

      const stereoOffset = ch === 0 ? 0 : Math.PI / 2

      for (let i = 0; i < inData.length; i++) {
        const dry = inData[i]

        const lfo = Math.sin(phase + stereoOffset)
        const targetDelay = (manual + lfo * depth) * sampleRate

        this._smoothedDelay[ch] +=
          (targetDelay - this._smoothedDelay[ch]) * 0.002
        const delaySamples = this._smoothedDelay[ch]

        const readIndex = (wp - delaySamples + this._maxDelay) % this._maxDelay

        const delayed = this._readInterpolated(buffer, readIndex)

        const fbSample = delayed * feedback
        buffer[wp] = dry + fbSample

        wp = (wp + 1) % this._maxDelay

        outData[i] = dry + delayed // no mix knob, classic flanger sum

        phase += (2 * Math.PI * speed) / sampleRate
        if (phase > Math.PI * 2) phase -= Math.PI * 2
      }

      this._writePos[ch] = wp
      this._phase[ch] = phase
    }

    return this.running
  }
}

AudioProcessor.define(NAME, FlangerProcessor)
