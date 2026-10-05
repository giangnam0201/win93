// FET-style Compressor with pre-drive and soft saturation
import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "compressor"

/* MARK: Node
------------- */
export class CompressorNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ threshold
  /** @type {AudioParam} */ ratio
  /** @type {AudioParam} */ attack
  /** @type {AudioParam} */ release
  /** @type {AudioParam} */ drive
  /** @type {AudioParam} */ makeup

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class CompressorProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -20, minValue: -60, maxValue: 0 },
      { name: "ratio", defaultValue: 8, minValue: 4, maxValue: 20 },
      { name: "attack", defaultValue: 0.003, minValue: 0.0005, maxValue: 0.03 },
      { name: "release", defaultValue: 0.08, minValue: 0.02, maxValue: 0.3 },
      { name: "drive", defaultValue: 1, minValue: 1, maxValue: 4 },
      { name: "makeup", defaultValue: 6, minValue: 0, maxValue: 18 },
    ]
  }

  constructor(options) {
    super(options)
    this._env = []
  }

  process([input], [output], p) {
    if (input.length === 0) return this.running

    const channels = output.length
    while (this._env.length < channels) this._env.push(0)

    for (let ch = 0; ch < channels; ch++) {
      const inData = input[ch] || new Float32Array(128)
      const outData = output[ch]
      let env = this._env[ch]

      for (let i = 0; i < 128; i++) {
        // PRE-DRIVE (Boss pedal style)
        const x = inData[i] * p.drive[0]

        const abs = Math.abs(x)
        const atk = Math.exp(-1 / (sampleRate * p.attack[0]))
        const rel = Math.exp(-1 / (sampleRate * p.release[0]))

        env = abs > env ? atk * (env - abs) + abs : rel * (env - abs) + abs

        const envDb = 20 * Math.log10(env + 1e-8)

        let gainDb = 0
        if (envDb > p.threshold[0]) {
          gainDb = (p.threshold[0] - envDb) * (1 - 1 / p.ratio[0])
        }

        const gain = 10 ** ((gainDb + p.makeup[0]) / 20)

        // soft saturation (FET flavor)
        outData[i] = Math.tanh(x * gain)
      }

      this._env[ch] = env
    }

    return this.running
  }
}

AudioProcessor.define(NAME, CompressorProcessor)
