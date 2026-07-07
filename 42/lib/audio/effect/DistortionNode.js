// import { clamp } from "../../type/number/math.js"

import { curves } from "../algo/distortionCurves.js"

export class DistortionNode extends GainNode {
  constructor(audioContext) {
    super(audioContext)

    this.drive = this
    this.output = new GainNode(this.context)
    this.shape = new WaveShaperNode(this.context, {
      // curve: curves.hiGainModern(2),
      // curve: curves.fuzz(2000),
      // curve: curves.superFuzz(20_000),
      // curve: curves.vertical(150),
      // curve: curves.bezier(),
      // curve: curves.asymetric(150),
      curve: curves.standard(100),
    })
    this.shapeGain = new GainNode(this.context)
    this.shapeGain.gain.value = 1

    this.low = new BiquadFilterNode(this.context, {
      type: "lowpass",
      frequency: 22_050,
    })

    super
      .connect(this.shape)
      .connect(this.shapeGain)
      // .connect(this.low)
      .connect(this.output)

    // super.connect(this.output)
  }

  connect(...args) {
    // @ts-ignore
    return this.output.connect(...args)
  }
  disconnect(...args) {
    // @ts-ignore
    this.output.disconnect(...args)
  }

  // update(value, duration = 0) {
  //   value = clamp(value, 0, 1)
  // }
}
