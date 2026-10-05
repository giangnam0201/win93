import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

/**
 * Evaluate a bipolar LFO waveform at a phase in [0, 1).
 * @param {string} type
 * @param {number} phase
 */
export function lfoWaveform(type, phase) {
  switch (type) {
    case "square":
      return phase < 0.5 ? 1 : -1
    case "sawtooth":
      return 2 * phase - 1
    case "triangle":
      return 1 - 4 * Math.abs(phase - 0.5)
    default:
      return Math.sin(phase * 2 * Math.PI)
  }
}

/** An audio-clock LFO with a latched Hold. */
export class LFONode extends AudioProcessorNode {
  static module = import.meta.url
  static types = ["sine", "square", "sawtooth", "triangle"]

  /** @type {AudioParam} */ rate
  /** @type {AudioParam} */ depth
  /** @type {AudioParam} */ offset
  /** @type {AudioParam} */ hold

  /**
   * @param {BaseAudioContext} context
   * @param {{ type?: string, rate?: number, depth?: number, offset?: number, hold?: number }} [options]
   */
  constructor(context, { type = "sine", ...parameterData } = {}) {
    super(context, "lfo", {
      numberOfInputs: 0,
      outputChannelCount: [1],
      parameterData,
      processorOptions: { type },
    })
    this.setParameters()
    this.type = type
  }

  get type() {
    return this.waveform
  }
  set type(type) {
    if (!LFONode.types.includes(type)) return
    this.waveform = type
    this.port.postMessage({ type })
  }
}

class LFOProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rate", defaultValue: 1, minValue: 0.001, maxValue: 20 },
      { name: "depth", defaultValue: 100, minValue: -100, maxValue: 100 },
      { name: "offset", defaultValue: 0, minValue: -100, maxValue: 100 },
      {
        name: "hold",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ]
  }

  constructor(options) {
    super(options)
    this.type = options.processorOptions.type
    this.phase = 0
    this.last = 0
    this.port.onmessage = ({ data }) => {
      if (data.type) this.type = data.type
    }
  }

  process(inputs, [output], params) {
    const channel = output[0]
    for (let i = 0; i < channel.length; i++) {
      if (!params.hold[0]) {
        this.last =
          (lfoWaveform(this.type, this.phase) *
            params.depth[i % params.depth.length]) /
            100 +
          params.offset[i % params.offset.length] / 100
        this.phase += params.rate[i % params.rate.length] / sampleRate
        if (this.phase >= 1) {
          this.phase -= 1
        }
      }
      channel[i] = this.last
    }
    return this.running
  }
}

AudioProcessor.define("lfo", LFOProcessor)
