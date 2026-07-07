// @thanks https://www.30secondsofcode.org/js/s/round
// @thanks https://stackoverflow.com/a/12830454

/**
 * Round number to given precision.
 *
 * @param {number} x
 * @param {number} [decimals]
 * @param {(x: number | string) => number} [op]
 */
export function precision(x, decimals = 2, op = Math.round) {
  const n = String(x)
  const index = n.indexOf("e")

  return (
    (index === -1
      ? op(`${n}e${decimals}`)
      : op(`${n.slice(0, index)}e${Number(n.slice(index + 1)) + decimals}`)) /
    // can't use (10 ** decimals) because chrome and firefox returns different results
    Number(`1e${decimals}`)
  )
}

/**
 * @typedef {{
 *   (x: number, decimals?: number): number
 * }} PrecisionFn
 */

/** @type PrecisionFn */
export const round = (x, decimals = 2) => precision(x, decimals, Math.round)

/** @type PrecisionFn */
export const floor = (x, decimals = 2) => precision(x, decimals, Math.floor)

/** @type PrecisionFn */
export const ceil = (x, decimals = 2) => precision(x, decimals, Math.ceil)

precision.round = round
precision.floor = floor
precision.ceil = ceil
