import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "bitcrusher"

/* MARK: Node
------------- */

export class BitcrusherNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ bits
  /** @type {AudioParam} */ resolution

  constructor(context, parameterData) {
    super(context, NAME, {
      parameterData,
    })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

/**
 * @see https://webaudio.github.io/web-audio-api/#the-bitcrusher-node
 */
class BitcrusherProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "bits",
        defaultValue: 12,
        minValue: 0.5,
        maxValue: 16,
      },
      {
        name: "resolution",
        defaultValue: 0.5,
        minValue: 0.001,
        maxValue: 1,
      },
    ]
  }

  constructor(options) {
    super(options)
    this.phase = 0
    this.lastSample = [0, 0]
    this.channelResetPhase = options.parameterData?.channelResetPhase ?? 0
  }

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} parameters
   */
  process([input], [output], { bits, resolution }) {
    if (input.length === 0) return this.running

    const isBitsAnimated = bits.length > 1
    let step = 0.5 ** bits[0]

    const { phase } = this

    for (let channel = 0, l = output.length; channel < l; channel++) {
      if (!this.channelResetPhase) this.phase = phase

      const inputData = input[channel % input.length]
      const outputData = output[channel]

      for (let i = 0; i < 128; i++) {
        if (isBitsAnimated) step = 0.5 ** bits[i]

        this.phase += resolution[i % resolution.length]

        if (this.phase >= 1) {
          this.phase -= 1
          this.lastSample[channel] =
            step * Math.floor(inputData[i] / step + 0.5)
        }

        outputData[i] = this.lastSample[channel]
      }
    }

    return this.running
  }
}

AudioProcessor.define(NAME, BitcrusherProcessor)
