import { AudioProcessorNode } from "../AudioProcessorNode.js"

/* MARK: Node
------------- */

export class LimiterNode extends AudioProcessorNode {
  static module = import.meta.resolve(
    "./Limiter/LimiterProcessor.js", //
  )

  constructor(context, parameterData) {
    super(context, "limiter", {
      channelCount: 2,
      outputChannelCount: [2],
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCountMode: "explicit",
      parameterData,
    })
    // this.setParameters()
  }
}
