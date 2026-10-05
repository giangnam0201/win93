import "../../../../../42/ui/control/knob.js"
import { BitcrusherNode } from "../../../../../42/lib/audio/effect/BitcrusherNode.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  await BitcrusherNode.load(mixer.context)
  const bitcrusher = new BitcrusherNode(mixer.context)
  app.audioPipe = bitcrusher

  return {
    tag: "fieldset.grid-2.pa-xs.gap-xxs",
    content: [
      {
        tag: "ui-knob",
        medium: true,
        scale: "log",
        label: "Bits",
        bind: bitcrusher.bits,
      },
      {
        tag: "ui-knob",
        medium: true,
        scale: "log",
        label: "Resolution",
        bind: bitcrusher.resolution,
      },
    ],
  }
}
