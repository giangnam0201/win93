import "../../../../../42/ui/control/knob.js"
import { TapeSimulatorNode } from "../../../../../42/lib/audio/effect/TapeSimulatorNode.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await TapeSimulatorNode.load(mixer.context)
  const tape = new TapeSimulatorNode(mixer.context)
  app.audioPipe = tape

  return {
    tag: ".pa-xxs.rows.gap-xs.liquid",
    content: [
      {
        tag: ".split-3.gap-xs",
        content: [
          [
            {
              tag: "fieldset.rows.pa-t-false.pa-b-xs",
              label: "Drive",
              content: [
                {
                  tag: "ui-knob",
                  centerDetent: true,
                  small: true,
                  label: "Input",
                  bind: tape.input,
                },
                {
                  tag: "ui-knob",
                  centerDetent: true,
                  small: true,
                  label: "Output",
                  bind: tape.output,
                },
              ],
            },

            {
              tag: "fieldset.rows.pa-t-false.pa-b-xs",
              label: "Flutter",
              content: [
                {
                  tag: "ui-knob",
                  centerDetent: true,
                  small: true,
                  label: "Depth",
                  bind: tape.flutterDepth,
                },
                {
                  tag: "ui-knob",
                  centerDetent: true,
                  small: true,
                  label: "Speed",
                  bind: tape.flutterSpeed,
                },
              ],
            },

            {
              tag: "fieldset.rows.pa-t-false.pa-b-xs",
              label: "Head",
              content: [
                {
                  tag: "ui-knob",
                  centerDetent: true,
                  small: true,
                  label: "Bump",
                  bind: tape.headBump,
                },
                {
                  tag: "ui-knob",
                  centerDetent: true,
                  small: true,
                  label: "Freq",
                  bind: tape.headFreq,
                },
              ],
            },
          ],
        ],
      },
      {
        tag: "fieldset.grid-4.gap.pa-xs.pa-x-lg",
        // style: {
        //   width: "calc-size(auto, round(up, size, 12px))",
        // },
        content: [
          {
            tag: "ui-knob",
            centerDetent: true,
            label: "Tilt",
            // medium: true,
            bind: tape.tilt,
          },
          {
            tag: "ui-knob",
            centerDetent: true,
            label: "Shape",
            // medium: true,
            bind: tape.shape,
          },
          {
            tag: "ui-knob",
            centerDetent: true,
            label: "Bias",
            // medium: true,
            bind: tape.bias,
          },
          {
            tag: "ui-knob",
            label: "Mix",
            // medium: true,
            bind: tape.mix,
          },
        ],
      },
    ],
  }
}
