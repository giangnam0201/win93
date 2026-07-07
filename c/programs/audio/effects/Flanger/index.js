import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { FlangerNode } from "../../../../../42/lib/audio/effect/FlangerNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await FlangerNode.load(mixer.context)
  const node = new FlangerNode(mixer.context)
  app.audioPipe = node

  return {
    tag: "fieldset.grid-2.pa-xs.gap-xs",
    content: [
      {
        tag: "ui-knob",
        medium: true,
        label: "Manual",
        min: 0.0002,
        max: 0.01,
        step: 0.0001,
        bind: node.manual,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Depth",
        min: 0,
        max: 0.008,
        step: 0.0001,
        bind: node.depth,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Feedback",
        min: -0.9,
        max: 0.9,
        step: 0.01,
        bind: node.feedback,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Speed",
        min: 0.01,
        max: 5,
        step: 0.01,
        bind: node.speed,
      },
    ],
  }
}
