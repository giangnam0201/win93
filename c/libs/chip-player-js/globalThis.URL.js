// AudioWorkletGlobalScope has no global URL constructor (genuinely absent,
// not a timing issue -- confirmed via "URL is not defined" thrown from
// chip-core.js at runtime). The Emscripten glue in chip-core.js calls
// `new URL(path, base)` once, while computing a fallback location for the
// .wasm file -- even though ChiptuneProcessor.js always supplies
// "wasmBinary" directly (pre-fetched bytes) and that computed URL's string
// value is never actually used to fetch anything (only compared for
// equality against itself, to decide whether to reuse the already-provided
// bytes). This is a minimal stand-in good enough for that one call site --
// not a general-purpose URL implementation.
export class URL {
  constructor(path, base = "") {
    this.href = /^[a-z][a-z0-9+.-]*:/i.test(path)
      ? path
      : String(base).replace(/[^/]*$/, "") + path
  }

  toString() {
    return this.href
  }
}

// @ts-ignore
globalThis.URL ??= URL
