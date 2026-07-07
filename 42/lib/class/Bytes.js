/* eslint-disable no-unused-expressions */

// @read https://github.com/tc39/proposal-resizablearraybuffer
// @read https://chromestatus.com/feature/4668361878274048
// @read https://deno.land/std@0.179.0/streams/buffer.ts?source

import { equalsArrayBufferView } from "../type/binary/equalsArrayBufferView.js"

const isLittleEndianMachine =
  new Uint8Array(new Uint16Array([1]).buffer)[0] === 1

const supportResize = ArrayBuffer.prototype.resize !== undefined

const MAX_BYTE_LENGTH = 0x40_00_00_00 // 1GB
const MEMORY_PAGE = 0x01_00_00

export class Bytes {
  #arr
  #length
  decoderOptions

  static isLittleEndianMachine = isLittleEndianMachine

  static from(value) {
    const buffer = new Bytes()
    if (value == null) return buffer
    if (typeof value === "string") buffer.writeText(value)
    else buffer.write(value)
    return buffer
  }

  static alloc(length) {
    return new Bytes({ length })
  }

  static equals(a, b) {
    return equalsArrayBufferView(a, b)
  }

  constructor(options) {
    options = typeof options === "number" ? { length: options } : options
    const length = options?.length ?? 0

    this.memory = supportResize
      ? {
          buffer: new ArrayBuffer(length, {
            maxByteLength:
              length > 0 //
                ? length
                : (options?.maxByteLength ?? MAX_BYTE_LENGTH),
          }),
        }
      : new WebAssembly.Memory({
          initial: 1 + Math.ceil((length - MEMORY_PAGE) / MEMORY_PAGE),
        })
    this.#arr = new Uint8Array(this.memory.buffer)
    this.#length = length
    this.writeOffset = 0
    this.offset = 0

    this.encoding = options?.encoding ?? "utf8"
    if (options?.fatal !== undefined) {
      this.decoderOptions ??= {}
      this.decoderOptions.fatal = options?.fatal
    }

    if (options?.ignoreBOM !== undefined) {
      this.decoderOptions ??= {}
      this.decoderOptions.ignoreBOM = options?.ignoreBOM
    }
  }

  get byteLength() {
    return this.#length
  }
  get length() {
    return this.#length
  }
  set length(n) {
    this.#length = n
    this.writeOffset = n
    if (n > this.memory.buffer.byteLength) {
      if (supportResize) {
        this.memory.buffer.resize(n)
      } else {
        const remain = n - this.memory.buffer.byteLength
        // @ts-ignore
        this.memory.grow(Math.ceil(remain / MEMORY_PAGE))
        this.#arr = new Uint8Array(this.memory.buffer)
        this.#view = undefined
      }
    }
  }

  /** @type {DataView | undefined} */
  #view
  get view() {
    this.#view ??= new DataView(this.memory.buffer)
    return this.#view
  }

