import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { DelayNode } from "../../../../../42/lib/audio/effect/DelayNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await DelayNode.load(mixer.context)
  const delay = new DelayNode(mixer.context)
  app.audioPipe = delay

  return {
    tag: "fieldset.cols.pa-sm.gap-xxs",
    content: [
      {
        tag: "ui-knob",
        large: true,
        label: "Time",
        min: 0,
        max: 1.5,
        scale: "linear",
        bind: delay.time,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Feedback",
        min: 0,
        max: 0.95,
        scale: "linear",
        bind: delay.feedback,
      },
      {
        tag: "ui-knob",
        // medium: true,
        label: "Mix",
        min: 0,
        max: 1,
        scale: "linear",
        bind: delay.mix,
      },
    ],
  }
}
