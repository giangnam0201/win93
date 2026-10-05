import { PaulStretchNode } from "../../../../../42/lib/audio/effect/PaulStretchNode.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import "../../../../../42/ui/control/knob.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await PaulStretchNode.load(mixer.context)
  const paulStretch = new PaulStretchNode(mixer.context)
  app.audioPipe = paulStretch

  return {
    tag: "fieldset.grid-2.pa-xs.gap-xxs",
    content: [
      {
        tag: "ui-knob",
        large: true,
        label: "Ratio",
        bind: paulStretch.ratio,
      },
      {
        tag: "ui-knob",
        large: true,
        label: "Size",
        step: 1,
        bind: paulStretch.windowSize,
      },
    ],
  }
}
