import { clamp, scale } from "../../type/number/math.js"

export class _ThreeBandEqualizerNode extends GainNode {
  constructor(audioContext, options) {
    super(audioContext)

    const from = 320
    const to = 3200

    const geometricMean = Math.sqrt(from * to) // https://stackoverflow.com/a/33541780/1289275

    this.low = new BiquadFilterNode(this.context, {
      type: "lowshelf",
      frequency: from,
      gain: options?.low ?? 0,
    })
    this.mid = new BiquadFilterNode(this.context, {
      type: "peaking",
      frequency: geometricMean,
      Q: geometricMean / (to - from),
      gain: options?.mid ?? 0,
    })
    this.high = new BiquadFilterNode(this.context, {
      type: "highshelf",
      frequency: to,
      gain: options?.high ?? 0,
    })

    super //
      .connect(this.high)
      .connect(this.mid)
      .connect(this.low)
  }

  connect(...args) {
    // @ts-ignore
    return this.low.connect(...args)
  }
  disconnect(...args) {
    // @ts-ignore
    this.low.disconnect(...args)
  }

  update({ low, mid, high }, duration = 0) {
    const now = this.context.currentTime
    const endTime = now + duration

    const min = -12
    const max = 12

    if (low !== undefined) {
      this.low.gain.cancelScheduledValues(now)
      const val = scale(low, 0, 1, min, max)
      this.low.gain.linearRampToValueAtTime(val, endTime)
    }

    if (mid !== undefined) {
      this.mid.gain.cancelScheduledValues(now)
      const val = scale(mid, 0, 1, min, max)
      this.mid.gain.linearRampToValueAtTime(val, endTime)
    }

    if (high !== undefined) {
      this.high.gain.cancelScheduledValues(now)
      const val = scale(high, 0, 1, min, max)
      this.high.gain.linearRampToValueAtTime(val, endTime)
    }
  }
}

export class ThreeBandEqualizerNode extends GainNode {
  constructor(audioContext, options) {
    super(audioContext)

    this.lowFilter = new BiquadFilterNode(this.context, {
      type: "lowpass",
      frequency: 300,
    })
    this.midFilter = new BiquadFilterNode(this.context, {
      type: "bandpass",
      frequency: 1300,
    })
    this.highFilter = new BiquadFilterNode(this.context, {
      type: "highpass",
      frequency: 2600,
    })

    this.output = this.context.createGain()

    this.lowGain = this.context.createGain()
    this.midGain = this.context.createGain()
    this.highGain = this.context.createGain()
    this.lowGain.gain.value = options?.bass ?? 0.5
    this.midGain.gain.value = options?.mid ?? 0.5
    this.highGain.gain.value = options?.high ?? 0.5

    super.connect(this.lowFilter)
    super.connect(this.midFilter)
    super.connect(this.highFilter)
    this.lowFilter.connect(this.lowGain)
    this.midFilter.connect(this.midGain)
    this.highFilter.connect(this.highGain)
    this.lowGain.connect(this.output)
    this.midGain.connect(this.output)
    this.highGain.connect(this.output)
  }

  connect(...args) {
    // @ts-ignore
    return this.output.connect(...args)
  }
  disconnect(...args) {
    // @ts-ignore
    this.output.disconnect(...args)
  }

  update({ low, mid, high }, duration = 0) {
    const now = this.context.currentTime
    const endTime = now + duration

    if (low !== undefined) {
      this.lowGain.gain.cancelScheduledValues(now)
      this.lowGain.gain.linearRampToValueAtTime(clamp(low, 0, 1), endTime)
    }

    if (mid !== undefined) {
      this.midGain.gain.cancelScheduledValues(now)
      this.midGain.gain.linearRampToValueAtTime(clamp(mid, 0, 1), endTime)
    }

    if (high !== undefined) {
      this.highGain.gain.cancelScheduledValues(now)
      this.highGain.gain.linearRampToValueAtTime(clamp(high, 0, 1), endTime)
    }
  }
}
