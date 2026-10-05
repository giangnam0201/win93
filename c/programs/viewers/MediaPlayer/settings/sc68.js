// SC68BackendAdapter2's compiled WASM (c/libs/codecs/sc68n.wasm) only
// exports the generic emu_* glue -- no per-channel mute, no tempo control.
// Info-only, no General/Channels tabs -- see adplug.js.
function buildSc68InfoRows(metadata) {
  const rows = [
    ["Title", metadata?.title],
    ["Artist", metadata?.artist],
    ["Album", metadata?.album],
    ["Genre", metadata?.genre],
    ["Format", metadata?.format],
    [
      "Track",
      metadata?.numberOfTracks > 1
        ? `${metadata.track} of ${metadata.numberOfTracks}`
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
export function buildSc68Settings(playerEl, state) {
  const { codec } = playerEl
  if (!codec || codec.type !== "sc68n") return null

  return {
    label: "SC68 Info",
    content: {
      tag: "fieldset.aligned.document.grow",
      label: "Atari ST",
      content: buildSc68InfoRows(codec.metadata),
    },
  }
}
