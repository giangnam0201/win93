import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"
import { exponentialScale, logarithmicScale } from "../../type/number/math.js"

/** Convert normalized cable contributions into the destination's native units. */
export class ParamModulationNode extends AudioProcessorNode {
  static module = import.meta.url
  /** @type {AudioParam} */ base

  /**
   * @param {BaseAudioContext} context
   * @param {{ base: number, min: number, max: number, scale?: string, minDb?: number, intrinsic: number }} options
   */
  constructor(context, options) {
    super(context, "param-modulation", {
      numberOfInputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
      outputChannelCount: [1],
      parameterData: { base: options.base },
      processorOptions: options,
    })
    this.setParameters()
  }
}

class ParamModulationProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [{ name: "base", defaultValue: 0 }]
  }

  constructor(options) {
    super(options)
    Object.assign(this, options.processorOptions)
    this.frames = 0
  }

  process([input], [output], { base }) {
    const channel = output[0]
    const signal = input[0]
    const range = this.max - this.min
    let fraction = 0
    for (let i = 0; i < channel.length; i++) {
      let value = base[i % base.length]
      if (this.scale === "dB") {
        value = Math.max(this.min, 20 * Math.log10(value))
      } else if (this.scale === "log") {
        value = logarithmicScale(value, this.min, this.max)
      }
      const baseFraction = (value - this.min) / range
      const raw = signal?.[i] ?? 0
      const headroom = raw >= 0 ? 1 - baseFraction : baseFraction
      fraction = Math.max(
        0,
        Math.min(1, baseFraction + raw * headroom * 2),
      )
      value = this.min + fraction * range
      if (this.scale === "dB") {
        value = this.minDb === value ? 0 : 10 ** (value / 20)
      } else if (this.scale === "log") {
        value = exponentialScale(value, this.min, this.max)
      }
      channel[i] = value - this.intrinsic
    }
    this.frames += channel.length
    if (this.frames >= sampleRate / 30) {
      this.frames = 0
      this.port.postMessage(fraction)
    }
    return this.running
  }
}

AudioProcessor.define("param-modulation", ParamModulationProcessor)
