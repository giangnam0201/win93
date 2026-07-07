const maskA = 0x1_00_00_00_00
const maskB = 0x1_00_00_00

// @src https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb#comment6408455_5623914
// https://jsperf.app/genola/3

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [a]
 * @returns {string}
 */
export const rgbToHex = (r, g, b, a = 1) =>
  a === 1
    ? (maskB + (r << 16) + (g << 8) + b).toString(16).slice(1)
    : (maskA + (r << 24) + (g << 16) + (b << 8) + a * 255).toString(16)

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [a]
 * @returns {number}
 */
export const rgbToInt = (r, g, b, a = 1) =>
  a === 1
    ? (r << 16) + (g << 8) + b
    : (r << 24) + (g << 16) + (b << 8) + Math.round(a * 255)
