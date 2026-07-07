import { DistortionNode } from "../../../../../42/lib/audio/effect/DistortionNode.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import "../../../../../42/ui/control/knob.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  // await DistortionNode.load(mixer.context)
  const disto = new DistortionNode(mixer.context)
  app.audioPipe = disto

  return {
    tag: "fieldset.pa-xs.gap-xs",
    content: [
      {
        tag: "ui-knob",
        large: true,
        // scale: "log",
        label: "Drive",
        max: 20,
        bind: disto.drive.gain,
        // on: {
        //   input: (e, target) => {
        //     console.log(target.valueAsNumber)
        //   },
        // },
      },
    ],
  }
}
