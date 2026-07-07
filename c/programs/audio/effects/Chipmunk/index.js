import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { PitchShifterNode } from "../../../../../42/lib/audio/effect/PitchShifterNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await PitchShifterNode.load(mixer.context)
  const node = new PitchShifterNode(mixer.context)
  app.audioPipe = node

  return {
    tag: "fieldset.cols.pa-sm.gap-xs",
    content: [
      {
        tag: "ui-knob",
        large: true,
        label: "Pitch",
        min: 0.5,
        max: 2,
        step: 0.01,
        scale: "linear",
        bind: node.pitch,
      },
      {
        tag: "ui-knob",
        // large: true,
        label: "Mix",
        min: 0,
        max: 1,
        // step: 0.01,
        scale: "linear",
        bind: node.mix,
      },
    ],
  }
}
