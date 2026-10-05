import "../../../../../42/ui/layout/tabs.js"
import { toggleSolo } from "./soloVoiceMask.js"

// SIDPlayBackendAdapter (c/libs/codecs/sidplayfp.js) already exposes
// per-voice muting via the standard emu_* glue (enableVoice()) -- unlike
// xmp.js, nothing needed changing there. Each SID chip has 3 voices;
// multi-SID tunes stack more chips (countSIDs()), grouped like VGM's
// per-chip Channels tab. enableVoice() is write-only (no getter), so mute
// state is tracked locally, defaulting to "all enabled" same as every
// other Channels tab on first open.
function buildSidChannelGroups(sidCount, currentMask, backend) {
  if (sidCount === 0) {
    return { tag: ".label", content: "No channel info available." }
  }
  // Indexed by the same global `idx` as currentMask (spans every SID
  // chip), not per-chip, so a solo can reach across chips to reflect the
  // shared mask in every checkbox at once.
  const checkboxEls = []
  const applyVoice = (idx) => {
    const s = Math.floor(idx / 3)
    const v = idx % 3
    // See the change handler below for why this is inverted.
    backend.enableVoice(s, v, !currentMask[idx])
  }
  return Array.from({ length: sidCount }, (_, s) => ({
    tag: "fieldset.grow",
    label: sidCount > 1 ? `SID ${s + 1}` : "SID",
    content: {
      tag: ".grid-2",
      content: [0, 1, 2].map((v) => {
        const idx = s * 3 + v
        return {
          tag: "checkbox",
          name: `voice${idx}`,
          label: `Voice ${v + 1}`,
          checked: currentMask[idx],
          box: { tag: "span" },
          created: (el) => {
            checkboxEls[idx] = el
          },
          on: {
            change: (e, target) => {
              currentMask[idx] = target.checked
              // Confirmed live: despite the name, emu_enable_voice()'s 3rd
              // arg is 1 to MUTE and 0 to leave audible -- inverted from
              // what "enableVoice(..., on)" suggests. Flip here so the
              // checkbox keeps the same "checked = audible" convention as
              // every other Channels tab in the app.
              backend.enableVoice(s, v, !target.checked)
            },
            contextmenu: (e) => {
              e.preventDefault()
              toggleSolo(currentMask, idx)
              checkboxEls.forEach((el, j) => {
                if (el) el.checked = currentMask[j]
                applyVoice(j)
              })
            },
          },
        }
      }),
    },
  }))
}

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {object} state
 * @returns {{label: string, content: object} | null}
 */
export function buildSidSettings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "sidplayfp") return null

  const { backend } = codec

  const sidCount = backend.countSIDs()
  const currentMask = new Array(sidCount * 3).fill(true)

  // Read from `state` (persisted app state): these apply immediately but
  // have no change-notification of their own, so re-reading them back from
  // the backend on reopen would only ever show the native default, never
  // what was just picked -- same reasoning as every other format dialog's
  // Speed field.
  const current6581 = state.sid6581 ?? backend.isSID6581()
  const currentNtsc = state.sidNtsc ?? backend.isNTSC()

  return {
    label: "SID Settings",
    content: {
      tag: "ui-tabs.h-full",
      content: [
        {
          label: "General",
          content: {
            tag: "fieldset.aligned.grow",
            label: "SID",
            content: [
              {
                tag: "select",
                name: "sidModel",
                label: "SID Model",
                value: current6581 ? "1" : "0",
                content: [
                  ["8580", "0"],
                  ["6581", "1"],
                ],
                on: {
                  change: (e, target) => {
                    const value = target.value === "1"
                    state.sid6581 = value
                    backend.setSID6581(value)
                  },
                },
              },
              {
                tag: "select",
                name: "sidRegion",
                label: "Region",
                value: currentNtsc ? "1" : "0",
                content: [
                  ["PAL", "0"],
                  ["NTSC", "1"],
                ],
                on: {
                  change: (e, target) => {
                    const value = target.value === "1"
                    state.sidNtsc = value
                    backend.setNTSC(value)
                  },
                },
              },
            ],
          },
        },
        {
          label: "Channels",
          content: {
            tag: "div.rows.grow",
            content: buildSidChannelGroups(sidCount, currentMask, backend),
          },
        },
      ],
    },
  }
}
