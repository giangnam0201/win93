import { logScale } from "../../type/number/math.js"

export class DJFilterNode extends BiquadFilterNode {
  constructor(audioContext) {
    super(audioContext, {
      type: "lowpass",
      frequency: 22_050,
    })

    this.low = this
    this.high = new BiquadFilterNode(this.context, {
      type: "highpass",
      frequency: 10,
    })

    super.connect(this.high)
  }

  connect(...args) {
    // @ts-ignore
    return this.high.connect(...args)
  }
  disconnect(...args) {
    // @ts-ignore
    this.high.disconnect(...args)
  }

  update(value, duration = 0) {
    const now = this.context.currentTime
    const endTime = now + duration

    const lowPassFreq = logScale(
      value, //
      0,
      0.5,
      10,
      22_050,
    )
    const highPassFreq = logScale(
      value - 0.5, //
      0,
      0.5,
      10,
      22_050,
    )

    this.low.frequency.cancelScheduledValues(now)
    this.high.frequency.cancelScheduledValues(now)

    this.low.frequency.linearRampToValueAtTime(lowPassFreq, endTime)
    this.high.frequency.linearRampToValueAtTime(highPassFreq, endTime)
  }
}
