export const inWorklet =
  globalThis.WorkletGlobalScope !== undefined &&
  globalThis instanceof globalThis.WorkletGlobalScope
