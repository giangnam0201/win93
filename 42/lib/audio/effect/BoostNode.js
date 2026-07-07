import { clamp } from "../../type/number/math.js"

export class BoostNode extends GainNode {
  constructor(audioContext) {
    super(audioContext)

    this.output = new GainNode(this.context)
    this.saturation = new WaveShaperNode(this.context)
    this.saturationGain = new GainNode(this.context, { gain: 0 })
    this.bassBoost = new BiquadFilterNode(this.context, {
      type: "lowshelf",
      frequency: 200,
      gain: 0,
    })

    super
      .connect(this.saturation)
      .connect(this.saturationGain)
      .connect(this.bassBoost)
      .connect(this.output)

    super.connect(this.output)

    this.generateSaturationCurve()
  }

  connect(...args) {
    // @ts-ignore
    return this.output.connect(...args)
  }
  disconnect(...args) {
    // @ts-ignore
    this.output.disconnect(...args)
  }

  generateSaturationCurve() {
    const curve = new Float32Array(44_100)
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / curve.length - 1
      curve[i] = Math.tanh(x)
    }

    this.saturation.curve = curve
    this.saturation.oversample = "4x"
  }

  update(value, duration = 0) {
    value = clamp(value, 0, 1)
    const now = this.context.currentTime
    const endTime = now + duration

    this.gain.cancelScheduledValues(now)
    this.saturationGain.gain.cancelScheduledValues(now)
    this.bassBoost.gain.cancelScheduledValues(now)

    if (value === 0) {
      this.gain.linearRampToValueAtTime(1, endTime)
      this.saturationGain.gain.linearRampToValueAtTime(0, endTime)
      this.bassBoost.gain.linearRampToValueAtTime(0, endTime)
    } else {
      const dryGainValue = 1 - value * 0.5
      this.gain.linearRampToValueAtTime(dryGainValue, endTime)
      this.saturationGain.gain.linearRampToValueAtTime(value * 25, endTime)
      this.bassBoost.gain.linearRampToValueAtTime(value * 10, endTime)
    }
  }
}
