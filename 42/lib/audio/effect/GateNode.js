import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "gate"

/* MARK: Node
------------- */

export class GateNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ threshold
  /** @type {AudioParam} */ ratio
  /** @type {AudioParam} */ attack
  /** @type {AudioParam} */ release

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class GateProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: 0, minValue: -80, maxValue: 0 },
      { name: "ratio", defaultValue: 20, minValue: 1, maxValue: 20 },
      { name: "attack", defaultValue: 0.0005, minValue: 0.0005, maxValue: 0.1 },
      { name: "release", defaultValue: 0.2, minValue: 0.005, maxValue: 1 },
    ]
  }

  constructor(options) {
    super(options)
    this._env = 0
    this._gain = 1
  }

  _dbToLin(db) {
    return 10 ** (db / 20)
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
        const thresholdDb =
          parameters.threshold.length > 1
            ? parameters.threshold[i]
            : parameters.threshold[0]
        const ratio =
          parameters.ratio.length > 1
            ? parameters.ratio[i]
            : parameters.ratio[0]
        const attack =
          parameters.attack.length > 1
            ? parameters.attack[i]
            : parameters.attack[0]
        const release =
          parameters.release.length > 1
            ? parameters.release[i]
            : parameters.release[0]

        const threshold = this._dbToLin(thresholdDb)

        // envelope follower (peak detector)
        const x = Math.abs(inData[i])
        const attackCoeff = Math.exp(-1 / (attack * sampleRate))
        const releaseCoeff = Math.exp(-1 / (release * sampleRate))

        this._env =
          x > this._env
            ? attackCoeff * (this._env - x) + x
            : releaseCoeff * (this._env - x) + x

        let gain = 1

        if (this._env < threshold) {
          const below = this._env / threshold
          gain = below ** ratio
        }

        // smoothing gain (anti-click)
        this._gain += (gain - this._gain) * 0.01

        outData[i] = inData[i] * this._gain
      }
    }

    return this.running
  }
}

AudioProcessor.define(NAME, GateProcessor)
