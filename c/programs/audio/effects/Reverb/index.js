import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { ReverbNode } from "../../../../../42/lib/audio/effect/ReverbNode.js"
import { slowFadeCurve } from "../../../../../42/lib/audio/algo/crossfaderCurves.js"
// import { scale } from "../../../../../42/lib/type/number/math.js"
// import "../../../../../42/ui/media/shader.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await ReverbNode.load(mixer.context)
  const reverb = new ReverbNode(mixer.context)
  app.audioPipe = reverb

  // let shaderEl

  return {
    tag: ".pa-xxs.cols.gap-xs.liquid",
    content: [
      // {
      //   tag: "ui-shader.inset._ratio",
      //   width: 64,
      //   autoplay: true,
      //   src: app.resolveURL("./display.glsl"),
      //   uniforms: {
      //     // zoom: 0.01,
      //     zoom: scale(0.5, 0, 1, 0.99, 0.01),
      //   },
      //   created(el) {
      //     shaderEl = el
      //   },
      // },
      {
        tag: ".rows.gap-xs.grow",
        content: [
          {
            tag: "fieldset.pa-xs.cols",
            label: "Decay",
            content: [
              {
                tag: "ui-knob.ma-x-xl",
                aria: {
                  label: "Decay time",
                },
                bind: reverb.decay,
                // on: {
                //   input: (e, { valueAsNumber, min, max }) => {
                //     // const v = scale(valueAsNumber, min, max, 0.01, 0.99)
                //     const v = scale(valueAsNumber, min, max, 0.99, 0.01)
                //     shaderEl.uniforms.zoom.value = v
                //   },
                // },
              },
            ],
          },
          {
            // tag: ".pa-xs.cols.shrink",
            tag: "fieldset.pa-xs.gap.w-full.split-2.shrink",
            content: [
              {
                tag: "ui-knob",
                label: "Pre Delay",
                // medium: true,
                // box: { class: { "items-y-end": true } },
                box: { style: { "justify-content": "end" } },
                // small: true,
                bind: reverb.preDelay,
              },
              {
                tag: "ui-knob",
                label: "Damping",
                // medium: true,
                bind: reverb.damping,
              },
              // {
              //   tag: "ui-knob",
              //   label: "PreDiff 1",
              //   bind: reverb.inputDiffusion1,
              // },
              // {
              //   tag: "ui-knob",
              //   label: "PreDiff 2",
              //   bind: reverb.inputDiffusion2,
              // },
            ],
          },
        ],
      },
      {
        tag: ".rows.gap-xs",
        content: [
          {
            tag: "fieldset.pa-xs.gap.rows",
            label: "Diff",
            content: [
              // {
              //   tag: "ui-knob",
              //   label: "Diff 1",
              //   bind: reverb.decayDiffusion1,
              // },
              // {
              //   tag: "ui-knob",
              //   label: "Diff 2",
              //   bind: reverb.decayDiffusion2,
              // },

              {
                tag: "ui-knob",
                label: "Input",
                small: true,
                ringless: true,
                bind: reverb.inputDiffusion1,
              },
              {
                tag: "ui-knob",
                label: "Decay",
                small: true,
                ringless: true,
                bind: reverb.decayDiffusion1,
              },
            ],
          },
          {
            tag: "fieldset.pa-xs.shrink",
            content: [
              {
                tag: "ui-knob",
                label: "LPF",
                // medium: true,
                bind: reverb.bandwidth,
              },
            ],
          },
        ],
      },
      {
        tag: ".rows.gap-xs",
        content: [
          {
            tag: "fieldset.pa-xs.gap.rows",
            label: "Mod",
            content: [
              {
                tag: "ui-knob",
                label: "Rate",
                small: true,
                ringless: true,
                bind: reverb.excursionRate,
              },
              {
                tag: "ui-knob",
                label: "Depth",
                small: true,
                ringless: true,
                bind: reverb.excursionDepth,
              },
            ],
          },
          {
            tag: "fieldset.pa-xs.shrink",
            content: [
              // { tag: "ui-knob", label: "Dry/Wet", bind: reverb.wet },
              {
                tag: "ui-knob",
                label: "Mix",
                // medium: true,
                range: "fraction",
                value: 0.225,
                on: {
                  input: (e, { valueAsNumber }) => {
                    const [a, b] = slowFadeCurve(valueAsNumber)
                    reverb.dry.setTargetAtTime(a, 0, 0.015)
                    reverb.wet.setTargetAtTime(b, 0, 0.015)
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  }
}
