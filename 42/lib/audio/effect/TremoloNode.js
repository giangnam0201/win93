import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "tremolo"

/* MARK: Node
------------- */

export class TremoloNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ rate
  /** @type {AudioParam} */ depth
  /** @type {AudioParam} */ mix
  /** @type {AudioParam} */ shape

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class TremoloProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rate", defaultValue: 4, minValue: 0.01, maxValue: 20 },
      { name: "depth", defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1 },
      // shape : 0=sine, 1=triangle, 2=square, 3=saw, 4=random
      { name: "shape", defaultValue: 0, minValue: 0, maxValue: 4 },
    ]
  }

  constructor(options) {
    super(options)
    this._phase = 0
    this._lastRandom = 0
    this._nextRandom = 0
    this._randomPhase = 0
  }

  _osc(phase, shape) {
    const p = phase % 1

    switch (shape) {
      case 0: // sine
        return Math.sin(p * Math.PI * 2)

      case 1: // triangle
        return 1 - 4 * Math.abs(p - 0.5)

      case 2: // square
        return p < 0.5 ? 1 : -1

      case 3: // saw
        return 2 * p - 1

      case 4: // random (smooth S&H)
        return (
          this._lastRandom +
          (this._nextRandom - this._lastRandom) * this._randomPhase
        )
    }

    return 0
  }

  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const inChans = input
    const outChans = output
    const channelCount = outChans.length

    for (let ch = 0; ch < channelCount; ch++) {
      const inData = inChans[ch] || new Float32Array(128)
      const outData = outChans[ch]

      for (let i = 0; i < 128; i++) {
        const rate =
          parameters.rate.length > 1 ? parameters.rate[i] : parameters.rate[0]
        const depth =
          parameters.depth.length > 1
            ? parameters.depth[i]
            : parameters.depth[0]
        const mix =
          parameters.mix.length > 1 ? parameters.mix[i] : parameters.mix[0]
        const shape =
          parameters.shape.length > 1
            ? parameters.shape[i]
            : parameters.shape[0] | 0

        const phaseInc = rate / sampleRate
        this._phase += phaseInc
        if (this._phase >= 1) this._phase -= 1

        // random shape update
        if (shape === 4) {
          this._randomPhase += phaseInc
          if (this._randomPhase >= 1) {
            this._randomPhase -= 1
            this._lastRandom = this._nextRandom
            this._nextRandom = Math.random() * 2 - 1
          }
        }

        let lfo = this._osc(this._phase, shape)

        // normalize LFO from [-1,1] to [0,1]
        lfo = (lfo + 1) * 0.5

        // depth mapping (avoid silence when depth < 1)
        const gain = 1 - depth + depth * lfo

        const dry = inData[i]
        const wet = dry * gain

        outData[i] = dry * (1 - mix) + wet * mix
      }
    }

    return this.running
  }
}

AudioProcessor.define(NAME, TremoloProcessor)
