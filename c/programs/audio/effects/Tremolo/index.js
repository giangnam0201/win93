// index.js
import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { TremoloNode } from "../../../../../42/lib/audio/effect/TremoloNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await TremoloNode.load(mixer.context)
  const tremolo = new TremoloNode(mixer.context)
  app.audioPipe = tremolo

  return {
    tag: "fieldset.cols.pa-sm.gap-xs",
    content: [
      {
        tag: "ui-knob",
        medium: true,
        label: "Rate",
        min: 0.1,
        max: 20,
        scale: "log",
        bind: tremolo.rate,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Depth",
        min: 0,
        max: 1,
        scale: "linear",
        bind: tremolo.depth,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Shape",
        min: 0,
        max: 4,
        step: 1,
        scale: "linear",
        bind: tremolo.shape,
      },
      {
        tag: "ui-knob",
        // medium: true,
        label: "Mix",
        min: 0,
        max: 1,
        scale: "linear",
        bind: tremolo.mix,
      },
    ],
  }
}
