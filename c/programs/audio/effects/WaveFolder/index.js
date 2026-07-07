import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { WavefolderNode } from "../../../../../42/lib/audio/effect/WavefolderNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await WavefolderNode.load(mixer.context)
  const wavefolder = new WavefolderNode(mixer.context)
  app.audioPipe = wavefolder

  return {
    tag: "fieldset.cols.pa-y-xs.gap-xxs",
    content: [
      {
        tag: "ui-knob",
        medium: true,
        label: "Drive",
        min: 0.5,
        max: 10,
        scale: "log",
        bind: wavefolder.drive,
      },
      {
        tag: "ui-knob",
        large: true,
        label: "Fold",
        min: 0.1,
        max: 5,
        bind: wavefolder.fold,
      },
      {
        tag: "ui-knob",
        // medium: true,
        label: "Mix",
        min: 0,
        max: 1,
        bind: wavefolder.mix,
      },
    ],
  }
}
