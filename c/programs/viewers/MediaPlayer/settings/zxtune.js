// ZxTuneBackendAdapter's compiled WASM (c/libs/codecs/zxtune.wasm) only
// exports the generic emu_* glue -- no per-channel mute, no tempo control.
// Info-only, no General/Channels tabs -- see adplug.js.
function buildZxTuneInfoRows(metadata) {
  const rows = [
    ["Title", metadata?.title],
    ["Author", metadata?.author],
    ["Description", metadata?.desc],
    ["Program", metadata?.program],
    ["Path", metadata?.subPath],
    [
      "Track",
      metadata?.tracks > 1
        ? `${metadata.currentTrack} of ${metadata.tracks}`
        : null,
    ],
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

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {object} state Unused -- this dialog is read-only -- but accepted
 * for a uniform call signature with every other build*Settings().
 * @returns {{label: string, content: object} | null}
 */
export function buildZxTuneSettings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "zxtune") return null

  return {
    label: "ZXTune Info",
    content: {
      tag: "fieldset.aligned.document.grow",
      label: "ZX Spectrum",
      content: buildZxTuneInfoRows(codec.metadata),
    },
  }
}
