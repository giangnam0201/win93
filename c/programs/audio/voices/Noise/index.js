import "../../../../../42/ui/control/knob.js"
import { NoiseNode } from "../../../../../42/lib/audio/generator/NoiseNode.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { toTitleCase } from "../../../../../42/lib/type/string/transform.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  const type = app.config.type ? app.config.type.toLowerCase() : "pink"

  const { signal } = app

  await NoiseNode.load(mixer.context)
  const noise = new NoiseNode(mixer.context, {
    gain: app.config.gain ?? 0.5,
    type,
  })

  mixer.addTrack(noise, { app, signal })

  if (app.config.play) noise.play()

  return {
    tag: ".rows.gap-xxs",
    content: [
      {
        tag: ".cols",
        content: [
          {
            tag: "button",
            picto: noise.paused ? "play" : "pause",
            on: {
              click: (e, target) => {
                noise.togglePause()
                target.firstChild.value = noise.paused ? "play" : "pause"
              },
            },
          },
          {
            tag: "select",
            content: NoiseNode.types.map((type) => [toTitleCase(type), type]),
            value: type,
            on: {
              input: (e, target) => {
                noise.type = target.value
              },
            },
          },
        ],
      },
      {
        // tag: "fieldset.pa-x-false.pa-y-xs.grid-3",
        tag: "fieldset.cols.pa-sm.gap-xs",
        content: [
          {
            tag: "ui-knob",
            label: "Density",
            bind: noise.density,
          },
          {
            tag: "ui-knob",
            label: "Resolution",
            scale: "log",
            bind: noise.resolution,
          },
          {
            tag: "ui-knob",
            label: "Gain",
            min: -Infinity,
            max: 0,
            step: 1,
            scale: "dB",
            bind: noise.gain,
          },
        ],
      },
    ],
  }
}
