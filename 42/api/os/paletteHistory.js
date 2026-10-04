import { keep } from "../keep.js"

let history

/** Return the shared, persisted command palette selection history. */
export function getPaletteHistory() {
  return (history ??= keep("~/config/palette.json5", {}))
}
