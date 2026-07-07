/**
 * Bit twiddling hacks for JavaScript.
 *
 * @author Mikola Lysenko
 * @source https://github.com/mikolalysenko/bit-twiddle
 *
 * Ported from Stanford bit twiddling hack library:
 *    http://graphics.stanford.edu/~seander/bithacks.html
 *
 */

// Number of bits in an integer
const INT_BITS = 32

// Constants
export const INT_MAX = 0x7f_ff_ff_ff
export const INT_MIN = -1 << (INT_BITS - 1)

export const REVERSE_TABLE = new Array(256)

for (let i = 0; i < 256; ++i) {
  let v = i
  let r = i
  let s = 7
  for (v >>>= 1; v; v >>>= 1) {
    r <<= 1
    r |= v & 1
    --s
  }

  REVERSE_TABLE[i] = (r << s) & 0xff
}

/**
 * Returns -1, 0, +1 depending on sign of x.
 * @param {number} v
 */
export function sign(v) {
  return Number(v > 0) - Number(v < 0)
}

/**
 * Computes absolute value of integer.
 * @param {number} v
 */
export function abs(v) {
  const mask = v >> (INT_BITS - 1)
  return (v ^ mask) - mask
}

/**
 * Computes minimum of integers x and y.
 * @param {number} x
 * @param {number} y
 */
export function min(x, y) {
  return y ^ ((x ^ y) & -(x < y))
}

/**
 * Computes maximum of integers x and y.
 * @param {number} x
 * @param {number} y
 */
export function max(x, y) {
  return x ^ ((x ^ y) & -(x < y))
}

/**
 * Checks if a number is a power of two.
 * @param {number} v
 */
export function isPow2(v) {
  return !(v & (v - 1)) && Boolean(v)
}

/**
 * Computes log base 2 of v.
 * @param {number} v
 */
// prettier-ignore
export function log2(v) {
  let r; let shift;
  r =     Number(v > 0xFF_FF) << 4; v >>>= r;
  shift = Number(v > 0xFF   ) << 3; v >>>= shift; r |= shift;
  shift = Number(v > 0xF    ) << 2; v >>>= shift; r |= shift;
  shift = Number(v > 0x3    ) << 1; v >>>= shift; r |= shift;
  return r | (v >> 1);
}

/**
 * Computes log base 10 of v.
 * @param {number} v
 */
// prettier-ignore
export function log10(v) {
  return  (v >= 1_000_000_000) ? 9 : (v >= 100_000_000) ? 8 : (v >= 10_000_000) ? 7 :
          (v >= 1_000_000) ? 6 : (v >= 100_000) ? 5 : (v >= 10_000) ? 4 :
          (v >= 1000) ? 3 : (v >= 100) ? 2 : (v >= 10) ? 1 : 0;
}

/**
 * Counts number of bits.
 * @param {number} v
 */
export function popCount(v) {
  v -= (v >>> 1) & 0x55_55_55_55
  v = (v & 0x33_33_33_33) + ((v >>> 2) & 0x33_33_33_33)
  return (((v + (v >>> 4)) & 0xf_0f_0f_0f) * 0x1_01_01_01) >>> 24
}

/**
 * Counts number of trailing zeros.
 * @param {number} v
 */
export function countTrailingZeros(v) {
  let c = 32
  v &= -v
  if (v) c--
  if (v & 0x00_00_ff_ff) c -= 16
  if (v & 0x00_ff_00_ff) c -= 8
  if (v & 0x0f_0f_0f_0f) c -= 4
  if (v & 0x33_33_33_33) c -= 2
  if (v & 0x55_55_55_55) c -= 1
  return c
}

/**
 * Rounds to next power of 2.
 * @param {number} v
 */
export function nextPow2(v) {
  v += Number(v === 0)
  --v
  v |= v >>> 1
  v |= v >>> 2
  v |= v >>> 4
  v |= v >>> 8
  v |= v >>> 16
  return v + 1
}

/**
 * Rounds down to previous power of 2.
 * @param {number} v
 */
