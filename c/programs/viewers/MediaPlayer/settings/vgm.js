import "../../../../../42/ui/layout/tabs.js"
import { render } from "../../../../../42/api/gui/render.js"
import { toggleSolo } from "./soloVoiceMask.js"

// Matches the range input's neutral 1x playback speed.
const DEFAULT_SPEED = 1

// VGMPlayer.getVoiceGroups() already sections voices by chip (e.g. YM2612,
// SN76489 on a Sega Genesis rip) -- one fieldset per chip, a 2-column grid
// of mute checkboxes inside, same building block as MIDI's Channels tab.
function buildVgmChannelGroups(voiceGroups, currentMask, codec) {
  if (voiceGroups.length === 0) {
    return { tag: ".label", content: "No channel info available." }
  }
  // Indexed by the same global `idx` as currentMask (spans every group),
  // not per-group, so a solo can reach across chips to reflect the shared
  // mask in every checkbox at once.
  const checkboxEls = []
  return voiceGroups.map((group) => ({
    tag: "fieldset.grow",
    label: group.name,
    content: {
      tag: ".grid-2",
      content: group.voices.map(({ idx, name }) => ({
        tag: "checkbox",
        name: `voice${idx}`,
        label: name || `Channel ${idx + 1}`,
        checked: currentMask[idx],
        box: { tag: "span" },
        created: (el) => {
          checkboxEls[idx] = el
        },
        on: {
          change: (e, target) => {
            currentMask[idx] = target.checked
            codec.setVoiceMask(currentMask.slice())
          },
          contextmenu: (e) => {
            e.preventDefault()
            toggleSolo(currentMask, idx)
            checkboxEls.forEach((el, j) => {
              if (el) el.checked = currentMask[j]
            })
            codec.setVoiceMask(currentMask.slice())
          },
        },
      })),
    },
  }))
}

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {object} state
 * @returns {{label: string, content: object} | null}
 */
export function buildVgmSettings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "vgm") return null

  let voiceGroups = codec.state?.voiceGroups ?? []
  let voiceMask = codec.state?.voiceMask ?? []
  let currentMask = voiceMask.map((isEnabled) => isEnabled !== false)

  // Not from a paramDef -- VGMPlayer has none, getTempo()/setTempo() call
  // straight into libvgm's own playback-speed control. No documented native
  // range, so this mirrors MIDI's curated 0.25-2 slider rather than the
  // wider 0.1-10 ChiptuneNode.setTempo() itself allows; narrow it further
  // if libvgm turns out not to like the edges.
  //
  // Read from `state` (persisted app state), not codec.state: setTempo()
  // never triggers a playerStateUpdate broadcast, so codec.state would just
  // keep showing whatever it was at the last actual state event (track
  // load) -- reopening Settings after changing Speed would always show the
  // stale/default value, never what you just picked.
  const currentSpeed = state.tempo ?? DEFAULT_SPEED

  let channelsEl
  let speedInputEl

  return {
    label: "VGM Settings",
    content: {
      tag: "ui-tabs.h-full",
      // codec is reused across tracks, so its channel list changes out from
      // under an already-open dialog otherwise.
      created: (el) => {
        codec.on("state", { signal: el.signal }, (newState) => {
          if (newState.voiceGroups) {
            voiceGroups = newState.voiceGroups
            voiceMask = newState.voiceMask ?? []
            currentMask = voiceMask.map((isEnabled) => isEnabled !== false)
            if (channelsEl) {
              channelsEl.replaceChildren()
              render(
                buildVgmChannelGroups(voiceGroups, currentMask, codec),
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
            label: "VGM",
            content: {
              tag: "div",
              content: [
                { tag: "label", for: "vgm-speed", content: "Speed" },
                {
                  tag: ".cols.items-center.gap-xs",
                  content: [
                    {
                      tag: "input.grow",
                      id: "vgm-speed",
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
          },
        },
        {
          label: "Channels",
          content: {
            tag: "div.rows.grow",
            created: (el) => {
              channelsEl = el
            },
            content: buildVgmChannelGroups(voiceGroups, currentMask, codec),
          },
        },
      ],
    },
  }
}
