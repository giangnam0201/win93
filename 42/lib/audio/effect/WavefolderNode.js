import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "wavefolder"

/* MARK: Node
------------- */

export class WavefolderNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ drive
  /** @type {AudioParam} */ fold
  /** @type {AudioParam} */ mix

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class WavefolderProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "drive", defaultValue: 1, minValue: 0.5, maxValue: 10 },
      { name: "fold", defaultValue: 1, minValue: 0.1, maxValue: 5 },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1 },
    ]
  }

  process([input], [output], p) {
    if (input.length === 0) return this.running

    const channels = output.length

    for (let ch = 0; ch < channels; ch++) {
      const inData = input[ch] || new Float32Array(128)
      const outData = output[ch]

      for (let i = 0; i < 128; i++) {
        const drive = p.drive.length > 1 ? p.drive[i] : p.drive[0]
        const fold = p.fold.length > 1 ? p.fold[i] : p.fold[0]
        const mix = p.mix.length > 1 ? p.mix[i] : p.mix[0]

        const x = inData[i] * drive

        // core wavefolding
        let y = x
        const limit = fold

        if (y > limit) {
          y = limit - (y - limit)
        } else if (y < -limit) {
          y = -limit - (y + limit)
        }

        // soft saturation to avoid harsh clipping
        y = Math.tanh(y)

        outData[i] = x * (1 - mix) + y * mix
      }
    }

    return this.running
  }
}

AudioProcessor.define(NAME, WavefolderProcessor)
