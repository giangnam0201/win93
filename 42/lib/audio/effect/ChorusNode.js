// Ibanez CS9 Style
import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "chorus"

/* MARK: Node
------------- */

export class ChorusNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ rate
  /** @type {AudioParam} */ depth
  /** @type {AudioParam} */ delay
  /** @type {AudioParam} */ mix

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class ChorusProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rate", defaultValue: 0.8, minValue: 0, maxValue: 10 }, // Hz
      { name: "depth", defaultValue: 0.003, minValue: 0.0005, maxValue: 0.01 }, // sec
      // { name: "delay", defaultValue: 0.012, minValue: 0.002, maxValue: 0.03 }, // sec
      // { name: "mix", defaultValue: 0.5, minValue: 0, maxValue: 1 },
    ]
  }

  constructor() {
    super()

    this._maxDelay = Math.floor(sampleRate * 0.05) // 50ms buffer
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
      this._smoothedDelay.push(0)
      this._phase.push(Math.random() * Math.PI * 2) // phase différente par canal
    }
    this._initialized = true
  }

  _readInterpolated(buffer, index) {
    const i0 = Math.floor(index)
    const i1 = (i0 + 1) % buffer.length
    const frac = index - i0
    return buffer[i0] * (1 - frac) + buffer[i1] * frac
  }

  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const channelCount = Math.max(2, output.length)
    if (!this._initialized) this._init(channelCount)

    const rate = parameters.rate[0]
    const depth = parameters.depth[0]
    const baseDelay = 0.03 // parameters.delay[0]
    const mix = 1 // parameters.mix[0]

    for (let ch = 0; ch < channelCount; ch++) {
      const inData = input[ch] || input[0]
      const outData = output[ch]

      const buffer = this._buffers[ch]
      let wp = this._writePos[ch]
      let phase = this._phase[ch]

      // déphasage stéréo (L/R opposés)
      const stereoPhaseOffset = ch === 0 ? 0 : Math.PI / 2

      for (let i = 0; i < inData.length; i++) {
        const dry = inData[i]

        // LFO sinus (chorus smooth, pas vibrato brutal)
        const lfo = Math.sin(phase + stereoPhaseOffset) * depth

        // const delaySamples = (baseDelay + lfo) * sampleRate
        const targetDelay = (baseDelay + lfo) * sampleRate
        this._smoothedDelay[ch] +=
          (targetDelay - this._smoothedDelay[ch]) * 0.002
        const delaySamples = this._smoothedDelay[ch]

        const readIndex = (wp - delaySamples + this._maxDelay) % this._maxDelay

        const wet = this._readInterpolated(buffer, readIndex)

        // write input into delay buffer
        buffer[wp] = dry
        wp = (wp + 1) % this._maxDelay

        // mix dry/wet
        outData[i] = dry * (1 - mix) + wet * mix

        // LFO increment
        phase += (2 * Math.PI * rate) / sampleRate
        if (phase > Math.PI * 2) phase -= Math.PI * 2
      }

      this._writePos[ch] = wp
      this._phase[ch] = phase
    }

    return this.running
  }
}

AudioProcessor.define(NAME, ChorusProcessor)
