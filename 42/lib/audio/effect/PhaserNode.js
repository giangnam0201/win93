// DOD Phasor 490 style

import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "phasor"

/* MARK: Node
------------- */

export class PhasorNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ speed
  /** @type {AudioParam} */ regen

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class PhasorProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "speed", defaultValue: 0.5, minValue: 0.05, maxValue: 8 }, // Hz
      { name: "regen", defaultValue: 0.35, minValue: 0, maxValue: 0.9 }, // feedback
    ]
  }

  constructor() {
    super()

    this.STAGES = 4

    this.phase = []
    this.apX = []
    this.apY = []
    this.g = []
    this.feedback = []
    this.regenSmooth = []

    this.initialized = false
  }

  _init(channels) {
    while (this.phase.length < channels) {
      this.phase.push(Math.random() * Math.PI * 2)

      this.apX.push(Array.from({ length: this.STAGES }, () => 0))
      this.apY.push(Array.from({ length: this.STAGES }, () => 0))

      this.g.push(0.5)
      this.feedback.push(0)
      this.regenSmooth.push(0)
    }
    this.initialized = true
  }

  _allpass(x, ch, stage) {
    const g = this.g[ch]
    const x1 = this.apX[ch][stage]
    const y1 = this.apY[ch][stage]

    const y = -g * x + x1 + g * y1

    this.apX[ch][stage] = x
    this.apY[ch][stage] = y

    return y
  }

  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const channels = Math.max(2, output.length)
    if (!this.initialized) this._init(channels)

    const speedParam = parameters.speed[0]
    const regenParam = parameters.regen[0]

    for (let ch = 0; ch < channels; ch++) {
      const inData = input[ch] || input[0]
      const outData = output[ch]

      let phase = this.phase[ch]
      let fb = this.feedback[ch]
      let regenSmooth = this.regenSmooth[ch]

      const stereoOffset = ch === 0 ? 0 : Math.PI / 2

      for (let i = 0; i < inData.length; i++) {
        const dry = inData[i]

        const lfo = Math.sin(phase + stereoOffset)

        const gTarget = 0.05 + (lfo * 0.45 + 0.45) // ≈ 0.05 → 0.95
        this.g[ch] += (gTarget - this.g[ch]) * 0.0006

        regenSmooth += (regenParam - regenSmooth) * 0.0008
        this.regenSmooth[ch] = regenSmooth

        const x = dry + fb * regenSmooth * 0.75

        let y = x
        for (let s = 0; s < this.STAGES; s++) {
          y = this._allpass(y, ch, s)
        }

        fb = fb * 0.85 + y * 0.15
        this.feedback[ch] = fb

        const wet = y

        const wetGain = 1.2
        outData[i] = dry * 0.7 + wet * wetGain * 0.6

        phase += (2 * Math.PI * speedParam) / sampleRate
        if (phase > Math.PI * 2) phase -= Math.PI * 2
      }

      this.phase[ch] = phase
    }

    return this.running
  }
}

AudioProcessor.define(NAME, PhasorProcessor)
