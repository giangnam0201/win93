/* eslint-disable no-multi-assign */
import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "reverb"

/* MARK: Node
------------- */

export class ReverbNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ preDelay
  /** @type {AudioParam} */ bandwidth
  /** @type {AudioParam} */ inputDiffusion1
  /** @type {AudioParam} */ inputDiffusion2
  /** @type {AudioParam} */ decay
  /** @type {AudioParam} */ decayDiffusion1
  /** @type {AudioParam} */ decayDiffusion2
  /** @type {AudioParam} */ damping
  /** @type {AudioParam} */ excursionRate
  /** @type {AudioParam} */ excursionDepth
  /** @type {AudioParam} */ wet
  /** @type {AudioParam} */ dry

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

/**
 * Dattorro's reverb implementation.
 *
 * @license CC0-1.0
 * @source https://github.com/khoin/DattorroReverbNode
 * @see https://ccrma.stanford.edu/~dattorro/EffectDesignPart1.pdf
 */
class ReverbProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      ["preDelay", 0, 0, sampleRate - 1],
      ["bandwidth", 0.9999, 0, 1],
      ["inputDiffusion1", 0.75, 0, 1],
      ["inputDiffusion2", 0.625, 0, 1],
      ["decay", 0.5, 0, 1],
      ["decayDiffusion1", 0.7, 0, 0.999_999],
      ["decayDiffusion2", 0.5, 0, 0.999_999],
      ["damping", 0.005, 0, 1],
      ["excursionRate", 0.5, 0, 2],
      ["excursionDepth", 0.7, 0, 2],
      ["wet", 0.5, 0, 1],
      ["dry", 1, 0, 1],
    ].map(([name, defaultValue, minValue, maxValue]) => ({
      name,
      defaultValue,
      minValue,
      maxValue,
      automationRate: "k-rate",
    }))
  }

  constructor(options) {
    super(options)

    this._Delays = []
    this._pDLength = sampleRate + (128 - (sampleRate % 128)) // Pre-delay is always one-second long, rounded to the nearest 128-chunk
    this._preDelay = new Float32Array(this._pDLength)
    this._pDWrite = 0
    this._lp1 = 0
    this._lp2 = 0
    this._lp3 = 0
    this._excPhase = 0

    for (const x of [
      0.004_771_345, 0.003_595_309, 0.012_734_787, 0.009_307_483, 0.022_579_886,
      0.149_625_349, 0.060_481_839, 0.124_995_8, 0.030_509_727, 0.141_695_508,
      0.089_244_313, 0.106_280_031,
    ]) {
      this.makeDelay(x)
    }

    this._taps = Int16Array.from(
      [
        0.008_937_872, 0.099_929_438, 0.064_278_754, 0.067_067_639,
        0.066_866_033, 0.006_283_391, 0.035_818_689, 0.011_861_161,
        0.121_870_905, 0.041_262_054, 0.089_815_53, 0.070_931_756,
        0.011_256_342, 0.004_065_724,
      ],
      (x) => Math.round(x * sampleRate),
    )
  }

  makeDelay(length) {
    // len, array, write, read, mask
    const len = Math.round(length * sampleRate)
    const nextPow2 = 2 ** Math.ceil(Math.log2(len))
    this._Delays.push([
      new Float32Array(nextPow2),
      len - 1,
      0 | 0,
      nextPow2 - 1,
    ])
  }

  writeDelay(index, data) {
    return (this._Delays[index][0][this._Delays[index][1]] = data)
  }

  readDelay(index) {
    return this._Delays[index][0][this._Delays[index][2]]
  }

  readDelayAt(index, i) {
    const d = this._Delays[index]
    return d[0][(d[2] + i) & d[3]]
  }

  // cubic interpolation
  // O. Niemitalo: https://www.musicdsp.org/en/latest/Other/49-cubic-interpollation.html
  readDelayCAt(index, i) {
    const d = this._Delays[index]
    const frac = i - ~~i
    let int = ~~i + d[2] - 1
    const mask = d[3]

    const x0 = d[0][int++ & mask]
    const x1 = d[0][int++ & mask]
    const x2 = d[0][int++ & mask]
    const x3 = d[0][int & mask]

    const a = (3 * (x1 - x2) - x0 + x3) / 2
    const b = 2 * x2 + x0 - (5 * x1 + x3) / 2
    const c = (x2 - x0) / 2

    return ((a * frac + b) * frac + c) * frac + x1
  }

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} params
   */
  process([input], [output], params) {
    const pd = ~~params.preDelay[0]
    const bw = params.bandwidth[0]
    const fi = params.inputDiffusion1[0]
    const si = params.inputDiffusion2[0]
    const dc = params.decay[0]
    const ft = params.decayDiffusion1[0]
    const st = params.decayDiffusion2[0]
    const dp = 1 - params.damping[0]
    const ex = params.excursionRate[0] / sampleRate
    const ed = (params.excursionDepth[0] * sampleRate) / 1000
    const we = params.wet[0] * 0.6 // lo & ro both mult. by 0.6 anyways
    const dr = params.dry[0]

    // write to predelay and dry output
    if (input.length === 2) {
      for (let i = 127; i >= 0; i--) {
        // First input will be downmixed to mono
        this._preDelay[this._pDWrite + i] = (input[0][i] + input[1][i]) * 0.5

        output[0][i] = input[0][i] * dr
        output[1][i] = input[1][i] * dr
      }
    } else if (input.length > 0) {
      this._preDelay.set(input[0], this._pDWrite)
      for (let i = 127; i >= 0; i--) {
        output[0][i] = output[1][i] = input[0][i] * dr
      }
    } else {
      this._preDelay.set(new Float32Array(128), this._pDWrite)
    }

    let i = 0
    while (i < 128) {
      let lo = 0
      let ro = 0

      this._lp1 +=
        bw *
        (this._preDelay[
          (this._pDLength + this._pDWrite - pd + i) % this._pDLength
        ] -
          this._lp1)

      // pre-tank
      let pre = this.writeDelay(0, this._lp1 - fi * this.readDelay(0))
      pre = this.writeDelay(
        1,
        fi * (pre - this.readDelay(1)) + this.readDelay(0),
      )
      pre = this.writeDelay(
        2,
        fi * pre + this.readDelay(1) - si * this.readDelay(2),
      )
      pre = this.writeDelay(
        3,
        si * (pre - this.readDelay(3)) + this.readDelay(2),
      )

      const split = si * pre + this.readDelay(3)

      // excursions
      // could be optimized?
      const exc = ed * (1 + Math.cos(this._excPhase * 6.28))
      const exc2 = ed * (1 + Math.sin(this._excPhase * 6.2847))

      // left loop
      let temp = this.writeDelay(
        4,
        split + dc * this.readDelay(11) + ft * this.readDelayCAt(4, exc),
      ) // tank diffuse 1
      this.writeDelay(5, this.readDelayCAt(4, exc) - ft * temp) // long delay 1
      this._lp2 += dp * (this.readDelay(5) - this._lp2) // damp 1
      temp = this.writeDelay(6, dc * this._lp2 - st * this.readDelay(6)) // tank diffuse 2
      this.writeDelay(7, this.readDelay(6) + st * temp) // long delay 2

      // right loop
      temp = this.writeDelay(
        8,
        split + dc * this.readDelay(7) + ft * this.readDelayCAt(8, exc2),
      ) // tank diffuse 3
      this.writeDelay(9, this.readDelayCAt(8, exc2) - ft * temp) // long delay 3
      this._lp3 += dp * (this.readDelay(9) - this._lp3) // damp 2
      temp = this.writeDelay(10, dc * this._lp3 - st * this.readDelay(10)) // tank diffuse 4
      this.writeDelay(11, this.readDelay(10) + st * temp) // long delay 4

      lo =
        this.readDelayAt(9, this._taps[0]) +
        this.readDelayAt(9, this._taps[1]) -
        this.readDelayAt(10, this._taps[2]) +
        this.readDelayAt(11, this._taps[3]) -
        this.readDelayAt(5, this._taps[4]) -
        this.readDelayAt(6, this._taps[5]) -
        this.readDelayAt(7, this._taps[6])

      ro =
        this.readDelayAt(5, this._taps[7]) +
        this.readDelayAt(5, this._taps[8]) -
        this.readDelayAt(6, this._taps[9]) +
        this.readDelayAt(7, this._taps[10]) -
        this.readDelayAt(9, this._taps[11]) -
        this.readDelayAt(10, this._taps[12]) -
        this.readDelayAt(11, this._taps[13])

      output[0][i] += lo * we
      output[1][i] += ro * we

      this._excPhase += ex

      i++

      for (
        let j = 0, d = this._Delays[0];
        j < this._Delays.length;
        d = this._Delays[++j]
      ) {
        d[1] = (d[1] + 1) & d[3]
        d[2] = (d[2] + 1) & d[3]
      }
    }

    // Update preDelay index
    this._pDWrite = (this._pDWrite + 128) % this._pDLength

    return this.running
  }
}

AudioProcessor.define(NAME, ReverbProcessor)
