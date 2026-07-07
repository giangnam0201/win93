import { AudioProcessorNode } from "../AudioProcessorNode.js"

/* MARK: Node
------------- */

export class PaulStretchNode extends AudioProcessorNode {
  static module = import.meta.resolve(
    "./PaulStretch/PaulStretchProcessor.js", //
  )

  /** @type {AudioParam} */ ratio
  /** @type {AudioParam} */ windowSize

  constructor(context, options = {}) {
    const { channelCount, ...parameterData } = options

    super(context, "paul-stretch", {
      outputChannelCount: [channelCount ?? 2],
      parameterData,
    })
    this.setParameters()
  }
}
