import "../../../../../42/ui/layout/tabs.js"
import { render } from "../../../../../42/api/gui/render.js"
import { toggleSolo } from "./soloVoiceMask.js"
import { flattenOptions } from "./dialogShell.js"

// Matches the range input's neutral 1x playback speed.
const DEFAULT_SPEED = 1

// XMPPlayer doesn't override getVoiceGroups() (no chip-family concept like
// VGM has), so this is a flat list -- same shape as MIDI's Channels tab.
function buildModChannelRows(voiceNames, currentMask, codec) {
  if (voiceNames.length === 0) {
    return { tag: ".label", content: "No channel info available." }
  }
  const checkboxEls = []
  return {
    tag: ".grid-2",
    content: voiceNames.map((name, i) => ({
      tag: "checkbox",
      name: `voice${i}`,
      label: name || `Ch ${i + 1}`,
      checked: currentMask[i],
      box: { tag: "span" },
      created: (el) => {
        checkboxEls[i] = el
      },
      on: {
        change: (e, target) => {
          currentMask[i] = target.checked
          codec.setVoiceMask(currentMask.slice())
        },
        contextmenu: (e) => {
          e.preventDefault()
          toggleSolo(currentMask, i)
          checkboxEls.forEach((el, j) => {
            if (el) el.checked = currentMask[j]
          })
          codec.setVoiceMask(currentMask.slice())
        },
      },
    })),
  }
}

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {object} state
 * @returns {{label: string, content: object} | null}
 */
export function buildModSettings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "xmp") return null

  let voiceNames = codec.state?.voiceNames ?? []
  let voiceMask = codec.state?.voiceMask ?? []
  let currentMask = voiceMask.map((isEnabled) => isEnabled !== false)

  // Read from `state` (persisted app state), not codec.state:
  // setTempo()/setPlayerParameter() never trigger a playerStateUpdate
  // broadcast, so codec.state would just keep showing whatever it was at
  // the last actual state event (track load) -- reopening Settings after
  // changing Speed/Interpolation would always show the stale/default
  // value, never what you just picked.
  const currentSpeed = state.tempo ?? DEFAULT_SPEED

  const paramDefs = codec.state?.paramDefs ?? []
  const interpolationDef = paramDefs.find((p) => p.id === "interpolation")
  const currentInterpolation =
    state.interpolation ?? interpolationDef?.defaultValue ?? 1

  let channelsEl
  let speedInputEl

  return {
    label: "MOD Settings",
    content: {
      tag: "ui-tabs.h-full",
      // codec is reused across tracks, so its channel count/names change out
      // from under an already-open dialog otherwise.
      created: (el) => {
        codec.on("state", { signal: el.signal }, (newState) => {
          if (newState.voiceNames) {
            voiceNames = newState.voiceNames
            voiceMask = newState.voiceMask ?? []
            currentMask = voiceMask.map((isEnabled) => isEnabled !== false)
            if (channelsEl) {
              channelsEl.replaceChildren()
              render(
                buildModChannelRows(voiceNames, currentMask, codec),
                channelsEl,
              )
            }
          }
        })
      },
      content: [
        {
          label: "General",
          content: {
            tag: "fieldset.aligned.grow",
            label: "MOD",
            content: [
              {
                tag: "div",
                content: [
                  { tag: "label", for: "mod-speed", content: "Speed" },
                  {
                    tag: ".cols.items-center.gap-xs",
                    content: [
                      {
                        tag: "input.grow",
                        id: "mod-speed",
                        type: "range",
                        name: "speed",
                        label: false,
                        min: 0.25,
                        max: 2,
                        step: 0.05,
                        value: currentSpeed,
                        created: (el) => {
                          speedInputEl = el
                        },
                        on: {
                          input: (e, target) => {
                            const value = Number.parseFloat(target.value)
                            state.tempo = value
                            codec.setTempo(value)
                          },
                        },
                      },
                      {
                        tag: "button._clear",
                        picto: "arrow-ccw",
                        aria: { label: "Reset speed" },
                        action: () => {
                          speedInputEl.value = String(DEFAULT_SPEED)
                          state.tempo = DEFAULT_SPEED
                          codec.setTempo(DEFAULT_SPEED)
                        },
                      },
                    ],
                  },
                ],
              },
              {
                tag: "select",
                name: "interpolation",
                label: "Interpolation",
                value: String(currentInterpolation),
                content: flattenOptions(interpolationDef),
                on: {
                  change: (e, target) => {
                    const value = Number(target.value)
                    state.interpolation = value
                    codec.setPlayerParameter("interpolation", value)
                  },
                },
              },
            ],
          },
        },
        {
          label: "Channels",
          content: {
            tag: "div.grow",
            created: (el) => {
              channelsEl = el
            },
            content: buildModChannelRows(voiceNames, currentMask, codec),
          },
        },
      ],
    },
  }
}
