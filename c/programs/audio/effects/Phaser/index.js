import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { PhasorNode } from "../../../../../42/lib/audio/effect/PhaserNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await PhasorNode.load(mixer.context)
  const node = new PhasorNode(mixer.context)
  app.audioPipe = node

  return {
    tag: "fieldset.grid-2.gap",
    content: [
      {
        tag: "ui-knob",
        large: true,
        label: "Speed",
        min: 0.05,
        max: 8,
        step: 0.01,
        bind: node.speed,
      },
      {
        tag: "ui-knob",
        large: true,
        label: "Regen",
        min: 0,
        max: 0.85,
        step: 0.01,
        bind: node.regen,
      },
    ],
  }
}
