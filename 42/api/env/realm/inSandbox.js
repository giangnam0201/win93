export const inSandbox =
  globalThis.origin === "null" &&
  globalThis.window !== undefined &&
  globalThis.window !== globalThis.top
