export const inDesktopRealm =
  globalThis.window !== undefined &&
  (globalThis.window === globalThis.top || globalThis.window.name === "desktop")
