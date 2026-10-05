import { MoogFilterNode } from "../../../../../42/lib/audio/effect/MoogFilterNode.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import "../../../../../42/ui/control/knob.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await MoogFilterNode.load(mixer.context)
  const filter = new MoogFilterNode(mixer.context)
  app.audioPipe = filter

  return {
    tag: "fieldset.cols.pa-sm.gap-xs",
    content: [
      {
        tag: "ui-knob",
        large: true,
        scale: "log",
        label: "Cutoff",
        bind: filter.cutoff,
      },
      {
        tag: "ui-knob",
        // large: true,
        // scale: "log",
        label: "Res",
        bind: filter.resonance,
      },
    ],
  }
}
