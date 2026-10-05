//! Copyright (c) 2015 Jordan Eldredge. MIT License.
// @src https://github.com/captbaritone/webamp/tree/master/packages/ani-cursor

import { RIFFFile } from "./RIFFFile.js"

/**
 * @typedef {object} Chunk
 * @property {string} format
 * @property {string} chunkId
 * @property {object} chunkData
 * @property {number} chunkData.start
 * @property {number} chunkData.end
 * @property {Chunk[]} subChunks
 */

/**
 * @typedef {object} AniMetadata
 * @property {number} cbSize
 * @property {number} nFrames
 * @property {number} nSteps
 * @property {number} iWidth
 * @property {number} iHeight
 * @property {number} iBitCount
 * @property {number} nPlanes
 * @property {number} iDispRate
 * @property {number} bfAttributes
 */

/**
 * @typedef {object} ParsedAni
 * @property {number[] | null} rate
 * @property {number[] | null} seq
 * @property {Uint8Array[]} images
 * @property {AniMetadata} metadata
 * @property {string | null} artist
 * @property {string | null} title
 */

/**
 * @typedef {{
 *  frames: { url: string, percents: number[] }[],
 *  duration: number,
 * }} AniCursorImage
 */

const JIFFIES_PER_MS = 1000 / 60

/**
 * @param {Uint8Array} dataArray
 * @returns {string}
 */
function base64FromDataArray(dataArray) {
  return window.btoa(
    Array.from(dataArray)
      .map((byte) => String.fromCharCode(byte))
      .join(""),
  )
}

/**
 * @param {Uint8Array} arr
 * @returns {string}
 */
function curUrlFromByteArray(arr) {
  const base64 = base64FromDataArray(arr)
  return `data:image/x-win-bitmap;base64,${base64}`
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * @param {Uint8Array} arr
 * @returns {ParsedAni}
 */
export function parseAni(arr) {
  const riff = new RIFFFile()
  riff.setSignature(arr)
  const { signature } = riff

  if (signature.format !== "ACON") {
    throw new Error(
      `Unexpected format. Expected "ACON", got "${signature.format}"`,
    )
  }

  // Helper function to get a chunk by chunkId and transform it if it's non-null.
  function mapChunk(chunkId, mapper) {
    const chunk = riff.findChunk(chunkId)
    if (chunk !== undefined) return mapper(chunk)
  }

  function readImages(chunk, frameCount) {
    return chunk.subChunks.slice(0, frameCount).map((c) => {
      if (c.chunkId !== "icon") {
        throw new Error(`Unexpected chunk type in fram: ${c.chunkId}`)
      }
      return arr.slice(c.chunkData.start, c.chunkData.end)
    })
  }

  const metadata = mapChunk("anih", (c) => {
    const words = riff.bytes.toUint32Array(
      c.chunkData.start,
      c.chunkData.end,
      true,
    )

    return {
      cbSize: words[0],
      nFrames: words[1],
      nSteps: words[2],
      iWidth: words[3],
      iHeight: words[4],
      iBitCount: words[5],
      nPlanes: words[6],
      iDispRate: words[7],
      bfAttributes: words[8],
    }
  })

  if (metadata == null) {
    throw new Error("Did not find anih")
  }

  const rate = mapChunk("rate", (c) =>
    riff.bytes.toUint32Array(c.chunkData.start, c.chunkData.end, true),
  )

  // chunkIds are always four chars, hence the trailing space.
  const seq = mapChunk("seq ", (c) =>
    riff.bytes.toUint32Array(c.chunkData.start, c.chunkData.end, true),
  )

  const lists = riff.findChunk("LIST", true)
  const imageChunk =
    lists === null || lists === void 0
      ? void 0
      : lists.find((c) => c.format === "fram")
  if (imageChunk == null) {
    throw new Error("Did not find fram LIST")
  }

  let images = readImages(imageChunk, metadata.nFrames)

  let title = null
  let artist = null

  const infoChunk =
    lists === null || lists === void 0
      ? void 0
      : lists.find((c) => c.format === "INFO")

  if (infoChunk != null) {
    infoChunk.subChunks.forEach((c) => {
      switch (c.chunkId) {
        case "INAM":
          title = riff.bytes.peekText(
            c.chunkData.end - c.chunkData.start,
            c.chunkData.start,
          )
          break
        case "IART":
          artist = riff.bytes.peekText(
            c.chunkData.end - c.chunkData.start,
            c.chunkData.start,
          )
          break
        case "LIST":
          // Some cursors with an artist of "Created with Take ONE 3.5 (unregisterred version)" seem to have their frames here for some reason?
          if (c.format === "fram") {
            images = readImages(c, metadata.nFrames)
          }
          break
        default:
        // Unexpected subchunk
      }
    })
  }

  return { images, rate, seq, metadata, artist, title }
}

/**
 * @param {Uint8Array} aniBinary
 * @returns {AniCursorImage}
 */
export function readAni(aniBinary) {
  const ani = parseAni(aniBinary)
  const rate = ani.rate ?? ani.images.map(() => ani.metadata.iDispRate)
  const duration = sum(rate)

  const frames = ani.images.map((image) => ({
    url: curUrlFromByteArray(image),
    percents: /** @type {number[]} */ [],
  }))

  let elapsed = 0
  rate.forEach((r, i) => {
    const frameIdx = ani.seq ? ani.seq[i] : i
    frames[frameIdx].percents.push((elapsed / duration) * 100)
    elapsed += r
  })

  return { duration: duration * JIFFIES_PER_MS, frames }
}

/**
 * Generate CSS for an animated cursor.
 *
 * @param {string} cursor
 * @param {Uint8Array} aniBinary
 * @returns {string}
 */
export function generateCursorCSS(cursor, aniBinary) {
  const ani = readAni(aniBinary)
  const animationName = `${cursor}-ani`

  let firstURL

  const keyframes = ani.frames.map(({ url, percents }) => {
    const percent = percents.map((num) => `${num}%`).join(", ")
    firstURL ??= url
    return `${percent} {
    --${cursor}: url("${url}"), auto;
    --cursor: var(--${cursor});
  }`
  })

  return `
@keyframes ${animationName} {
  ${keyframes.join("\n  ")}
}
:root {
  --${cursor}: url("${firstURL}"), auto;
  --${cursor}-ani: ${animationName} ${ani.duration}ms step-end infinite;
}
.${cursor}:hover {
  --cursor: var(--${cursor});
  animation: var(--${cursor}-ani);
}`
}