export function prevPow2(v) {
  v |= v >>> 1
  v |= v >>> 2
  v |= v >>> 4
  v |= v >>> 8
  v |= v >>> 16
  return v - (v >>> 1)
}

/**
 * Computes parity of word.
 * @param {number} v
 */
export function parity(v) {
  v ^= v >>> 16
  v ^= v >>> 8
  v ^= v >>> 4
  v &= 0xf
  return (0x69_96 >>> v) & 1
}

/**
 * Reverse bits in a 32 bit word.
 * @param {number} v
 */
export function reverse(v) {
  return (
    (REVERSE_TABLE[v & 0xff] << 24) |
    (REVERSE_TABLE[(v >>> 8) & 0xff] << 16) |
    (REVERSE_TABLE[(v >>> 16) & 0xff] << 8) |
    REVERSE_TABLE[(v >>> 24) & 0xff]
  )
}

/**
 * Interleave bits of 2 coordinates with 16 bits.  Useful for fast quadtree codes.
 * @param {number} x
 * @param {number} y
 */
export function interleave2(x, y) {
  x &= 0xff_ff
  x = (x | (x << 8)) & 0x00_ff_00_ff
  x = (x | (x << 4)) & 0x0f_0f_0f_0f
  x = (x | (x << 2)) & 0x33_33_33_33
  x = (x | (x << 1)) & 0x55_55_55_55

  y &= 0xff_ff
  y = (y | (y << 8)) & 0x00_ff_00_ff
  y = (y | (y << 4)) & 0x0f_0f_0f_0f
  y = (y | (y << 2)) & 0x33_33_33_33
  y = (y | (y << 1)) & 0x55_55_55_55

  return x | (y << 1)
}

/**
 * Extracts the nth interleaved component.
 * @param {number} v
 * @param {number} n
 */
export function deinterleave2(v, n) {
  v = (v >>> n) & 0x55_55_55_55
  v = (v | (v >>> 1)) & 0x33_33_33_33
  v = (v | (v >>> 2)) & 0x0f_0f_0f_0f
  v = (v | (v >>> 4)) & 0x00_ff_00_ff
  v = (v | (v >>> 16)) & 0x0_00_ff_ff
  return (v << 16) >> 16
}

/**
 * Interleave bits of 3 coordinates, each with 10 bits.  Useful for fast octree codes.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function interleave3(x, y, z) {
  x &= 0x3_ff
  x = (x | (x << 16)) & 4_278_190_335
  x = (x | (x << 8)) & 251_719_695
  x = (x | (x << 4)) & 3_272_356_035
  x = (x | (x << 2)) & 1_227_133_513

  y &= 0x3_ff
  y = (y | (y << 16)) & 4_278_190_335
  y = (y | (y << 8)) & 251_719_695
  y = (y | (y << 4)) & 3_272_356_035
  y = (y | (y << 2)) & 1_227_133_513
  x |= y << 1

  z &= 0x3_ff
  z = (z | (z << 16)) & 4_278_190_335
  z = (z | (z << 8)) & 251_719_695
  z = (z | (z << 4)) & 3_272_356_035
  z = (z | (z << 2)) & 1_227_133_513

  return x | (z << 2)
}

/**
 * Extracts nth interleaved component of a 3-tuple.
 * @param {number} v
 * @param {number} n
 */
export function deinterleave3(v, n) {
  v = (v >>> n) & 1_227_133_513
  v = (v | (v >>> 2)) & 3_272_356_035
  v = (v | (v >>> 4)) & 251_719_695
  v = (v | (v >>> 8)) & 4_278_190_335
  v = (v | (v >>> 16)) & 0x3_ff
  return (v << 22) >> 22
}

/**
 * Computes next combination in colexicographic order (this is mistakenly called nextPermutation on the bit twiddling hacks page).
 * @param {number} v
 */
export function nextCombination(v) {
  const t = v | (v - 1)
  return (t + 1) | (((~t & -~t) - 1) >>> (countTrailingZeros(v) + 1))
}
