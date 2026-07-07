import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "moog-filter"

/* MARK: Node
------------- */

export class MoogFilterNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ cutoff
  /** @type {AudioParam} */ resonance

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
 * @see https://noisehack.com/custom-audio-effects-javascript-web-audio-api/#moog-filter
 */
class MoogFilterProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "cutoff",
        defaultValue: 0.5,
        minValue: 0.001,
        maxValue: 1,
      },
      {
        name: "resonance",
        defaultValue: 0.96,
        minValue: 0,
        maxValue: 4,
      },
    ]
  }

  channelPoles = []

  constructor(options) {
    super(options)

    const channels = options.outputChannelCount[0]

    for (let i = 0; i < channels; i++) {
      this.channelPoles.push({
        in1: 0,
        in2: 0,
        in3: 0,
        in4: 0,
        out1: 0,
        out2: 0,
        out3: 0,
        out4: 0,
      })
    }
  }

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} parameters
   */
  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const isAnimated =
      parameters.cutoff.length > 1 || parameters.resonance.length > 1

    let cutoff = parameters.cutoff[0]
    let resonance = parameters.resonance[0]
    let f = cutoff * 1.16
    let fb = resonance * (1 - 0.15 * f * f)
    let inputFactor = 0.350_13 * (f * f) * (f * f)

    for (let channel = 0, l = output.length; channel < l; channel++) {
      const inputData = input[channel] ?? input[0]
      const outputData = output[channel]

      const p = this.channelPoles[channel]

      for (let i = 0; i < 128; i++) {
        if (isAnimated) {
          cutoff = parameters.cutoff[i % parameters.cutoff.length]
          resonance = parameters.resonance[i % parameters.resonance.length]
          f = cutoff * 1.16
          fb = resonance * (1 - 0.15 * f * f)
          inputFactor = 0.350_13 * (f * f) * (f * f)
        }

        let sample = inputData[i]

        sample -= p.out4 * fb
        sample *= inputFactor
        p.out1 = sample + 0.3 * p.in1 + (1 - f) * p.out1 // Pole 1
        p.in1 = sample
        p.out2 = p.out1 + 0.3 * p.in2 + (1 - f) * p.out2 // Pole 2
        p.in2 = p.out1
        p.out3 = p.out2 + 0.3 * p.in3 + (1 - f) * p.out3 // Pole 3
        p.in3 = p.out2
        p.out4 = p.out3 + 0.3 * p.in4 + (1 - f) * p.out4 // Pole 4
        p.in4 = p.out3

        outputData[i] = p.out4
      }
    }

    return this.running
  }
}

AudioProcessor.define(NAME, MoogFilterProcessor)
