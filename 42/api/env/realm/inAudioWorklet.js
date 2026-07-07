export const inAudioWorklet =
  globalThis.AudioWorkletGlobalScope !== undefined &&
  globalThis instanceof globalThis.AudioWorkletGlobalScope
