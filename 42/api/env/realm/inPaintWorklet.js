export const inPaintWorklet =
  globalThis.PaintWorkletGlobalScope !== undefined &&
  globalThis instanceof globalThis.PaintWorkletGlobalScope
