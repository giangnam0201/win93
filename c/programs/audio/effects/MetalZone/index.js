import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { MetalZoneNode } from "../../../../../42/lib/audio/effect/MetalZoneNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await MetalZoneNode.load(mixer.context)
  const node = new MetalZoneNode(mixer.context)
  app.audioPipe = node

  return {
    tag: "fieldset.grid-2.pa-xs.gap-xs",
    content: [
      {
        tag: "ui-knob",
        medium: true,
        label: "Level",
        min: 0,
        max: 2,
        step: 0.01,
        bind: node.level,
      },
      {
        tag: "ui-knob",
        medium: true,
        label: "Dist",
        min: 1,
        max: 80,
        step: 0.5,
        bind: node.gain,
      },
      {
        tag: "ui-knob",
        // medium: true,
        label: "High",
        min: -1,
        max: 1,
        step: 0.01,
        bind: node.treble,
      },
      {
        tag: "ui-knob",
        // medium: true,
        label: "Low",
        min: -1,
        max: 1,
        step: 0.01,
        bind: node.bass,
      },
      {
        tag: "ui-knob",
        // medium: true,
        label: "Middle",
        min: -1,
        max: 1,
        step: 0.01,
        bind: node.mid,
      },
      {
        tag: "ui-knob",
        // medium: true,
        label: "Mid Freq",
        min: 200,
        max: 5000,
        step: 10,
        bind: node.midFreq,
      },
    ],
  }
}
