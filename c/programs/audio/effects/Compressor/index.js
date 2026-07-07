import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { CompressorNode } from "../../../../../42/lib/audio/effect/CompressorNode.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await CompressorNode.load(mixer.context)
  const comp = new CompressorNode(mixer.context)
  app.audioPipe = comp

  return {
    tag: "fieldset.pa-false.pa-b-sm.gap-xxs",
    content: [
      {
        tag: ".grid-3",
        content: [
          {
            tag: "ui-knob",
            label: "Threshold",
            medium: true,
            min: -60,
            max: 0,
            bind: comp.threshold,
          },
          {
            tag: "ui-knob",
            label: "Ratio",
            large: true,
            min: 4,
            max: 20,
            bind: comp.ratio,
          },
          {
            tag: "ui-knob",
            label: "Drive",
            medium: true,
            min: 1,
            max: 4,
            bind: comp.drive,
          },
        ],
      },
      {
        tag: ".cols.gap",
        style: { width: "max-content", margin: "auto" },
        content: [
          {
            tag: "ui-knob",
            label: "Attack",
            min: 0.0005,
            max: 0.03,
            scale: "log",
            bind: comp.attack,
          },
          {
            tag: "ui-knob",
            label: "Release",
            min: 0.02,
            max: 0.3,
            scale: "log",
            bind: comp.release,
          },
          {
            tag: "ui-knob",
            label: "Makeup",
            min: 0,
            max: 18,
            bind: comp.makeup,
          },
        ],
      },
    ],
  }
}