  get buffer() {
    return this.memory.buffer
  }
  get value() {
    return this.memory.buffer.slice(0, this.#length)
  }

  go(offset = 0) {
    this.offset = offset
    return this
  }

  toArrayBuffer(start = 0, end = this.length) {
    return this.memory.buffer.slice(start, end)
  }

  at(n) {
    const abs = Math.abs(n)
    if (abs >= this.#length) return
    return n < 0 ? this.#arr.at(this.#length + n) : this.#arr.at(n)
  }
  indexOf(value) {
    return this.#arr.indexOf(value)
  }
  fill(value, start = 0, end = this.length) {
    return this.#arr.fill(value, start, end)
  }
  subarray(start = 0, end = this.length) {
    return this.#arr.subarray(start, end)
  }
  slice(start = 0, end = this.length) {
    return new Uint8Array(this.memory.buffer.slice(start, end))
  }

  // MARK: byte
  writeByte(value, writeOffset = this.writeOffset) {
    const len = writeOffset + 1
    if (len > this.length) this.length = len
    this.#arr[writeOffset] = value
    return 1
  }
  readByte(offset = this.offset) {
    this.offset = offset + 1
    return this.#arr[offset]
  }
  peekByte(offset = this.offset) {
    return this.#arr[offset]
  }

  // MARK: bytes
  write(value, writeOffset = this.writeOffset) {
    const len = writeOffset + value.byteLength
    if (len > this.#length) this.length = len
    this.#arr.set(new Uint8Array(value), writeOffset)
    return Uint8Array.BYTES_PER_ELEMENT
  }
  read(length, offset = this.offset) {
    const arr = this.#arr.subarray(offset, offset + length)
    this.offset = offset + arr.byteLength
    return arr
  }
  peek(length, offset = this.offset) {
    return this.#arr.subarray(offset, offset + length)
  }

  // MARK: string
  #encoder
  get encoder() {
    this.#encoder ??= new TextEncoder()
    return this.#encoder
  }

  #decoder
  get decoder() {
    this.#decoder ??= new TextDecoder(this.encoding, this.decoderOptions)
    return this.#decoder
  }

  writeText(string, writeOffset = this.writeOffset) {
    const arr = this.encoder.encode(string)
    const len = writeOffset + arr.byteLength
    if (len > this.#length) this.length = len
    this.#arr.set(arr, writeOffset)
  }
  readText(length, offset = this.offset, encoding) {
    if (offset >= this.#length) return
    const end =
      length === undefined
        ? this.length
        : Math.min(offset + length, this.length)
    const arr = this.memory.buffer.slice(offset, end)
    if (end < this.offset) this.#decoder = undefined // reset decoder stream position
    this.offset = end
    const decoder = encoding ? new TextDecoder(encoding) : this.decoder
    return decoder.decode(arr, { stream: true })
  }
  peekText(length, offset = this.offset, encoding) {
    if (offset >= this.#length) return
    const end =
      length === undefined
        ? this.length
        : Math.min(offset + length, this.length)
    const arr = this.memory.buffer.slice(offset, end)
    const decoder = encoding ? new TextDecoder(encoding) : this.decoder
    return decoder.decode(arr)
  }

  [Symbol.iterator]() {
    return this.#arr.subarray(0, this.#length)[Symbol.iterator]()
  }

  [Symbol.toPrimitive]() {
    return this.decoder.decode(this.memory.buffer.slice(0, this.#length))
  }

  toString() {
    return this[Symbol.toPrimitive]()
  }
}

const p = Bytes.prototype

p.writeUint8 = p.writeByte
p.readUint8 = p.readByte
p.peekUint8 = p.peekByte

p.writeUint8Array = p.write
p.readUint8Array = p.read
p.peekUint8Array = p.peek

p.toUint8Array = p.slice

for (const getKey of Reflect.ownKeys(DataView.prototype)) {
  if (
    typeof getKey === "string" &&
    getKey.startsWith("get") &&
    getKey !== "getUint8"
  ) {
    const key = getKey.slice(3)
    const arrayKey = `${key}Array`
    if (!(arrayKey in globalThis)) {
      console.log(arrayKey)
      continue
    }
    const { BYTES_PER_ELEMENT } = globalThis[arrayKey]
    const setKey = `set${key}`

    /** @this {Bytes} */
    p[`write${key}`] = function (
      value,
      writeOffset = this.writeOffset,
      littleEndian,
    ) {
      const len = writeOffset + BYTES_PER_ELEMENT
      if (len > this.length) this.length = len
      this.view[setKey](writeOffset, value, littleEndian)
      return BYTES_PER_ELEMENT
    }

    /** @this {Bytes} */
    p[`read${key}`] = function (offset = this.offset, littleEndian) {
      this.offset = offset + BYTES_PER_ELEMENT
      return this.view[getKey](offset, littleEndian)
    }

    /** @this {Bytes} */
    p[`peek${key}`] = function (offset = this.offset, littleEndian) {
      return this.view[getKey](offset, littleEndian)
    }

    /** @this {Bytes} */
    p[`read${key}Array`] = function (
      length,
      offset = this.offset,
      littleEndian,
    ) {
      const arr = this[`to${key}Array`](offset, offset + length, littleEndian)
      this.offset = arr.byteLength
      return arr
    }

    /** @this {Bytes} */
    p[`peek${key}Array`] = function (
      length,
      offset = this.offset,
      littleEndian,
    ) {
      return this[`to${key}Array`](offset, offset + length, littleEndian)
    }

    /** @this {Bytes} */
    p[`to${key}Array`] = function (start = 0, end = this.length, littleEndian) {
      const length = (end - start) / BYTES_PER_ELEMENT
      const arr = new globalThis[arrayKey](length)
      const dataview = this.view

      for (let i = 0; i < length; i++) {
        arr[i] = dataview[getKey](start + i * BYTES_PER_ELEMENT, littleEndian)
      }

      return arr
    }
  }
}

/** @typedef {(value: any, writeOffset?: number, littleEndian?: boolean) => number} WriteFn */
/** @typedef {(offset?: number, littleEndian?: boolean) => number} ReadFn */
/** @typedef {(value: any, writeOffset?: number) => number} WriteArrayFn */
/** @typedef {(length: number, offset?: number, littleEndian?: boolean) => number} ReadArrayFn */
/** @typedef {(start?: number, end?: number, littleEndian?: boolean) => number} ToArrayFn */

/** @type {WriteFn} */ Bytes.prototype.writeUint8
/** @type {WriteFn} */ Bytes.prototype.writeUint16
/** @type {WriteFn} */ Bytes.prototype.writeUint32
/** @type {WriteFn} */ Bytes.prototype.writeInt8
/** @type {WriteFn} */ Bytes.prototype.writeInt16
/** @type {WriteFn} */ Bytes.prototype.writeInt32
/** @type {WriteFn} */ Bytes.prototype.writeFloat16
/** @type {WriteFn} */ Bytes.prototype.writeFloat32
/** @type {WriteFn} */ Bytes.prototype.writeFloat64
/** @type {WriteFn} */ Bytes.prototype.writeBigUint64
/** @type {WriteFn} */ Bytes.prototype.writeBigInt64

/** @type {ReadFn} */ Bytes.prototype.readUint8
/** @type {ReadFn} */ Bytes.prototype.readUint16
/** @type {ReadFn} */ Bytes.prototype.readUint32
/** @type {ReadFn} */ Bytes.prototype.readInt8
/** @type {ReadFn} */ Bytes.prototype.readInt16
/** @type {ReadFn} */ Bytes.prototype.readInt32
/** @type {ReadFn} */ Bytes.prototype.readFloat16
/** @type {ReadFn} */ Bytes.prototype.readFloat32
/** @type {ReadFn} */ Bytes.prototype.readFloat64
/** @type {ReadFn} */ Bytes.prototype.readBigUint64
/** @type {ReadFn} */ Bytes.prototype.readBigInt64

/** @type {ReadFn} */ Bytes.prototype.peekUint8
/** @type {ReadFn} */ Bytes.prototype.peekUint16
/** @type {ReadFn} */ Bytes.prototype.peekUint32
/** @type {ReadFn} */ Bytes.prototype.peekInt8
/** @type {ReadFn} */ Bytes.prototype.peekInt16
/** @type {ReadFn} */ Bytes.prototype.peekInt32
/** @type {ReadFn} */ Bytes.prototype.peekFloat16
/** @type {ReadFn} */ Bytes.prototype.peekFloat32
/** @type {ReadFn} */ Bytes.prototype.peekFloat64
/** @type {ReadFn} */ Bytes.prototype.peekBigUint64
/** @type {ReadFn} */ Bytes.prototype.peekBigInt64

/** @type {WriteArrayFn} */ Bytes.prototype.writeUint8Array

/** @type {typeof p.read} */ Bytes.prototype.readUint8Array
/** @type {ReadArrayFn} */ Bytes.prototype.readUint16Array
/** @type {ReadArrayFn} */ Bytes.prototype.readUint32Array
/** @type {ReadArrayFn} */ Bytes.prototype.readInt8Array
/** @type {ReadArrayFn} */ Bytes.prototype.readInt16Array
/** @type {ReadArrayFn} */ Bytes.prototype.readInt32Array
/** @type {ReadArrayFn} */ Bytes.prototype.readFloat16Array
/** @type {ReadArrayFn} */ Bytes.prototype.readFloat32Array
/** @type {ReadArrayFn} */ Bytes.prototype.readFloat64Array
/** @type {ReadArrayFn} */ Bytes.prototype.readBigUint64Array
/** @type {ReadArrayFn} */ Bytes.prototype.readBigInt64Array

/** @type {typeof p.peek} */ Bytes.prototype.peekUint8Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekUint16Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekUint32Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekInt8Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekInt16Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekInt32Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekFloat16Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekFloat32Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekFloat64Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekBigUint64Array
/** @type {ReadArrayFn} */ Bytes.prototype.peekBigInt64Array

/** @type {typeof p.slice} */ Bytes.prototype.toUint8Array
/** @type {ToArrayFn} */ Bytes.prototype.toUint16Array
/** @type {ToArrayFn} */ Bytes.prototype.toUint32Array
/** @type {ToArrayFn} */ Bytes.prototype.toInt8Array
/** @type {ToArrayFn} */ Bytes.prototype.toInt16Array
/** @type {ToArrayFn} */ Bytes.prototype.toInt32Array
/** @type {ToArrayFn} */ Bytes.prototype.toFloat16Array
/** @type {ToArrayFn} */ Bytes.prototype.toFloat32Array
/** @type {ToArrayFn} */ Bytes.prototype.toFloat64Array
/** @type {ToArrayFn} */ Bytes.prototype.toBigUint64Array
/** @type {ToArrayFn} */ Bytes.prototype.toBigInt64Array
