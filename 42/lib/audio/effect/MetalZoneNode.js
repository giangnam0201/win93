// Boss MT-2 METAL ZONE <3 inspired
import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "metalzone"

/* MARK: Node
------------- */

export class MetalZoneNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ gain
  /** @type {AudioParam} */ level
  /** @type {AudioParam} */ bass
  /** @type {AudioParam} */ mid
  /** @type {AudioParam} */ midFreq
  /** @type {AudioParam} */ treble

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class MetalZoneProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "gain", defaultValue: 30, minValue: 1, maxValue: 80 },
      { name: "level", defaultValue: 1, minValue: 0, maxValue: 2 },

      { name: "bass", defaultValue: 0, minValue: -1, maxValue: 1 },
      { name: "mid", defaultValue: 0, minValue: -1, maxValue: 1 },
      { name: "midFreq", defaultValue: 1000, minValue: 200, maxValue: 5000 },
      { name: "treble", defaultValue: 0, minValue: -1, maxValue: 1 },
    ]
  }

  constructor() {
    super()

    this._hp = []
    this._lp = []
    this._eq = []
    this._initialized = false
  }

  _init(channelCount) {
    while (this._hp.length < channelCount) {
      this._hp.push({ x1: 0, y1: 0 })
      this._lp.push({ y1: 0 })
      this._eq.push({
        bass: { y1: 0 },
        treble: { y1: 0 },
        mid: { x1: 0, x2: 0, y1: 0, y2: 0 },
      })
    }
    this._initialized = true
  }

  // asymmetrical clipping (stage 1)
  _clipAsym(x) {
    if (x > 0) return Math.tanh(x * 1.5)
    return Math.tanh(x * 0.7)
  }

  // symmetrical clipping (stage 2)
  _clipSym(x) {
    return Math.tanh(x)
  }

  // simple HPF (~50Hz)
  _hpf(ch, x) {
    const c = this._hp[ch]
    const rc = 1 / (2 * Math.PI * 50)
    const dt = 1 / sampleRate
    const alpha = rc / (rc + dt)
    const y = alpha * (c.y1 + x - c.x1)
    c.x1 = x
    c.y1 = y
    return y
  }

  // simple LPF (~7kHz)
  _lpf(ch, x) {
    const c = this._lp[ch]
    const fc = 7000
    const dt = 1 / sampleRate
    const rc = 1 / (2 * Math.PI * fc)
    const alpha = dt / (rc + dt)
    c.y1 += alpha * (x - c.y1)
    return c.y1
  }

  // biquad band EQ (mid parametric)
  _midEQ(ch, x, freq, gain) {
    const c = this._eq[ch].mid
    const Q = 1.2
    const A = 10 ** (gain * 1.5)

    const w0 = (2 * Math.PI * freq) / sampleRate
    const alpha = Math.sin(w0) / (2 * Q)

    const b0 = 1 + alpha * A
    const b1 = -2 * Math.cos(w0)
    const b2 = 1 - alpha * A
    const a0 = 1 + alpha / A
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha / A

    const y =
      (b0 / a0) * x +
      (b1 / a0) * c.x1 +
      (b2 / a0) * c.x2 -
      (a1 / a0) * c.y1 -
      (a2 / a0) * c.y2

    c.x2 = c.x1
    c.x1 = x
    c.y2 = c.y1
    c.y1 = y

    return y
  }

  // shelving EQ (bass / treble)
  _shelf(ch, x, type, gain) {
    const c = this._eq[ch][type]
    const fc = type === "bass" ? 90 : 5500
    const g = 10 ** (gain * 1.2)

    const rc = 1 / (2 * Math.PI * fc)
    const dt = 1 / sampleRate
    const alpha = dt / (rc + dt)

    c.y1 += alpha * (x - c.y1)
    return type === "bass" ? x + (x - c.y1) * (g - 1) : c.y1 * g
  }

  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const channelCount = Math.max(2, output.length)
    if (!this._initialized) this._init(channelCount)

    const gain = parameters.gain[0]
    const level = parameters.level[0]
    const bass = parameters.bass[0]
    const mid = parameters.mid[0]
    const midFreq = parameters.midFreq[0]
    const treble = parameters.treble[0]

    for (let ch = 0; ch < channelCount; ch++) {
      const inData = input[ch] || input[0]
      const outData = output[ch]

      for (let i = 0; i < inData.length; i++) {
        let x = inData[i]

        // input buffer + gain
        x *= gain

        // stage 1 (asym clipping)
        x = this._clipAsym(x)

        // stage 2 (sym clipping)
        x = this._clipSym(x * 2.2)

        // HPF / LPF
        x = this._hpf(ch, x)
        x = this._lpf(ch, x)

        // EQ post distortion
        x = this._shelf(ch, x, "bass", bass)
        x = this._midEQ(ch, x, midFreq, mid)
        x = this._shelf(ch, x, "treble", treble)

        // output level
        outData[i] = x * level
      }
    }

    return this.running
  }
}

AudioProcessor.define(NAME, MetalZoneProcessor)
