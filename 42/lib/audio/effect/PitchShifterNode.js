/* eslint-disable max-depth */
/* eslint-disable complexity */

import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

const NAME = "pitchshifter"

export class PitchShifterNode extends AudioProcessorNode {
  static module = import.meta.url

  /** @type {AudioParam} */ pitch
  /** @type {AudioParam} */ mix

  constructor(context, parameterData) {
    super(context, NAME, { parameterData })
    this.setParameters()
  }
}

class PitchShifterProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "pitch", defaultValue: 1, minValue: 0.25, maxValue: 4 },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1 },
    ]
  }

  constructor(options) {
    super(options)

    this._fftSize = 1024
    this._osamp = 32
    this._maxFrame = 16_384

    this._inFIFO = []
    this._outFIFO = []
    this._fftWorksp = []
    this._lastPhase = []
    this._sumPhase = []
    this._outputAccum = []
    this._anaFreq = []
    this._anaMagn = []
    this._synFreq = []
    this._synMagn = []
    this._rover = []

    this._buffersInit = false
    this._currentPitch = 1
    this._firstFFTDone = false
  }

  _initBuffers(channelCount) {
    const n = this._maxFrame
    while (this._inFIFO.length < channelCount) {
      this._inFIFO.push(new Float32Array(n))
      this._outFIFO.push(new Float32Array(n))
      this._fftWorksp.push(new Float32Array(n * 2))
      this._lastPhase.push(new Float32Array(n / 2 + 1))
      this._sumPhase.push(new Float32Array(n / 2 + 1))
      this._outputAccum.push(new Float32Array(n * 2))
      this._anaFreq.push(new Float32Array(n))
      this._anaMagn.push(new Float32Array(n))
      this._synFreq.push(new Float32Array(n))
      this._synMagn.push(new Float32Array(n))
      this._rover.push(0)
    }
    this._buffersInit = true
  }

  process([input], [output], parameters) {
    if (input.length === 0) return this.running

    const channelCount = Math.max(2, output.length)
    if (!this._buffersInit) this._initBuffers(channelCount)

    const fftSize = this._fftSize
    const osamp = this._osamp
    const pitchShift =
      (parameters.pitch.length > 0
        ? parameters.pitch[0]
        : this._currentPitch) ?? 1
    const mix = parameters.mix[0] ?? 1

    this._currentPitch = pitchShift

    const stepSize = Math.floor(fftSize / osamp)
    const freqPerBin = sampleRate / fftSize
    const expct = (2 * Math.PI * stepSize) / fftSize
    const inFifoLatency = fftSize - stepSize
    const fftFrameSize2 = Math.floor(fftSize / 2)

    for (let ch = 0; ch < channelCount; ch++) {
      const inData = input[ch] || input[0]
      const outData = output[ch]

      const inFIFO = this._inFIFO[ch]
      const outFIFO = this._outFIFO[ch]
      const fftWorksp = this._fftWorksp[ch]
      const lastPhase = this._lastPhase[ch]
      const sumPhase = this._sumPhase[ch]
      const outputAccum = this._outputAccum[ch]
      const anaFreq = this._anaFreq[ch]
      const anaMagn = this._anaMagn[ch]
      const synFreq = this._synFreq[ch]
      const synMagn = this._synMagn[ch]

      let rover = this._rover[ch]

      for (let i = 0; i < inData.length; i++) {
        inFIFO[rover] = inData[i]

        // outFIFO ne sera utilisé que si le premier FFT a déjà été calculé
        const wet = this._firstFFTDone
          ? outFIFO[(rover - inFifoLatency + fftSize) % fftSize]
          : 0
        const dry = inData[i]
        outData[i] = dry * (1 - mix) + wet * mix

        rover++

        if (rover >= fftSize) {
          rover = inFifoLatency

          for (let k = 0; k < fftSize; k++) {
            const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / fftSize)
            fftWorksp[2 * k] = inFIFO[k] * w
            fftWorksp[2 * k + 1] = 0
          }

          this._fft(fftWorksp, fftSize, -1)

          // Initialiser lastPhase sur le premier FFT pour éviter le double signal
          if (!this._firstFFTDone) {
            for (let k = 0; k <= fftFrameSize2; k++) {
              lastPhase[k] = Math.atan2(fftWorksp[2 * k + 1], fftWorksp[2 * k])
            }
            this._firstFFTDone = true
          }

          for (let k = 0; k <= fftFrameSize2; k++) {
            const real = fftWorksp[2 * k]
            const imag = fftWorksp[2 * k + 1]
            const magn = 2 * Math.hypot(real, imag)
            const phase = Math.atan2(imag, real)

            let tmp = phase - lastPhase[k]
            lastPhase[k] = phase
            tmp -= k * expct

            let qpd = Math.trunc(tmp / Math.PI)
            if (qpd >= 0) qpd += qpd & 1
            else qpd -= qpd & 1
            tmp -= Math.PI * qpd

            tmp = (osamp * tmp) / (2 * Math.PI)
            tmp = k * freqPerBin + tmp * freqPerBin

            anaMagn[k] = magn
            anaFreq[k] = tmp
          }

          synMagn.fill(0)
          synFreq.fill(0)

          for (let k = 0; k <= fftFrameSize2; k++) {
            const index = Math.floor(k * pitchShift)
            if (index <= fftFrameSize2) {
              synMagn[index] += anaMagn[k]
              synFreq[index] = anaFreq[k] * pitchShift
            }
          }

          for (let k = 0; k <= fftFrameSize2; k++) {
            const magn = synMagn[k]
            let tmp = synFreq[k] - k * freqPerBin
            tmp /= freqPerBin
            tmp = (2 * Math.PI * tmp) / osamp + k * expct

            sumPhase[k] += tmp
            const phase = sumPhase[k]

            fftWorksp[2 * k] = magn * Math.cos(phase)
            fftWorksp[2 * k + 1] = magn * Math.sin(phase)
          }

          for (let k = fftSize + 2; k < 2 * fftSize; k++) fftWorksp[k] = 0

          this._fft(fftWorksp, fftSize, 1)

          for (let k = 0; k < fftSize; k++) {
            const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / fftSize)
            outputAccum[k] +=
              (2 * w * fftWorksp[2 * k]) / (fftFrameSize2 * osamp)
          }

          for (let k = 0; k < stepSize; k++) outFIFO[k] = outputAccum[k]

          for (let k = 0; k < fftSize; k++) {
            outputAccum[k] = outputAccum[k + stepSize]
          }
          for (let k = 0; k < inFifoLatency; k++) {
            inFIFO[k] = inFIFO[k + stepSize]
          }
        }
      }

      this._rover[ch] = rover
    }

    return this.running
  }

  _fft(buf, n, sign) {
    let j = 0
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tr = buf[2 * i]
        const ti = buf[2 * i + 1]
        buf[2 * i] = buf[2 * j]
        buf[2 * i + 1] = buf[2 * j + 1]
        buf[2 * j] = tr
        buf[2 * j + 1] = ti
      }
      let m = n >> 1
      while (m >= 1 && j >= m) {
        j -= m
        m >>= 1
      }
      j += m
    }

    let mmax = 1
    while (n > mmax) {
      const step = mmax << 1
      const theta = (sign * Math.PI) / mmax
      let wr = 1
      let wi = 0
      const wpr = Math.cos(theta)
      const wpi = Math.sin(theta)

      for (let m = 0; m < mmax; m++) {
        for (let i = m; i < n; i += step) {
          const j = i + mmax
          const tr = wr * buf[2 * j] - wi * buf[2 * j + 1]
          const ti = wr * buf[2 * j + 1] + wi * buf[2 * j]
          buf[2 * j] = buf[2 * i] - tr
          buf[2 * j + 1] = buf[2 * i + 1] - ti
          buf[2 * i] += tr
          buf[2 * i + 1] += ti
        }
        const wtemp = wr
        wr = wr * wpr - wi * wpi
        wi = wtemp * wpi + wi * wpr
      }
      mmax = step
    }
  }
}

AudioProcessor.define(NAME, PitchShifterProcessor)
