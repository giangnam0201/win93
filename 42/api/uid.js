import { EntropyPool } from "../lib/class/EntropyPool.js"

const pool = new EntropyPool()

/**
 * Cryptographic unique string ID generator.
 * URL and element ID friendly (the first char is always a lowercase letter).
 *
 * @see https://zelark.github.io/nano-id-cc
 * @thanks https://github.com/ai/nanoid/blob/main/index.browser.js
 *
 * @param {number} [size] The desired string length.
 * @returns {string} Alphanumeric string.
 */
export function uid(size = 10) {
  size = Math.max(8, Math.min(128, size))

  let id = String.fromCodePoint(97 + (pool.get() % 26))

  size--
  while (size--) {
    const byte = pool.get() & 61
    id +=
      byte < 36
        ? byte.toString(36) //
        : (byte - 26).toString(36).toUpperCase()
  }

  return id
}
