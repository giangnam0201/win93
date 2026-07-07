/* eslint-disable max-depth */
/* eslint-disable complexity */
import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "tape-simulator"
const TWO_PI = Math.PI * 2
const HALF_PI = Math.PI / 2

/* MARK: Node
------------- */

export class TapeSimulatorNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ input
  /** @type {AudioParam} */ tilt
  /** @type {AudioParam} */ shape
  /** @type {AudioParam} */ flutterDepth
  /** @type {AudioParam} */ flutterSpeed
  /** @type {AudioParam} */ bias
  /** @type {AudioParam} */ headBump
  /** @type {AudioParam} */ headFreq
  /** @type {AudioParam} */ output
  /** @type {AudioParam} */ mix

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

/* MARK: Processor
------------------ */

class TapeSimulatorProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "input", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "tilt", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "shape", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "flutterDepth", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "flutterSpeed", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "bias", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "headBump", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "headFreq", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "output", defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1 },
    ]
  }

  constructor(options) {
    super(options)

    // Dubly encode/decode state
    this.iirEncL = 0
    this.iirEncR = 0
    this.compEncL = 1
    this.compEncR = 1
    this.avgEncL = 0
    this.avgEncR = 0
    this.iirDecL = 0
    this.iirDecR = 0
    this.compDecL = 1
    this.compDecR = 1
    this.avgDecL = 0
    this.avgDecR = 0

    // Flutter delay buffer
    this.delayBuffer = new Float32Array(2002) // L+R interleaved
    this.sweepL = Math.PI
    this.sweepR = Math.PI
    this.nextmaxL = 0.5
    this.nextmaxR = 0.5
    this.gcount = 0

    // Bias slew state (9 stereo stages)
    this.gslew = new Float32Array(27) // 9 stages * 3 (L, R, threshold)

    // Mid roller / low cutoff
    this.iirMidRollerL = 0
    this.iirMidRollerR = 0
    this.iirLowCutoffL = 0
    this.iirLowCutoffR = 0

    // Head bump
    this.headBumpL = 0
    this.headBumpR = 0
    this.hdbA = new Float32Array(12) // biquad A state
    this.hdbB = new Float32Array(12) // biquad B state

    // Soft clipper state
    this.lastSampleL = 0
    this.lastSampleR = 0
    this.wasPosClipL = false
    this.wasNegClipL = false
    this.wasPosClipR = false
    this.wasNegClipR = false
    this.intermediateL = new Float32Array(17)
    this.intermediateR = new Float32Array(17)

    // Random state (xorshift)
    this.fpdL = 17
    this.fpdR = 17

    this.sampleRate = sampleRate
  }

  xorshift(state) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} params
   */
  process([input], [output], params) {
    if (!input || input.length === 0) return this.running

    const overallscale = this.sampleRate / 44_100
    // const spacing = Math.min(16, Math.max(1, Math.floor(overallscale)))

    const inputL = input[0]
    const inputR = input[1] ?? input[0]
    const outputL = output[0]
    const outputR = output[1] ?? output[0]

    for (let i = 0; i < 128; i++) {
      // Get parameters (handle k-rate vs a-rate)
      const inputGain =
        ((params.input.length > 1 ? params.input[i] : params.input[0]) * 2) ** 2
      const tilt = params.tilt.length > 1 ? params.tilt[i] : params.tilt[0]
      const shape = params.shape.length > 1 ? params.shape[i] : params.shape[0]
      const flutterParam =
        params.flutterDepth.length > 1
          ? params.flutterDepth[i]
          : params.flutterDepth[0]
      const flutterSpeedParam =
        params.flutterSpeed.length > 1
          ? params.flutterSpeed[i]
          : params.flutterSpeed[0]
      const biasParam = params.bias.length > 1 ? params.bias[i] : params.bias[0]
      const headBumpParam =
        params.headBump.length > 1 ? params.headBump[i] : params.headBump[0]
      const headFreqParam =
        params.headFreq.length > 1 ? params.headFreq[i] : params.headFreq[0]
      const outputGain =
        (params.output.length > 1 ? params.output[i] : params.output[0]) * 2
      const mix = params.mix.length > 1 ? params.mix[i] : params.mix[0]

      // Derived parameters
      const dublyAmount = tilt * 2
      let outlyAmount = (1 - tilt) * -2
      if (outlyAmount < -1) outlyAmount = -1

      const iirEncFreq = (1 - shape) / overallscale
      const iirDecFreq = shape / overallscale
      const iirMidFreq = (shape * 0.618 + 0.382) / overallscale

      let flutDepth = flutterParam ** 6 * overallscale * 50
      if (flutDepth > 498) flutDepth = 498
      const flutFrequency = (0.02 * flutterSpeedParam ** 3) / overallscale

      const bias = biasParam * 2 - 1
      let underBias = (bias ** 4 * 0.25) / overallscale
      let overBias = (1 - bias) ** 3 / overallscale
      if (bias > 0) underBias = 0
      if (bias < 0) overBias = 1 / overallscale

      // Setup bias thresholds (golden ratio scaling)
      const phi = 1.618_033_988_749_895
      let ob = overBias
      for (let x = 8; x >= 0; x--) {
        this.gslew[x * 3 + 2] = ob
        ob *= phi
      }

      const headBumpDrive = (headBumpParam * 0.1) / overallscale
      const headBumpMix = headBumpParam * 0.5
      const subCurve = Math.sin(headBumpParam * Math.PI)
      const iirSubFreq = (subCurve * 0.008) / overallscale

      // Head bump biquad coefficients
      const hdbFreqA =
        (headFreqParam * headFreqParam * 175 + 25) / this.sampleRate
      const hdbFreqB = hdbFreqA * 0.9375
      const hdbReso = 0.618_033_988_749_895

      // Store dry sample
      const dryL = inputL[i]
      const dryR = inputR[i]

      let sampleL = dryL
      let sampleR = dryR

      // Input gain
      if (inputGain !== 1) {
        sampleL *= inputGain
        sampleR *= inputGain
      }

      // Dubly encode L
      this.iirEncL = this.iirEncL * (1 - iirEncFreq) + sampleL * iirEncFreq
      let highPart = (sampleL - this.iirEncL) * 2.848
      highPart += this.avgEncL
      this.avgEncL = (sampleL - this.iirEncL) * 1.152
      highPart = Math.max(-1, Math.min(1, highPart))
      let dubly = Math.abs(highPart)
      if (dubly > 0) {
        const adjust = Math.log(1 + 255 * dubly) / 2.408_239_965_31
        if (adjust > 0) dubly /= adjust
        this.compEncL = this.compEncL * (1 - iirEncFreq) + dubly * iirEncFreq
        sampleL += highPart * this.compEncL * dublyAmount
      }

      // Dubly encode R
      this.iirEncR = this.iirEncR * (1 - iirEncFreq) + sampleR * iirEncFreq
      highPart = (sampleR - this.iirEncR) * 2.848
      highPart += this.avgEncR
      this.avgEncR = (sampleR - this.iirEncR) * 1.152
      highPart = Math.max(-1, Math.min(1, highPart))
      dubly = Math.abs(highPart)
      if (dubly > 0) {
        const adjust = Math.log(1 + 255 * dubly) / 2.408_239_965_31
        if (adjust > 0) dubly /= adjust
        this.compEncR = this.compEncR * (1 - iirEncFreq) + dubly * iirEncFreq
        sampleR += highPart * this.compEncR * dublyAmount
      }

      // Flutter
      if (flutDepth > 0) {
        if (this.gcount < 0 || this.gcount > 999) this.gcount = 999
        this.delayBuffer[this.gcount * 2] = sampleL
        this.delayBuffer[this.gcount * 2 + 1] = sampleR

        let count = this.gcount
        let offset = flutDepth + flutDepth * Math.sin(this.sweepL)
        this.sweepL += this.nextmaxL * flutFrequency
        if (this.sweepL > TWO_PI) {
          this.sweepL -= TWO_PI
          const flutA = 0.24 + (this.fpdL / 0xff_ff_ff_ff) * 0.74
          this.fpdL = this.xorshift(this.fpdL)
          const flutB = 0.24 + (this.fpdL / 0xff_ff_ff_ff) * 0.74
          this.nextmaxL =
            Math.abs(flutA - Math.sin(this.sweepR + this.nextmaxR)) <
            Math.abs(flutB - Math.sin(this.sweepR + this.nextmaxR))
              ? flutA
              : flutB
        }
        count += Math.floor(offset)
        const idx0 = ((count % 1000) + 1000) % 1000
        const idx1 = (((count + 1) % 1000) + 1000) % 1000
        const frac = offset - Math.floor(offset)
        sampleL =
          this.delayBuffer[idx0 * 2] * (1 - frac) +
          this.delayBuffer[idx1 * 2] * frac

        count = this.gcount
        offset = flutDepth + flutDepth * Math.sin(this.sweepR)
        this.sweepR += this.nextmaxR * flutFrequency
        if (this.sweepR > TWO_PI) {
          this.sweepR -= TWO_PI
          const flutA = 0.24 + (this.fpdR / 0xff_ff_ff_ff) * 0.74
          this.fpdR = this.xorshift(this.fpdR)
          const flutB = 0.24 + (this.fpdR / 0xff_ff_ff_ff) * 0.74
          this.nextmaxR =
            Math.abs(flutA - Math.sin(this.sweepL + this.nextmaxL)) <
            Math.abs(flutB - Math.sin(this.sweepL + this.nextmaxL))
              ? flutA
              : flutB
        }
        count += Math.floor(offset)
        const idx0R = ((count % 1000) + 1000) % 1000
        const idx1R = (((count + 1) % 1000) + 1000) % 1000
        const fracR = offset - Math.floor(offset)
        sampleR =
          this.delayBuffer[idx0R * 2 + 1] * (1 - fracR) +
          this.delayBuffer[idx1R * 2 + 1] * fracR

        this.gcount--
      }

      // Bias routine
      if (Math.abs(bias) > 0.001) {
        for (let x = 0; x < 27; x += 3) {
          if (underBias > 0) {
            const stuckL = Math.abs(sampleL - this.gslew[x] / 0.975) / underBias
            if (stuckL < 1) {
              sampleL =
                sampleL * stuckL + (this.gslew[x] / 0.975) * (1 - stuckL)
            }
            const stuckR =
              Math.abs(sampleR - this.gslew[x + 1] / 0.975) / underBias
            if (stuckR < 1) {
              sampleR =
                sampleR * stuckR + (this.gslew[x + 1] / 0.975) * (1 - stuckR)
            }
          }
          if (sampleL - this.gslew[x] > this.gslew[x + 2]) {
            sampleL = this.gslew[x] + this.gslew[x + 2]
          }
          if (-(sampleL - this.gslew[x]) > this.gslew[x + 2]) {
            sampleL = this.gslew[x] - this.gslew[x + 2]
          }
          this.gslew[x] = sampleL * 0.975
          if (sampleR - this.gslew[x + 1] > this.gslew[x + 2]) {
            sampleR = this.gslew[x + 1] + this.gslew[x + 2]
          }
          if (-(sampleR - this.gslew[x + 1]) > this.gslew[x + 2]) {
            sampleR = this.gslew[x + 1] - this.gslew[x + 2]
          }
          this.gslew[x + 1] = sampleR * 0.975
        }
      }

      // ToTape basic algorithm - mid/high split and saturation
      this.iirMidRollerL =
        this.iirMidRollerL * (1 - iirMidFreq) + sampleL * iirMidFreq
      let highsSampleL = sampleL - this.iirMidRollerL
      let lowsSampleL = this.iirMidRollerL

      this.iirMidRollerR =
        this.iirMidRollerR * (1 - iirMidFreq) + sampleR * iirMidFreq
      let highsSampleR = sampleR - this.iirMidRollerR
      let lowsSampleR = this.iirMidRollerR

      // Sub-bass cutoff
      if (iirSubFreq > 0) {
        this.iirLowCutoffL =
          this.iirLowCutoffL * (1 - iirSubFreq) + lowsSampleL * iirSubFreq
        lowsSampleL -= this.iirLowCutoffL
        this.iirLowCutoffR =
          this.iirLowCutoffR * (1 - iirSubFreq) + lowsSampleR * iirSubFreq
        lowsSampleR -= this.iirLowCutoffR
      }

      // Soft clip lows (sine saturation)
      lowsSampleL = Math.max(-HALF_PI, Math.min(HALF_PI, lowsSampleL))
      lowsSampleL = Math.sin(lowsSampleL)
      lowsSampleR = Math.max(-HALF_PI, Math.min(HALF_PI, lowsSampleR))
      lowsSampleR = Math.sin(lowsSampleR)

      // Highs thinning (cosine saturation)
      let thinnedHighL = Math.abs(highsSampleL) * HALF_PI
      thinnedHighL = Math.min(HALF_PI, thinnedHighL)
      thinnedHighL = 1 - Math.cos(thinnedHighL)
      if (highsSampleL < 0) thinnedHighL = -thinnedHighL
      highsSampleL -= thinnedHighL

      let thinnedHighR = Math.abs(highsSampleR) * HALF_PI
      thinnedHighR = Math.min(HALF_PI, thinnedHighR)
      thinnedHighR = 1 - Math.cos(thinnedHighR)
      if (highsSampleR < 0) thinnedHighR = -thinnedHighR
      highsSampleR -= thinnedHighR

      // Head bump
      let headBumpSampleL = 0
      let headBumpSampleR = 0
      if (headBumpMix > 0) {
        this.headBumpL += lowsSampleL * headBumpDrive
        this.headBumpL -=
          this.headBumpL *
          this.headBumpL *
          this.headBumpL *
          (0.0618 / Math.sqrt(overallscale))
        this.headBumpR += lowsSampleR * headBumpDrive
        this.headBumpR -=
          this.headBumpR *
          this.headBumpR *
          this.headBumpR *
          (0.0618 / Math.sqrt(overallscale))

        // Biquad bandpass filter A
        const K_A = Math.tan(Math.PI * hdbFreqA)
        const normA = 1 / (1 + K_A / hdbReso + K_A * K_A)
        const a0A = (K_A / hdbReso) * normA
        const a2A = -a0A
        const b1A = 2 * (K_A * K_A - 1) * normA
        const b2A = (1 - K_A / hdbReso + K_A * K_A) * normA

        const headBiqL = this.headBumpL * a0A + this.hdbA[0]
        this.hdbA[0] = this.headBumpL * 0 - headBiqL * b1A + this.hdbA[1]
        this.hdbA[1] = this.headBumpL * a2A - headBiqL * b2A

        const headBiqR = this.headBumpR * a0A + this.hdbA[2]
        this.hdbA[2] = this.headBumpR * 0 - headBiqR * b1A + this.hdbA[3]
        this.hdbA[3] = this.headBumpR * a2A - headBiqR * b2A

        // Biquad bandpass filter B
        const K_B = Math.tan(Math.PI * hdbFreqB)
        const normB = 1 / (1 + K_B / hdbReso + K_B * K_B)
        const a0B = (K_B / hdbReso) * normB
        const a2B = -a0B
        const b1B = 2 * (K_B * K_B - 1) * normB
        const b2B = (1 - K_B / hdbReso + K_B * K_B) * normB

        headBumpSampleL = headBiqL * a0B + this.hdbB[0]
        this.hdbB[0] = headBiqL * 0 - headBumpSampleL * b1B + this.hdbB[1]
        this.hdbB[1] = headBiqL * a2B - headBumpSampleL * b2B

        headBumpSampleR = headBiqR * a0B + this.hdbB[2]
        this.hdbB[2] = headBiqR * 0 - headBumpSampleR * b1B + this.hdbB[3]
        this.hdbB[3] = headBiqR * a2B - headBumpSampleR * b2B
      }

      sampleL = lowsSampleL + highsSampleL + headBumpSampleL * headBumpMix
      sampleR = lowsSampleR + highsSampleR + headBumpSampleR * headBumpMix

      // Dubly decode L
      this.iirDecL = this.iirDecL * (1 - iirDecFreq) + sampleL * iirDecFreq
      highPart = (sampleL - this.iirDecL) * 2.628
      highPart += this.avgDecL
      this.avgDecL = (sampleL - this.iirDecL) * 1.372
      highPart = Math.max(-1, Math.min(1, highPart))
      dubly = Math.abs(highPart)
      if (dubly > 0) {
        const adjust = Math.log(1 + 255 * dubly) / 2.408_239_965_31
        if (adjust > 0) dubly /= adjust
        this.compDecL = this.compDecL * (1 - iirDecFreq) + dubly * iirDecFreq
        sampleL += highPart * this.compDecL * outlyAmount
      }

      // Dubly decode R
      this.iirDecR = this.iirDecR * (1 - iirDecFreq) + sampleR * iirDecFreq
      highPart = (sampleR - this.iirDecR) * 2.628
      highPart += this.avgDecR
      this.avgDecR = (sampleR - this.iirDecR) * 1.372
      highPart = Math.max(-1, Math.min(1, highPart))
      dubly = Math.abs(highPart)
      if (dubly > 0) {
        const adjust = Math.log(1 + 255 * dubly) / 2.408_239_965_31
        if (adjust > 0) dubly /= adjust
        this.compDecR = this.compDecR * (1 - iirDecFreq) + dubly * iirDecFreq
        sampleR += highPart * this.compDecR * outlyAmount
      }

      // Output gain
      if (outputGain !== 1) {
        sampleL *= outputGain
        sampleR *= outputGain
      }

      // Soft clipper (simplified ClipOnly2)
      sampleL = Math.max(-0.954_992_585_9, Math.min(0.954_992_585_9, sampleL))
      sampleR = Math.max(-0.954_992_585_9, Math.min(0.954_992_585_9, sampleR))

      // Dry/wet mix
      sampleL = dryL * (1 - mix) + sampleL * mix
      sampleR = dryR * (1 - mix) + sampleR * mix

      outputL[i] = sampleL
      outputR[i] = sampleR
    }

    return this.running
  }
}

AudioProcessor.define(NAME, TapeSimulatorProcessor)
