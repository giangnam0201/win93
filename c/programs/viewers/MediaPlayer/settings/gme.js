import "../../../../../42/ui/layout/tabs.js"
import { render } from "../../../../../42/api/gui/render.js"
import { toggleSolo } from "./soloVoiceMask.js"

// Matches the range input's neutral 1x playback speed.
const DEFAULT_SPEED = 1

// GMEPlayer doesn't override getVoiceGroups() (no chip-family concept like
// VGM has), so this is a flat list -- same shape as MIDI/MOD's Channels tab.
function buildGmeChannelRows(voiceNames, currentMask, codec) {
  if (voiceNames.length === 0) {
    return { tag: ".label", content: "No channel info available." }
  }
  const checkboxEls = []
  return {
    tag: ".grid-2",
    content: voiceNames.map((name, i) => ({
      tag: "checkbox",
      name: `voice${i}`,
      label: name || `Channel ${i + 1}`,
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
export function buildGmeSettings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "gme") return null

  let voiceNames = codec.state?.voiceNames ?? []
  let voiceMask = codec.state?.voiceMask ?? []
  let currentMask = voiceMask.map((isEnabled) => isEnabled !== false)

  // Read from `state` (persisted app state), not codec.state:
  // setTempo()/setPlayerParameter() never trigger a playerStateUpdate
  // broadcast, so codec.state would just keep showing whatever it was at
  // the last actual state event (track load) -- reopening Settings after
  // changing one of these would always show the stale/default value, never
  // what you just picked.
  const currentSpeed = state.tempo ?? DEFAULT_SPEED

  const paramDefs = codec.state?.paramDefs ?? []
  const stereoWidthDef = paramDefs.find((p) => p.id === "stereoWidth")
  const disableEchoDef = paramDefs.find((p) => p.id === "disableEcho")
  const enableAccuracyDef = paramDefs.find((p) => p.id === "enableAccuracy")

  const currentStereoWidth =
    state.stereoWidth ?? stereoWidthDef?.defaultValue ?? 1
  const currentDisableEcho =
    state.disableEcho ?? disableEchoDef?.defaultValue ?? false
  const currentEnableAccuracy =
    state.enableAccuracy ?? enableAccuracyDef?.defaultValue ?? false

  let channelsEl
  let speedInputEl
  let stereoWidthInputEl

  return {
    label: "GME Settings",
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
                buildGmeChannelRows(voiceNames, currentMask, codec),
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
            label: "GME",
            content: [
              {
                tag: "div",
                content: [
                  { tag: "label", for: "gme-speed", content: "Speed" },
                  {
                    tag: ".cols.items-center.gap-xs",
                    content: [
                      {
                        tag: "input.grow",
                        id: "gme-speed",
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
                tag: "div",
                content: [
                  {
                    tag: "label",
                    for: "gme-stereo-width",
                    content: "Stereo Width",
                  },
                  {
                    tag: ".cols.items-center.gap-xs",
                    content: [
                      {
                        tag: "input.grow",
                        id: "gme-stereo-width",
                        type: "range",
                        name: "stereoWidth",
                        label: false,
                        min: 0,
                        max: 1,
                        step: 0.01,
                        value: currentStereoWidth,
                        created: (el) => {
                          stereoWidthInputEl = el
                        },
                        on: {
                          input: (e, target) => {
                            const value = Number.parseFloat(target.value)
                            state.stereoWidth = value
                            codec.setPlayerParameter("stereoWidth", value)
                          },
                        },
                      },
                      {
                        tag: "button._clear",
                        picto: "arrow-ccw",
                        aria: { label: "Reset stereo width" },
                        action: () => {
                          const value = stereoWidthDef?.defaultValue ?? 1
                          stereoWidthInputEl.value = String(value)
                          state.stereoWidth = value
                          codec.setPlayerParameter("stereoWidth", value)
                        },
                      },
                    ],
                  },
                ],
              },
              {
                tag: "checkbox",
                name: "disableEcho",
                label: "Disable SPC Echo",
                title: disableEchoDef?.hint,
                checked: currentDisableEcho,
                on: {
                  change: (e, target) => {
                    state.disableEcho = target.checked
                    codec.setPlayerParameter("disableEcho", target.checked)
                  },
                },
              },
              {
                tag: "checkbox",
                name: "enableAccuracy",
                label: "Accurate SPC Filter",
                title: enableAccuracyDef?.hint,
                checked: currentEnableAccuracy,
                on: {
                  change: (e, target) => {
                    state.enableAccuracy = target.checked
                    codec.setPlayerParameter(
                      "enableAccuracy",
                      target.checked,
                    )
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
            content: buildGmeChannelRows(voiceNames, currentMask, codec),
          },
        },
      ],
    },
  }
}
