// index.js
import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { GateNode } from "../../../../../42/lib/audio/effect/GateNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await GateNode.load(mixer.context)
  const gate = new GateNode(mixer.context)
  app.audioPipe = gate

  return {
    tag: "fieldset.grid-4.pa-xs.gap-xs",
    content: [
      {
        tag: "ui-knob",
        medium: true,
        label: "Threshold",
        min: -80,
        max: 0,
        scale: "linear",
        bind: gate.threshold,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Ratio",
        min: 1,
        max: 20,
        scale: "log",
        bind: gate.ratio,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Attack",
        min: 0.0005,
        max: 0.1,
        scale: "log",
        bind: gate.attack,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Release",
        min: 0.005,
        max: 1,
        scale: "log",
        bind: gate.release,
      },
    ],
  }
}
