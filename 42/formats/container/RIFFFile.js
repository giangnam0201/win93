//! Copyright (c) 2017-2019 Rafael da Silva Rocha. MIT License.
// @src https://github.com/rochars/riff-file

import { Bytes } from "../../lib/class/Bytes.js"

/**
 * A class to perform low-level reading of RIFF/RIFX files.
 */
export class RIFFFile {
  /**
   * The container identifier.
   * 'RIFF', 'RIFX' and 'RF64' are supported.
   * @type {string}
   */
  container = ""

  /**
   * The main chunk size, in bytes.
   * @type {number}
   */
  chunkSize = 0

  /**
   * The format identifier.
   * @type {string}
   */
  format = ""

  /**
   * An object representing the signature of all chunks in the file.
   * @type {{
   *   chunkId: string,
   *   chunkSize: number,
   *   format: string,
   *   chunkData: {start: number, end: number},
   *   subChunks: Array
   * } | null}
   */
  signature = null

  /**
   * @type {number}
   * @protected
   */
  head = 0

  /**
   * @type {{bits: number, be: boolean, signed: boolean, fp: boolean}}
   * @protected
   */
  // uInt32 = { bits: 32, be: false, signed: false, fp: false }

  /**
   * The list of supported containers.
   * Any format different from RIFX will be treated as RIFF.
   * @type {!Array<string>}
   */
  supportedContainers = ["RIFF", "RIFX"]

  constructor(buffer) {
    if (buffer) this.setSignature(buffer)
  }

  /**
   * Read the signature of the chunks in a RIFF/RIFX file.
   * @param {!Uint8Array} buffer The file bytes.
   */
  setSignature(buffer) {
    this.bytes = Bytes.from(buffer)
    this.head = 0
    this.container = this.readString(4)
    if (!this.supportedContainers.includes(this.container)) {
      throw new Error("Not a supported format.")
    }

    this.littleEndian = this.container !== "RIFX"
    this.chunkSize = this.readUint32()
    this.format = this.readString(4)

    // The RIFF file signature
    this.signature = {
      chunkId: this.container,
      chunkSize: this.chunkSize,
      format: this.format,
      subChunks: this.#getSubChunksIndex(),
      chunkData: { start: 0, end: this.chunkSize },
    }
  }

  /**
   * Find a chunk by its fourCC_ in a array of RIFF chunks.
   * @param {string} chunkId The chunk fourCC_.
   * @param {boolean} multiple True if there may be multiple chunks
   *    with the same chunkId.
   * @returns {object}
   */
  findChunk(chunkId, multiple = false) {
    const chunks = this.signature.subChunks
    const chunk = []

    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].chunkId === chunkId) {
        if (multiple) {
          chunk.push(chunks[i])
        } else {
          return chunks[i]
        }
      }
    }

    if (chunkId === "LIST") return chunk.length > 0 ? chunk : undefined
  }

  /**
   * Read bytes as a string from a RIFF chunk.
   * @param {number} maxSize The max size of the string.
   * @returns {string} The string.
   * @protected
   */
  readString(maxSize) {
    let str = ""
    str = this.bytes.readText(maxSize, this.head)
    this.head += maxSize
    return str
  }

  /**
   * Read a number from a chunk.
   * @returns {number} The number.
   * @protected
   */
  readUint32() {
    const value = this.bytes.readUint32(this.head, this.littleEndian)
    this.head += 4
    return value
  }

  /**
   * Return the sub chunks of a RIFF file.
   * @returns {!Array<object>} The subchunks of a RIFF/RIFX or LIST chunk.
   */
  #getSubChunksIndex() {
    const chunks = []
    let i = this.head
    while (i <= this.bytes.length - 8) {
      chunks.push(this.#getSubChunkIndex(i))
      i += 8 + chunks[chunks.length - 1].chunkSize
      i = i % 2 ? i + 1 : i
    }
    return chunks
  }

  /**
   * Return a sub chunk from a RIFF file.
   * @param {number} index The start index of the chunk.
   * @returns {!object} A subchunk of a RIFF/RIFX or LIST chunk.
   */
  #getSubChunkIndex(index) {
    const chunk = {
      chunkId: this.#getChunkId(index),
      chunkSize: this.#getChunkSize(index),
    }

    if (chunk.chunkId === "LIST") {
      chunk.format = this.bytes.readText(4, index + 8)
      this.head += 4
      chunk.subChunks = this.#getSubChunksIndex()
    } else {
      const realChunkSize =
        chunk.chunkSize % 2 ? chunk.chunkSize + 1 : chunk.chunkSize
      this.head = index + 8 + realChunkSize
      chunk.chunkData = {
        start: index + 8,
        end: this.head,
      }
    }
    return chunk
  }

  /**
   * Return the fourCC_ of a chunk.
   * @param {number} index The start index of the chunk.
   * @returns {string} The id of the chunk.
   */
  #getChunkId(index) {
    this.head += 4
    return this.bytes.readText(4, index)
  }

  /**
   * Return the size of a chunk.
   * @param {number} index The start index of the chunk.
   * @returns {number} The size of the chunk without the id and size fields.
   */
  #getChunkSize(index) {
    this.head += 4
    return this.bytes.readUint32(index + 4, this.littleEndian)
  }
}
