const setTimeoutNative = globalThis.setTimeout

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms = 100) {
  return new Promise((resolve) => setTimeoutNative(resolve, ms))
}
