/**
 * Generates a random alphanumeric seed.
 * @returns {string}
 */
export function generateRandomSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

/**
 * Converts a string seed into a simple 32-bit numeric hash.
 * @param {string} seed
 * @returns {number}
 */
export function seedToNumber(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return hash
}
