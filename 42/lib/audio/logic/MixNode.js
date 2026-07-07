import * as curves from "../algo/crossfaderCurves.js"
import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

/* MARK: Node
------------- */

export class MixNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ crossfader

  constructor(context, parameterData) {
    super(context, "mix", {
      parameterData,
      outputChannelCount: [2],
    })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class MixProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "crossfader",
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
      },
    ]
  }

  // type = "slowFadeCurve"
  type = "cubicCurve"
  // type = "dippedCurve"
  // type = "transitionCurve"
  // type = "constantPowerCurve"

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} parameters
   */
  process([input], [output], { crossfader }) {
    if (input.length === 0) return this.running

    const R = input.length === 1 ? 0 : 1 // upmix to stereo

    for (let i = 0; i < 128; i++) {
      const value = (crossfader[i % crossfader.length] + 1) / 2
      const [a, b] = curves[this.type](value, 0)
      output[0][i] = input[0][i] * a
      output[1][i] = input[R][i] * b
    }

    return this.running
  }
}

AudioProcessor.define("mix", MixProcessor)
