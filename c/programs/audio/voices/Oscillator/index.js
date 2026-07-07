import "../../../../../42/ui/control/knob.js"
import "../../../../../42/ui/media/scope.js"
import { PhaseOscillatorNode } from "../../../../../42/lib/audio/generator/PhaseOscillatorNode.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { toTitleCase } from "../../../../../42/lib/type/string/transform.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  const { signal } = app

  const gain = app.config.gain ?? 0.03

  const type = app.config.type ? app.config.type.toLowerCase() : "square"

  const frequency =
    (app.config.freq ??
    app.config.frequency ??
    typeof app.config._?.[0] === "number")
      ? app.config._?.[0]
      : 440 / 3

  await PhaseOscillatorNode.load(mixer.context)
  const osc = new PhaseOscillatorNode(mixer.context, {
    gain,
    frequency,
    type,
  })

  // const osc2 = new OscillatorNode(mixer.context, {
  //   frequency: 320 / 2,
  // })
  // const osc2 = new PhaseOscillatorNode(mixer.context, {
  //   type,
  //   frequency: 440,
  //   wave: 1,
  // })

  // osc2.connect(osc.sync)
  // osc2.start()

  mixer.addTrack(osc, { app, signal })

  if (app.config.play) osc.play()

  // @ts-ignore
  app.audioNode = osc

  return {
    tag: ".rows.gap-xxs",
    content: [
      {
        tag: ".cols",
        content: [
          {
            tag: "button",
            picto: osc.paused ? "play" : "pause",
            on: {
              click: (e, target) => {
                osc.togglePause()
                target.firstChild.value = osc.paused ? "play" : "pause"
              },
            },
          },
          {
            tag: "select",
            content: PhaseOscillatorNode.types.map((type) => [
              toTitleCase(type),
              type,
            ]),
            value: type,
            on: {
              input: (e, target) => {
                osc.type = target.value
              },
            },
          },
        ],
      },
      {
        tag: "fieldset.pa-x-xxs.pa-y-xs.gap-xs.grid-4",
        content: [
          {
            tag: "ui-knob",
            label: "Freq",
            step: 0.1,
            min: 20,
            max: 2000,
            bind: osc.frequency,
          },
          {
            tag: "ui-knob",
            label: "Duty",
            bind: osc.duty,
          },
          {
            tag: "ui-knob",
            label: "Phase",
            bind: osc.phase,
          },
          {
            tag: "ui-knob",
            label: "Gain",
            min: -Infinity,
            max: 0,
            scale: "dB",
            bind: osc.gain,
          },
        ],
      },
      // {
      //   tag: "ui-scope.w-full",
      //   height: 32,
      //   autoScale: true,
      //   audioInput: osc,
      // },
    ],
  }
}
