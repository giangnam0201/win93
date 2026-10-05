import "../../../../../42/ui/layout/tabs.js"
import { render } from "../../../../../42/api/gui/render.js"
import { toggleSolo } from "./soloVoiceMask.js"

// Matches the range input's neutral 1x playback speed.
const DEFAULT_SPEED = 1

// XMPBackendAdapter (the standalone codec, c/libs/codecs/xmp.js) has no
// getVoiceGroups() concept -- flat list, same shape as MOD/GME's Channels
// tab.
function buildXmpFullChannelRows(numVoices, currentMask, backend) {
  if (numVoices === 0) {
    return { tag: ".label", content: "No channel info available." }
  }
  const checkboxEls = []
  return {
    tag: ".grid-2",
    content: Array.from({ length: numVoices }, (_, i) => ({
      tag: "checkbox",
      name: `voice${i}`,
      label: backend.getVoiceName(i) || `Ch ${i + 1}`,
      checked: currentMask[i],
      box: { tag: "span" },
      created: (el) => {
        checkboxEls[i] = el
      },
      on: {
        change: (e, target) => {
          currentMask[i] = target.checked
          backend.setVoiceMask(currentMask.slice())
        },
        contextmenu: (e) => {
          e.preventDefault()
          toggleSolo(currentMask, i)
          checkboxEls.forEach((el, j) => {
            if (el) el.checked = currentMask[j]
          })
          backend.setVoiceMask(currentMask.slice())
        },
      },
    })),
  }
}

// backend.getSongInfo() (surfaced on codec.metadata) has an instNames field
// -- see xmp.js's updateSongInfo() -- but nothing in the app currently
// displays it. No per-channel names exist in tracker formats (libxmp's
// public xmp_channel struct has no name field, only pan/vol/flags), so this
// is the closest equivalent: the module's own instrument list.
function buildXmpFullInstrumentsContent(metadata) {
  const instNames = metadata?.instNames
  if (!instNames) {
    return {
      tag: "pre.mono.pa-xs.txt-pre-wrap.document.inset",
      content: "No instrument info available.",
    }
  }
  return {
    tag: "pre.mono.pa-xs.txt-pre-wrap.document.inset",
    content: instNames,
  }
}

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {object} state
 * @returns {{label: string, content: object} | null}
 */
export function buildXmpFullSettings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "xmpFull") return null

  const { backend } = codec

  let numVoices = backend.getNumVoices()
  let currentMask = backend.getVoiceMask()

  // Read from `state` (persisted app state), not the backend: setTempo()
  // has no change-notification of its own, so re-reading it back would only
  // ever show whatever it was reset to at the last track load, never what
  // was just picked. Same `state.tempo` key as the other format dialogs
  // (vgm/mod/gme/mdx) -- already-established shared pattern.
  const currentSpeed = state.tempo ?? DEFAULT_SPEED

  let channelsEl
  let instrumentsEl
  let speedInputEl

  return {
    label: "Tracker Settings",
    content: {
      tag: "ui-tabs.h-full",
      // codec is reused across tracks, so its channel count/instrument list
      // changes out from under an already-open dialog otherwise -- standalone
      // codecs have no "state" event system (see createCodecPlayer.js), so
      // this listens for "trackReady" instead.
      created: (el) => {
        codec.on("trackReady", { signal: el.signal }, () => {
          numVoices = backend.getNumVoices()
          currentMask = backend.getVoiceMask()
          if (channelsEl) {
            channelsEl.replaceChildren()
            render(
              buildXmpFullChannelRows(numVoices, currentMask, backend),
              channelsEl,
            )
          }
          if (instrumentsEl) {
            instrumentsEl.replaceChildren()
            render(
              buildXmpFullInstrumentsContent(codec.metadata),
              instrumentsEl,
            )
          }
        })
      },
      content: [
        {
          label: "General",
          content: {
            tag: "fieldset.aligned.grow",
            label: "Tracker",
            content: {
              tag: "div",
              content: [
                { tag: "label", for: "xmp-full-speed", content: "Speed" },
                {
                  tag: ".cols.items-center.gap-xs",
                  content: [
                    {
                      tag: "input.grow",
                      id: "xmp-full-speed",
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
                          backend.setTempo(value)
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
                        backend.setTempo(DEFAULT_SPEED)
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
            tag: "div.grow",
            created: (el) => {
              channelsEl = el
            },
            content: buildXmpFullChannelRows(numVoices, currentMask, backend),
          },
        },
        {
          label: "Instruments",
          content: {
            tag: "fieldset.grow",
            label: "Instruments",
            content: {
              tag: "div",
              created: (el) => {
                instrumentsEl = el
              },
              content: buildXmpFullInstrumentsContent(codec.metadata),
            },
          },
        },
      ],
    },
  }
}
