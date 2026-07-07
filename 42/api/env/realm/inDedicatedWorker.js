export const inDedicatedWorker =
  globalThis.self !== undefined &&
  globalThis.DedicatedWorkerGlobalScope !== undefined &&
  self instanceof DedicatedWorkerGlobalScope
