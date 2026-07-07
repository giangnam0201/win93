/** @typedef {'truetype' | 'woff' | 'woff2'} Format */

const supportedFormats = new Set(["truetype", "woff", "woff2"])

/**
 * @param {Uint8Array} buffer
 * @returns {Format}
 */
export function detectFormat(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, 4)
  const sig = view.getUint32(0)
  if (sig === 0x77_4f_46_46) return "woff" // wOFF
  if (sig === 0x77_4f_46_32) return "woff2" // wOF2
  if (sig === 0x74_72_75_65 || sig === 0x4f_54_54_4f || sig === 0x00_01_00_00) {
    return "truetype"
  }
  throw new Error(`Unrecognized font signature: 0x${sig.toString(16)}`)
}

let toSfnt
let toWoff
let decompressWoff2
let compressWoff2

/**
 * @param {Uint8Array | Blob} input
 * @param {Format | "truetype"} [toFormat]
 * @param {Format | "truetype"} [fromFormat]
 * @returns {Promise<Uint8Array>}
 */
export async function encode(input, toFormat = "woff2", fromFormat) {
  let buffer =
    input instanceof Blob ? new Uint8Array(await input.arrayBuffer()) : input

  fromFormat ??= detectFormat(buffer)

  if (!supportedFormats.has(fromFormat)) {
    throw new Error(`Unsupported source format: ${fromFormat}`)
  }

  if (fromFormat === toFormat) return buffer

  // Convert to sfnt first if needed
  if (fromFormat === "woff") {
    toSfnt ??= (await import("./WOFF/woff.js")).toSfnt
    buffer = await toSfnt(buffer)
  } else if (fromFormat === "woff2") {
    decompressWoff2 ??= (await import("./WOFF/woff2.js")).decompress
    buffer = await decompressWoff2(buffer)
  }

  // Convert to target format
  if (toFormat === "woff") {
    toWoff ??= (await import("./WOFF/woff.js")).toWoff
    buffer = await toWoff(buffer)
  } else if (toFormat === "woff2") {
    compressWoff2 ??= (await import("./WOFF/woff2.js")).compress
    buffer = await compressWoff2(buffer)
  }

  return buffer
}

/**
 * @param {Uint8Array | Blob} input
 * @param {Format | "truetype"} [fromFormat]
 * @returns {Promise<Uint8Array>}
 */
export async function decode(input, fromFormat) {
  let buffer =
    input instanceof Blob ? new Uint8Array(await input.arrayBuffer()) : input

  fromFormat ??= detectFormat(buffer)

  if (!supportedFormats.has(fromFormat)) {
    throw new Error(`Unsupported source format: ${fromFormat}`)
  }

  if (fromFormat === "truetype") return buffer

  // Convert to sfnt first if needed
  if (fromFormat === "woff") {
    toSfnt ??= (await import("./WOFF/woff.js")).toSfnt
    buffer = await toSfnt(buffer)
  } else if (fromFormat === "woff2") {
    decompressWoff2 ??= (await import("./WOFF/woff2.js")).decompress
    buffer = await decompressWoff2(buffer)
  }

  return buffer
}

export const WOFF = {
  detectFormat,
  encode,
  decode,
}
