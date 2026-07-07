import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { ChorusNode } from "../../../../../42/lib/audio/effect/ChorusNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await ChorusNode.load(mixer.context)
  const node = new ChorusNode(mixer.context)
  app.audioPipe = node

  return {
    tag: "fieldset.grid-2.pa-xs.gap-xxs",
    content: [
      {
        tag: "ui-knob",
        medium: true,
        label: "Speed",
        min: 0.05,
        max: 5,
        step: 0.01,
        bind: node.rate,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Width",
        min: 0.0005,
        max: 0.01,
        step: 0.0001,
        bind: node.depth,
      },
      /*
      {
        tag: "ui-knob",
        large: true,
        label: "Delay",
        min: 0.002,
        max: 0.03,
        step: 0.0001,
        bind: node.delay,
      },
      {
        tag: "ui-knob",
        large: true,
        label: "Mix",
        min: 0,
        max: 1,
        step: 0.01,
        bind: node.mix,
      },
      */
    ],
  }
}
