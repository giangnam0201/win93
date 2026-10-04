export const inAutomated =
  Boolean(globalThis.navigator?.webdriver) ||
  globalThis.__playwright__binding__ !== undefined
