import "../../../../../42/ui/control/knob.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { Canceller } from "../../../../../42/lib/class/Canceller.js"
import {
  fadeOut,
  fadeIn,
  mute,
  unmute,
} from "../../../../../42/lib/audio/algo/fading.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  const gainNode = new GainNode(mixer.context)
  app.audioPipe = gainNode

  let fadingEl
  let fadeOutBtn
  let muteBtn
  let fadeInBtn

  let muted

  let canceler
  const options = {}

  function cancel() {
    canceler?.cancel()
    canceler = new Canceller()
    options.signal = canceler.signal
  }

  return {
    tag: "fieldset.cols.gap-xs.pa-xs",
    content: [
      {
        tag: ".rows.gap-xs",
        content: [
          {
            tag: "ui-knob",
            // large: true,
            label: "Volume",
            scale: "log",
            // label: "Gain",
            // centerDetent: true,
            // min: -35,
            // max: 35,
            // unit: "dB",
            watchAutomations: true,
            bind: gainNode.gain,
            on: {
              input: () => {
                muteBtn.ariaPressed = false
                fadeOutBtn.ariaPressed = false
                fadeInBtn.ariaPressed = false
                cancel()
              },
            },
          },
          {
            tag: "number",
            style: { width: "9ch" },
            title: "Fading duration in seconds",
            min: 0,
            value: 10,
            step: 0.1,
            created: (el) => {
              fadingEl = el
            },
          },
        ],
      },
      {
        tag: ".rows",
        content: [
          {
            tag: "button.app__utility__fade-out.grow",
            picto: "fade-out",
            title: "Fade Out",
            aria: { pressed: false },
            created: (el) => {
              fadeOutBtn = el
            },
            action: async () => {
              let res
              muted = false
              muteBtn.ariaPressed = false
              fadeOutBtn.ariaPressed = true
              fadeInBtn.ariaPressed = false
              cancel()
              if (gainNode.gain.value < 0.1) {
                res = await fadeIn(gainNode, 0.1, options)
                if (res === false) return
              }
              res = await fadeOut(gainNode, fadingEl.valueAsNumber, options)
              if (res === false) return
              muted = true
              muteBtn.ariaPressed = true
              fadeOutBtn.ariaPressed = false
              fadeInBtn.ariaPressed = false
            },
          },
          {
            tag: "button.app__utility__mute.grow",
            // picto: "note-off",
            picto: "volume-off",
            title: "Mute",
            aria: { pressed: false },
            created: (el) => {
              muteBtn = el
            },
            action: async () => {
              muteBtn.ariaPressed = !muted
              fadeOutBtn.ariaPressed = false
              fadeInBtn.ariaPressed = false
              cancel()
              const res = await (muted
                ? unmute(gainNode, options)
                : mute(gainNode, options))
              if (res === false) return
              muted = !muted
            },
          },
          {
            tag: "button.app__utility__fade-in.grow",
            picto: "fade-in",
            title: "Fade In",
            aria: { pressed: false },
            created: (el) => {
              fadeInBtn = el
            },
            action: async () => {
              let res
              muted = false
              muteBtn.ariaPressed = false
              fadeOutBtn.ariaPressed = false
              fadeInBtn.ariaPressed = true
              cancel()
              if (gainNode.gain.value > 0.9) {
                res = await fadeOut(gainNode, 0.1, options)
                if (res === false) return
              }
              res = await fadeIn(gainNode, fadingEl.valueAsNumber, options)
              if (res === false) return
              muteBtn.ariaPressed = false
              fadeOutBtn.ariaPressed = false
              fadeInBtn.ariaPressed = false
            },
          },
        ],
      },
    ],
  }
}
