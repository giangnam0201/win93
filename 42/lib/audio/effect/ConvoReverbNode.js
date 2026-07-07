import { clamp } from "../../type/number/math.js"

export class ConvoReverbNode extends GainNode {
  constructor(audioContext, options) {
    super(audioContext)
    this.convo = this.context.createConvolver()
    this.wetGain = this.context.createGain()
    this.dryGain = this.context.createGain()
    this.wetGain.gain.value = 0
    this.dryGain.gain.value = 1

    this.output = this.context.createGain()

    super.connect(this.dryGain)
    this.dryGain.connect(this.output)

    super.connect(this.convo)
    this.convo.connect(this.wetGain)
    this.wetGain.connect(this.output)

    this.convo.buffer = options?.impulse ?? this.generateImpulseResponse()
  }

  connect(...args) {
    // @ts-ignore
    return this.output.connect(...args)
  }
  disconnect(...args) {
    // @ts-ignore
    this.output.disconnect(...args)
  }

  generateImpulseResponse() {
    const { sampleRate } = this.context
    const length = sampleRate * 2
    const impulse = this.context.createBuffer(2, length, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
      }
    }

    return impulse
  }

  update(value, duration = 0.25) {
    value = clamp(value, 0, 1)
    const now = this.context.currentTime
    const endTime = now + duration

    let wet
    let dry

    if (value <= 0.5) {
      wet = value
      dry = 1
    } else {
      wet = value
      dry = 1 - (value - 0.5) * 2
    }

    this.wetGain.gain.cancelScheduledValues(now)
    this.dryGain.gain.cancelScheduledValues(now)

    this.wetGain.gain.linearRampToValueAtTime(wet, endTime)
    this.dryGain.gain.linearRampToValueAtTime(dry, endTime)
  }
}
