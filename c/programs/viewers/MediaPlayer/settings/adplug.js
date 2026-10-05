import "../../../../../42/ui/layout/tabs.js"

// AdPlugBackendAdapter's compiled WASM (c/libs/codecs/adplug.wasm) only
// exports the generic emu_* glue -- no per-channel mute, no tempo control,
// unlike xmp.wasm which happened to also compile in the full raw libxmp
// API. Info-only, no Channels tab.
function buildAdPlugInfoRows(metadata) {
  const rows = [
    ["Title", metadata?.title],
    ["Author", metadata?.author],
    ["Description", metadata?.desc],
    ["Player", metadata?.player],
    ["Speed", metadata?.speed],
    ["Tracks", metadata?.tracks],
  ].filter(([, value]) => value && value !== "undefined")

  if (rows.length === 0) {
    return { tag: ".label", content: "No info available." }
  }
  // A plain {tag: "input", label} is enough -- render.js wraps any labeled
  // form control in .control-box/.control-box--text and builds the <label>
  // itself (see render.js's isControl handling), same as every real input
  // in this app. No need to hand-build the label/value markup.
  return rows.map(([label, value], i) => ({
    tag: "input",
    type: "text",
    name: `info${i}`,
    label,
    value: String(value),
    readOnly: true,
  }))
}

// Same shape as xmpFullPlayerSettings.js's Instruments tab -- a whole list,
// not a short value, so it gets its own tab and a wrapped monospace block
// instead of being squeezed into a single-line textfield with the rest.
function buildAdPlugInstrumentsContent(metadata) {
  // updateSongInfo() joins instrument names with "<br>" for an HTML
  // consumer that never existed -- swap to newlines for plain-text display.
  // emu_get_inst_text() also prefixes every slot with an auto-generated
  // "iNS_01:"-style label, named or not (some AdLib/CMF-era trackers only
  // have 8-16 real instruments and spread a scrolling greeting message
  // across the rest of the 256 slots instead of naming them -- e.g.
  // "iNS_01: composed by morten" / "iNS_02: sigaard in edlib..." with most
  // of the remaining slots empty). The exact label text isn't consistent
  // across every adplug-supported tracker format/player, so rather than
  // matching one specific spelling, drop any single leading "token:" --
  // whatever it says -- then drop whatever's left empty, same as xmp.js
  // only listing named instruments. Confirmed against real output (fresh.a2m,
  // adLibTracker2 player): every line is prefixed with a leading space
  // (" iNS_01: ..."), which silently defeated the ^-anchored match below --
  // trim() first, not just after, so the anchor lines up.
  const instruments = metadata?.instruments
    ?.replaceAll("<br>", "\n")
    .split("\n")
    .map((line) => line.trim().replace(/^\S+:\s*/, "").trim())
    .filter(Boolean)
    .join("\n")

  if (!instruments) {
    return {
      tag: "pre.mono.pa-xs.txt-pre-wrap.document.inset",
      content: "No instrument info available.",
    }
  }
  return {
    tag: "pre.mono.pa-xs.txt-pre-wrap.document.inset",
    content: instruments,
  }
}

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {object} state Unused -- this dialog is read-only -- but accepted
 * for a uniform call signature with every other build*Settings().
 * @returns {{label: string, content: object} | null}
 */
export function buildAdPlugSettings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "adplug") return null

  return {
    label: "AdLib Info",
    content: {
      tag: "ui-tabs.h-full",
      content: [
        {
          label: "General",
          content: {
            tag: "fieldset.aligned.document.grow",
            label: "AdLib / OPL",
            content: buildAdPlugInfoRows(codec.metadata),
          },
        },
        {
          label: "Instruments",
          content: {
            tag: "fieldset.grow",
            label: "Instruments",
            content: buildAdPlugInstrumentsContent(codec.metadata),
          },
        },
      ],
    },
  }
}
