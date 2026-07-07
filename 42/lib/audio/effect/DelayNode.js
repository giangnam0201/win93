import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "delay"

/* MARK: Node
------------- */

export class DelayNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ time
  /** @type {AudioParam} */ feedback
  /** @type {AudioParam} */ mix

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class DelayProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "time", defaultValue: 0.2, minValue: 0, maxValue: 2 },
      { name: "feedback", defaultValue: 0.5, minValue: 0, maxValue: 0.95 },
      { name: "mix", defaultValue: 0.2, minValue: 0, maxValue: 1 },
    ]
  }

  constructor(options) {
    super(options)
    this._maxSamples = 48_000 * 2
    this._buffers = []
    this._writePos = []
  }

  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const inChans = input
    const outChans = output
    const channelCount = outChans.length

    while (this._buffers.length < channelCount) {
      this._buffers.push(new Float32Array(this._maxSamples))
      this._writePos.push(0)
    }

    for (let ch = 0; ch < channelCount; ch++) {
      const buf = this._buffers[ch]
      const inData = inChans[ch] || new Float32Array(128)
      const outData = outChans[ch]
      let wp = this._writePos[ch]

      for (let i = 0; i < 128; i++) {
        const delaySec =
          parameters.time.length > 1 ? parameters.time[i] : parameters.time[0]
        const fb =
          parameters.feedback.length > 1
            ? parameters.feedback[i]
            : parameters.feedback[0]
        const m =
          parameters.mix.length > 1 ? parameters.mix[i] : parameters.mix[0]

        const delaySamples = Math.min(
          delaySec * sampleRate,
          this._maxSamples - 1,
        )

        let readPos = wp - delaySamples
        if (readPos < 0) readPos += this._maxSamples
        readPos %= this._maxSamples

        const i1 = Math.floor(readPos)
        const i2 = (i1 + 1) % this._maxSamples
        const frac = readPos - i1
        const delayedSample = buf[i1] * (1 - frac) + buf[i2] * frac

        const drySample = inData[i]
        outData[i] = drySample * (1 - m) + delayedSample * m

        buf[wp] = drySample + delayedSample * fb

        wp = (wp + 1) % this._maxSamples
      }

      this._writePos[ch] = wp
    }

    return this.running
  }
}

AudioProcessor.define(NAME, DelayProcessor)
