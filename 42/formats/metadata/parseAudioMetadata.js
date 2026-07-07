/* eslint-disable */

const defaultMessages$1 = "End-Of-Stream"
/**
 * Thrown on read operation of the end of file or stream has been reached
 */
let EndOfStreamError$1 = class EndOfStreamError extends Error {
  constructor() {
    super(defaultMessages$1)
    this.name = "EndOfStreamError"
  }
}
class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message)
    this.name = "AbortError"
  }
}

let AbstractStreamReader$1 = class AbstractStreamReader {
  constructor() {
    /**
     * Maximum request length on read-stream operation
     */
    this.maxStreamReadSize = 1 * 1024 * 1024
    this.endOfStream = false
    this.interrupted = false
    /**
     * Store peeked data
     * @type {Array}
     */
    this.peekQueue = []
  }
  async peek(uint8Array, offset, length) {
    const bytesRead = await this.read(uint8Array, offset, length)
    this.peekQueue.push(uint8Array.subarray(offset, offset + bytesRead)) // Put read data back to peek buffer
    return bytesRead
  }
  async read(buffer, offset, length) {
    if (length === 0) {
      return 0
    }
    let bytesRead = this.readFromPeekBuffer(buffer, offset, length)
    bytesRead += await this.readRemainderFromStream(
      buffer,
      offset + bytesRead,
      length - bytesRead,
    )
    if (bytesRead === 0) {
      throw new EndOfStreamError$1()
    }
    return bytesRead
  }
  /**
   * Read chunk from stream
   * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
   * @param offset - Offset target
   * @param length - Number of bytes to read
   * @returns Number of bytes read
   */
  readFromPeekBuffer(buffer, offset, length) {
    let remaining = length
    let bytesRead = 0
    // consume peeked data first
    while (this.peekQueue.length > 0 && remaining > 0) {
      const peekData = this.peekQueue.pop() // Front of queue
      if (!peekData) throw new Error("peekData should be defined")
      const lenCopy = Math.min(peekData.length, remaining)
      buffer.set(peekData.subarray(0, lenCopy), offset + bytesRead)
      bytesRead += lenCopy
      remaining -= lenCopy
      if (lenCopy < peekData.length) {
        // remainder back to queue
        this.peekQueue.push(peekData.subarray(lenCopy))
      }
    }
    return bytesRead
  }
  async readRemainderFromStream(buffer, offset, initialRemaining) {
    let remaining = initialRemaining
    let bytesRead = 0
    // Continue reading from stream if required
    while (remaining > 0 && !this.endOfStream) {
      const reqLen = Math.min(remaining, this.maxStreamReadSize)
      if (this.interrupted) {
        throw new AbortError()
      }
      const chunkLen = await this.readFromStream(
        buffer,
        offset + bytesRead,
        reqLen,
      )
      if (chunkLen === 0) break
      bytesRead += chunkLen
      remaining -= chunkLen
    }
    return bytesRead
  }
}

let WebStreamReader$1 = class WebStreamReader extends AbstractStreamReader$1 {
  constructor(reader) {
    super()
    this.reader = reader
  }
  async abort() {
    return this.close()
  }
  async close() {
    this.reader.releaseLock()
  }
}

/**
 * Read from a WebStream using a BYOB reader
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
class WebStreamByobReader extends WebStreamReader$1 {
  async readFromStream(buffer, offset, length) {
    const result = await this.reader.read(new Uint8Array(length))
    if (result.done) {
      this.endOfStream = result.done
    }
    if (result.value) {
      buffer.set(result.value, offset)
      return result.value.byteLength
    }
    return 0
  }
}

class WebStreamDefaultReader extends AbstractStreamReader$1 {
  constructor(reader) {
    super()
    this.reader = reader
    this.buffer = null // Internal buffer to store excess data
    this.bufferOffset = 0 // Current position in the buffer
  }
  async readFromStream(buffer, offset, length) {
    let totalBytesRead = 0
    // Serve from the internal buffer first
    if (this.buffer) {
      const remainingInBuffer = this.buffer.byteLength - this.bufferOffset
      const toCopy = Math.min(remainingInBuffer, length)
      buffer.set(
        this.buffer.subarray(this.bufferOffset, this.bufferOffset + toCopy),
        offset,
      )
      this.bufferOffset += toCopy
      totalBytesRead += toCopy
      length -= toCopy
      offset += toCopy
      // If the buffer is exhausted, clear it
      if (this.bufferOffset >= this.buffer.byteLength) {
        this.buffer = null
        this.bufferOffset = 0
      }
    }
    // Continue reading from the stream if more data is needed
    while (length > 0 && !this.endOfStream) {
      const result = await this.reader.read()
      if (result.done) {
        this.endOfStream = true
        break
      }
      if (result.value) {
        const chunk = result.value
        // If the chunk is larger than the requested length, store the excess
        if (chunk.byteLength > length) {
          buffer.set(chunk.subarray(0, length), offset)
          this.buffer = chunk
          this.bufferOffset = length // Keep track of the unconsumed part
          totalBytesRead += length
          return totalBytesRead
        }
        // Otherwise, consume the entire chunk
        buffer.set(chunk, offset)
        totalBytesRead += chunk.byteLength
        length -= chunk.byteLength
        offset += chunk.byteLength
      }
    }
    if (totalBytesRead === 0 && this.endOfStream) {
      throw new EndOfStreamError$1()
    }
    return totalBytesRead
  }
  abort() {
    this.interrupted = true
    return this.reader.cancel()
  }
  async close() {
    await this.abort()
    this.reader.releaseLock()
  }
}

function makeWebStreamReader(stream) {
  try {
    const reader = stream.getReader({ mode: "byob" })
    if (reader instanceof ReadableStreamDefaultReader) {
      // Fallback to default reader in case `mode: byob` is ignored
      return new WebStreamDefaultReader(reader)
    }
    return new WebStreamByobReader(reader)
  } catch (error) {
    if (error instanceof TypeError) {
      // Fallback to default reader in case `mode: byob` rejected by a `TypeError`
      return new WebStreamDefaultReader(stream.getReader())
    }
    throw error
  }
}

/**
 * Core tokenizer
 */
let AbstractTokenizer$1 = class AbstractTokenizer {
  /**
   * Constructor
   * @param options Tokenizer options
   * @protected
   */
  constructor(options) {
    this.numBuffer = new Uint8Array(8)
    /**
     * Tokenizer-stream position
     */
    this.position = 0
    this.onClose = options?.onClose
    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        this.abort()
      })
    }
  }
  /**
   * Read a token from the tokenizer-stream
   * @param token - The token to read
   * @param position - If provided, the desired position in the tokenizer-stream
   * @returns Promise with token data
   */
  async readToken(token, position = this.position) {
    const uint8Array = new Uint8Array(token.len)
    const len = await this.readBuffer(uint8Array, { position })
    if (len < token.len) throw new EndOfStreamError$1()
    return token.get(uint8Array, 0)
  }
  /**
   * Peek a token from the tokenizer-stream.
   * @param token - Token to peek from the tokenizer-stream.
   * @param position - Offset where to begin reading within the file. If position is null, data will be read from the current file position.
   * @returns Promise with token data
   */
  async peekToken(token, position = this.position) {
    const uint8Array = new Uint8Array(token.len)
    const len = await this.peekBuffer(uint8Array, { position })
    if (len < token.len) throw new EndOfStreamError$1()
    return token.get(uint8Array, 0)
  }
  /**
   * Read a numeric token from the stream
   * @param token - Numeric token
   * @returns Promise with number
   */
  async readNumber(token) {
    const len = await this.readBuffer(this.numBuffer, { length: token.len })
    if (len < token.len) throw new EndOfStreamError$1()
    return token.get(this.numBuffer, 0)
  }
  /**
   * Read a numeric token from the stream
   * @param token - Numeric token
   * @returns Promise with number
   */
  async peekNumber(token) {
    const len = await this.peekBuffer(this.numBuffer, { length: token.len })
    if (len < token.len) throw new EndOfStreamError$1()
    return token.get(this.numBuffer, 0)
  }
  /**
   * Ignore number of bytes, advances the pointer in under tokenizer-stream.
   * @param length - Number of bytes to ignore
   * @return resolves the number of bytes ignored, equals length if this available, otherwise the number of bytes available
   */
  async ignore(length) {
    if (this.fileInfo.size !== undefined) {
      const bytesLeft = this.fileInfo.size - this.position
      if (length > bytesLeft) {
        this.position += bytesLeft
        return bytesLeft
      }
    }
    this.position += length
    return length
  }
  async close() {
    await this.abort()
    await this.onClose?.()
  }
  normalizeOptions(uint8Array, options) {
    if (
      !this.supportsRandomAccess() &&
      options &&
      options.position !== undefined &&
      options.position < this.position
    ) {
      throw new Error(
        "`options.position` must be equal or greater than `tokenizer.position`",
      )
    }
    return {
      ...{
        mayBeLess: false,
        offset: 0,
        length: uint8Array.length,
        position: this.position,
      },
      ...options,
    }
  }
  abort() {
    return Promise.resolve() // Ignore abort signal
  }
}

const maxBufferSize$1 = 256000
let ReadStreamTokenizer$1 = class ReadStreamTokenizer extends AbstractTokenizer$1 {
  /**
   * Constructor
   * @param streamReader stream-reader to read from
   * @param options Tokenizer options
   */
  constructor(streamReader, options) {
    super(options)
    this.streamReader = streamReader
    this.fileInfo = options?.fileInfo ?? {}
  }
  /**
   * Read buffer from tokenizer
   * @param uint8Array - Target Uint8Array to fill with data read from the tokenizer-stream
   * @param options - Read behaviour options
   * @returns Promise with number of bytes read
   */
  async readBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options)
    const skipBytes = normOptions.position - this.position
    if (skipBytes > 0) {
      await this.ignore(skipBytes)
      return this.readBuffer(uint8Array, options)
    }
    if (skipBytes < 0) {
      throw new Error(
        "`options.position` must be equal or greater than `tokenizer.position`",
      )
    }
    if (normOptions.length === 0) {
      return 0
    }
    const bytesRead = await this.streamReader.read(
      uint8Array,
      0,
      normOptions.length,
    )
    this.position += bytesRead
    if ((!options || !options.mayBeLess) && bytesRead < normOptions.length) {
      throw new EndOfStreamError$1()
    }
    return bytesRead
  }
  /**
   * Peek (read ahead) buffer from tokenizer
   * @param uint8Array - Uint8Array (or Buffer) to write data to
   * @param options - Read behaviour options
   * @returns Promise with number of bytes peeked
   */
  async peekBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options)
    let bytesRead = 0
    if (normOptions.position) {
      const skipBytes = normOptions.position - this.position
      if (skipBytes > 0) {
        const skipBuffer = new Uint8Array(normOptions.length + skipBytes)
        bytesRead = await this.peekBuffer(skipBuffer, {
          mayBeLess: normOptions.mayBeLess,
        })
        uint8Array.set(skipBuffer.subarray(skipBytes))
        return bytesRead - skipBytes
      }
      if (skipBytes < 0) {
        throw new Error("Cannot peek from a negative offset in a stream")
      }
    }
    if (normOptions.length > 0) {
      try {
        bytesRead = await this.streamReader.peek(
          uint8Array,
          0,
          normOptions.length,
        )
      } catch (err) {
        if (options?.mayBeLess && err instanceof EndOfStreamError$1) {
          return 0
        }
        throw err
      }
      if (!normOptions.mayBeLess && bytesRead < normOptions.length) {
        throw new EndOfStreamError$1()
      }
    }
    return bytesRead
  }
  async ignore(length) {
    // debug(`ignore ${this.position}...${this.position + length - 1}`);
    const bufSize = Math.min(maxBufferSize$1, length)
    const buf = new Uint8Array(bufSize)
    let totBytesRead = 0
    while (totBytesRead < length) {
      const remaining = length - totBytesRead
      const bytesRead = await this.readBuffer(buf, {
        length: Math.min(bufSize, remaining),
      })
      if (bytesRead < 0) {
        return bytesRead
      }
      totBytesRead += bytesRead
    }
    return totBytesRead
  }
  abort() {
    return this.streamReader.abort()
  }
  async close() {
    return this.streamReader.close()
  }
  supportsRandomAccess() {
    return false
  }
}

let BufferTokenizer$1 = class BufferTokenizer extends AbstractTokenizer$1 {
  /**
   * Construct BufferTokenizer
   * @param uint8Array - Uint8Array to tokenize
   * @param options Tokenizer options
   */
  constructor(uint8Array, options) {
    super(options)
    this.uint8Array = uint8Array
    this.fileInfo = {
      ...(options?.fileInfo ?? {}),
      ...{ size: uint8Array.length },
    }
  }
  /**
   * Read buffer from tokenizer
   * @param uint8Array - Uint8Array to tokenize
   * @param options - Read behaviour options
   * @returns {Promise<number>}
   */
  async readBuffer(uint8Array, options) {
    if (options?.position) {
      this.position = options.position
    }
    const bytesRead = await this.peekBuffer(uint8Array, options)
    this.position += bytesRead
    return bytesRead
  }
  /**
   * Peek (read ahead) buffer from tokenizer
   * @param uint8Array
   * @param options - Read behaviour options
   * @returns {Promise<number>}
   */
  async peekBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options)
    const bytes2read = Math.min(
      this.uint8Array.length - normOptions.position,
      normOptions.length,
    )
    if (!normOptions.mayBeLess && bytes2read < normOptions.length) {
      throw new EndOfStreamError$1()
    }
    uint8Array.set(
      this.uint8Array.subarray(
        normOptions.position,
        normOptions.position + bytes2read,
      ),
    )
    return bytes2read
  }
  close() {
    return super.close()
  }
  supportsRandomAccess() {
    return true
  }
  setPosition(position) {
    this.position = position
  }
}

/**
 * Construct ReadStreamTokenizer from given ReadableStream (WebStream API).
 * Will set fileSize, if provided given Stream has set the .path property/
 * @param webStream - Read from Node.js Stream.Readable (must be a byte stream)
 * @param options - Tokenizer options
 * @returns ReadStreamTokenizer
 */
function fromWebStream$1(webStream, options) {
  const webStreamReader = makeWebStreamReader(webStream)
  const _options = options ?? {}
  const chainedClose = _options.onClose
  _options.onClose = async () => {
    await webStreamReader.close()
    if (chainedClose) {
      return chainedClose()
    }
  }
  return new ReadStreamTokenizer$1(webStreamReader, _options)
}
/**
 * Construct ReadStreamTokenizer from given Buffer.
 * @param uint8Array - Uint8Array to tokenize
 * @param options - Tokenizer options
 * @returns BufferTokenizer
 */
function fromBuffer$1(uint8Array, options) {
  return new BufferTokenizer$1(uint8Array, options)
}

function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default")
    ? x["default"]
    : x
}

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

var read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? nBytes - 1 : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << -nBits) - 1)
  s >>= -nBits
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << -nBits) - 1)
  e >>= -nBits
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : (s ? -1 : 1) * Infinity
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

var write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0
  var i = isLE ? 0 : nBytes - 1
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (
    ;
    mLen >= 8;
    buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8
  ) {}

  e = (e << mLen) | m
  eLen += mLen
  for (
    ;
    eLen > 0;
    buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8
  ) {}

  buffer[offset + i - d] |= s * 128
}

// Primitive types
function dv(array) {
  return new DataView(array.buffer, array.byteOffset)
}
/**
 * 8-bit unsigned integer
 */
const UINT8 = {
  len: 1,
  get(array, offset) {
    return dv(array).getUint8(offset)
  },
  put(array, offset, value) {
    dv(array).setUint8(offset, value)
    return offset + 1
  },
}
/**
 * 16-bit unsigned integer, Little Endian byte order
 */
const UINT16_LE = {
  len: 2,
  get(array, offset) {
    return dv(array).getUint16(offset, true)
  },
  put(array, offset, value) {
    dv(array).setUint16(offset, value, true)
    return offset + 2
  },
}
/**
 * 16-bit unsigned integer, Big Endian byte order
 */
const UINT16_BE = {
  len: 2,
  get(array, offset) {
    return dv(array).getUint16(offset)
  },
  put(array, offset, value) {
    dv(array).setUint16(offset, value)
    return offset + 2
  },
}
/**
 * 24-bit unsigned integer, Little Endian byte order
 */
const UINT24_LE = {
  len: 3,
  get(array, offset) {
    const dataView = dv(array)
    return (
      dataView.getUint8(offset) + (dataView.getUint16(offset + 1, true) << 8)
    )
  },
  put(array, offset, value) {
    const dataView = dv(array)
    dataView.setUint8(offset, value & 0xff)
    dataView.setUint16(offset + 1, value >> 8, true)
    return offset + 3
  },
}
/**
 * 24-bit unsigned integer, Big Endian byte order
 */
const UINT24_BE = {
  len: 3,
  get(array, offset) {
    const dataView = dv(array)
    return (dataView.getUint16(offset) << 8) + dataView.getUint8(offset + 2)
  },
  put(array, offset, value) {
    const dataView = dv(array)
    dataView.setUint16(offset, value >> 8)
    dataView.setUint8(offset + 2, value & 0xff)
    return offset + 3
  },
}
/**
 * 32-bit unsigned integer, Little Endian byte order
 */
const UINT32_LE = {
  len: 4,
  get(array, offset) {
    return dv(array).getUint32(offset, true)
  },
  put(array, offset, value) {
    dv(array).setUint32(offset, value, true)
    return offset + 4
  },
}
/**
 * 32-bit unsigned integer, Big Endian byte order
 */
const UINT32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getUint32(offset)
  },
  put(array, offset, value) {
    dv(array).setUint32(offset, value)
    return offset + 4
  },
}
/**
 * 8-bit signed integer
 */
const INT8 = {
  len: 1,
  get(array, offset) {
    return dv(array).getInt8(offset)
  },
  put(array, offset, value) {
    dv(array).setInt8(offset, value)
    return offset + 1
  },
}
/**
 * 16-bit signed integer, Big Endian byte order
 */
const INT16_BE = {
  len: 2,
  get(array, offset) {
    return dv(array).getInt16(offset)
  },
  put(array, offset, value) {
    dv(array).setInt16(offset, value)
    return offset + 2
  },
}
/**
 * 16-bit signed integer, Little Endian byte order
 */
const INT16_LE = {
  len: 2,
  get(array, offset) {
    return dv(array).getInt16(offset, true)
  },
  put(array, offset, value) {
    dv(array).setInt16(offset, value, true)
    return offset + 2
  },
}
/**
 * 24-bit signed integer, Little Endian byte order
 */
const INT24_LE = {
  len: 3,
  get(array, offset) {
    const unsigned = UINT24_LE.get(array, offset)
    return unsigned > 0x7fffff ? unsigned - 0x1000000 : unsigned
  },
  put(array, offset, value) {
    const dataView = dv(array)
    dataView.setUint8(offset, value & 0xff)
    dataView.setUint16(offset + 1, value >> 8, true)
    return offset + 3
  },
}
/**
 * 24-bit signed integer, Big Endian byte order
 */
const INT24_BE = {
  len: 3,
  get(array, offset) {
    const unsigned = UINT24_BE.get(array, offset)
    return unsigned > 0x7fffff ? unsigned - 0x1000000 : unsigned
  },
  put(array, offset, value) {
    const dataView = dv(array)
    dataView.setUint16(offset, value >> 8)
    dataView.setUint8(offset + 2, value & 0xff)
    return offset + 3
  },
}
/**
 * 32-bit signed integer, Big Endian byte order
 */
const INT32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getInt32(offset)
  },
  put(array, offset, value) {
    dv(array).setInt32(offset, value)
    return offset + 4
  },
}
/**
 * 32-bit signed integer, Big Endian byte order
 */
const INT32_LE = {
  len: 4,
  get(array, offset) {
    return dv(array).getInt32(offset, true)
  },
  put(array, offset, value) {
    dv(array).setInt32(offset, value, true)
    return offset + 4
  },
}
/**
 * 64-bit unsigned integer, Little Endian byte order
 */
const UINT64_LE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigUint64(offset, true)
  },
  put(array, offset, value) {
    dv(array).setBigUint64(offset, value, true)
    return offset + 8
  },
}
/**
 * 64-bit signed integer, Little Endian byte order
 */
const INT64_LE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigInt64(offset, true)
  },
  put(array, offset, value) {
    dv(array).setBigInt64(offset, value, true)
    return offset + 8
  },
}
/**
 * 64-bit unsigned integer, Big Endian byte order
 */
const UINT64_BE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigUint64(offset)
  },
  put(array, offset, value) {
    dv(array).setBigUint64(offset, value)
    return offset + 8
  },
}
/**
 * 64-bit signed integer, Big Endian byte order
 */
const INT64_BE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigInt64(offset)
  },
  put(array, offset, value) {
    dv(array).setBigInt64(offset, value)
    return offset + 8
  },
}
/**
 * IEEE 754 16-bit (half precision) float, big endian
 */
const Float16_BE = {
  len: 2,
  get(dataView, offset) {
    return read(dataView, offset, false, 10, this.len)
  },
  put(dataView, offset, value) {
    write(dataView, value, offset, false, 10, this.len)
    return offset + this.len
  },
}
/**
 * IEEE 754 16-bit (half precision) float, little endian
 */
const Float16_LE = {
  len: 2,
  get(array, offset) {
    return read(array, offset, true, 10, this.len)
  },
  put(array, offset, value) {
    write(array, value, offset, true, 10, this.len)
    return offset + this.len
  },
}
/**
 * IEEE 754 32-bit (single precision) float, big endian
 */
const Float32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getFloat32(offset)
  },
  put(array, offset, value) {
    dv(array).setFloat32(offset, value)
    return offset + 4
  },
}
/**
 * IEEE 754 32-bit (single precision) float, little endian
 */
const Float32_LE = {
  len: 4,
  get(array, offset) {
    return dv(array).getFloat32(offset, true)
  },
  put(array, offset, value) {
    dv(array).setFloat32(offset, value, true)
    return offset + 4
  },
}
/**
 * IEEE 754 64-bit (double precision) float, big endian
 */
const Float64_BE = {
  len: 8,
  get(array, offset) {
    return dv(array).getFloat64(offset)
  },
  put(array, offset, value) {
    dv(array).setFloat64(offset, value)
    return offset + 8
  },
}
/**
 * IEEE 754 64-bit (double precision) float, little endian
 */
const Float64_LE = {
  len: 8,
  get(array, offset) {
    return dv(array).getFloat64(offset, true)
  },
  put(array, offset, value) {
    dv(array).setFloat64(offset, value, true)
    return offset + 8
  },
}
/**
 * IEEE 754 80-bit (extended precision) float, big endian
 */
const Float80_BE = {
  len: 10,
  get(array, offset) {
    return read(array, offset, false, 63, this.len)
  },
  put(array, offset, value) {
    write(array, value, offset, false, 63, this.len)
    return offset + this.len
  },
}
/**
 * IEEE 754 80-bit (extended precision) float, little endian
 */
const Float80_LE = {
  len: 10,
  get(array, offset) {
    return read(array, offset, true, 63, this.len)
  },
  put(array, offset, value) {
    write(array, value, offset, true, 63, this.len)
    return offset + this.len
  },
}
/**
 * Ignore a given number of bytes
 */
class IgnoreType {
  /**
   * @param len number of bytes to ignore
   */
  constructor(len) {
    this.len = len
  }
  // ToDo: don't read, but skip data
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  get(array, off) {}
}
class Uint8ArrayType {
  constructor(len) {
    this.len = len
  }
  get(array, offset) {
    return array.subarray(offset, offset + this.len)
  }
}
/**
 * Consume a fixed number of bytes from the stream and return a string with a specified encoding.
 */
class StringType {
  constructor(len, encoding) {
    this.len = len
    this.encoding = encoding
    this.textDecoder = new TextDecoder(encoding)
  }
  get(uint8Array, offset) {
    return this.textDecoder.decode(
      uint8Array.subarray(offset, offset + this.len),
    )
  }
}
/**
 * ANSI Latin 1 String
 * Using windows-1252 / ISO 8859-1 decoding
 */
class AnsiStringType {
  constructor(len) {
    this.len = len
    this.textDecoder = new TextDecoder("windows-1252")
  }
  get(uint8Array, offset = 0) {
    return this.textDecoder.decode(
      uint8Array.subarray(offset, offset + this.len),
    )
  }
}

var Token = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  AnsiStringType: AnsiStringType,
  Float16_BE: Float16_BE,
  Float16_LE: Float16_LE,
  Float32_BE: Float32_BE,
  Float32_LE: Float32_LE,
  Float64_BE: Float64_BE,
  Float64_LE: Float64_LE,
  Float80_BE: Float80_BE,
  Float80_LE: Float80_LE,
  INT16_BE: INT16_BE,
  INT16_LE: INT16_LE,
  INT24_BE: INT24_BE,
  INT24_LE: INT24_LE,
  INT32_BE: INT32_BE,
  INT32_LE: INT32_LE,
  INT64_BE: INT64_BE,
  INT64_LE: INT64_LE,
  INT8: INT8,
  IgnoreType: IgnoreType,
  StringType: StringType,
  UINT16_BE: UINT16_BE,
  UINT16_LE: UINT16_LE,
  UINT24_BE: UINT24_BE,
  UINT24_LE: UINT24_LE,
  UINT32_BE: UINT32_BE,
  UINT32_LE: UINT32_LE,
  UINT64_BE: UINT64_BE,
  UINT64_LE: UINT64_LE,
  UINT8: UINT8,
  Uint8ArrayType: Uint8ArrayType,
})

const defaultMessages = "End-Of-Stream"
/**
 * Thrown on read operation of the end of file or stream has been reached
 */
class EndOfStreamError extends Error {
  constructor() {
    super(defaultMessages)
  }
}

class AbstractStreamReader {
  constructor() {
    /**
     * Maximum request length on read-stream operation
     */
    this.maxStreamReadSize = 1 * 1024 * 1024
    this.endOfStream = false
    /**
     * Store peeked data
     * @type {Array}
     */
    this.peekQueue = []
  }
  async peek(uint8Array, offset, length) {
    const bytesRead = await this.read(uint8Array, offset, length)
    this.peekQueue.push(uint8Array.subarray(offset, offset + bytesRead)) // Put read data back to peek buffer
    return bytesRead
  }
  async read(buffer, offset, length) {
    if (length === 0) {
      return 0
    }
    let bytesRead = this.readFromPeekBuffer(buffer, offset, length)
    bytesRead += await this.readRemainderFromStream(
      buffer,
      offset + bytesRead,
      length - bytesRead,
    )
    if (bytesRead === 0) {
      throw new EndOfStreamError()
    }
    return bytesRead
  }
  /**
   * Read chunk from stream
   * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
   * @param offset - Offset target
   * @param length - Number of bytes to read
   * @returns Number of bytes read
   */
  readFromPeekBuffer(buffer, offset, length) {
    let remaining = length
    let bytesRead = 0
    // consume peeked data first
    while (this.peekQueue.length > 0 && remaining > 0) {
      const peekData = this.peekQueue.pop() // Front of queue
      if (!peekData) throw new Error("peekData should be defined")
      const lenCopy = Math.min(peekData.length, remaining)
      buffer.set(peekData.subarray(0, lenCopy), offset + bytesRead)
      bytesRead += lenCopy
      remaining -= lenCopy
      if (lenCopy < peekData.length) {
        // remainder back to queue
        this.peekQueue.push(peekData.subarray(lenCopy))
      }
    }
    return bytesRead
  }
  async readRemainderFromStream(buffer, offset, initialRemaining) {
    let remaining = initialRemaining
    let bytesRead = 0
    // Continue reading from stream if required
    while (remaining > 0 && !this.endOfStream) {
      const reqLen = Math.min(remaining, this.maxStreamReadSize)
      const chunkLen = await this.readFromStream(
        buffer,
        offset + bytesRead,
        reqLen,
      )
      if (chunkLen === 0) break
      bytesRead += chunkLen
      remaining -= chunkLen
    }
    return bytesRead
  }
}

/**
 * Read from a WebStream
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
class WebStreamReader extends AbstractStreamReader {
  constructor(stream) {
    super()
    this.reader = stream.getReader({ mode: "byob" })
  }
  async readFromStream(buffer, offset, length) {
    if (this.endOfStream) {
      throw new EndOfStreamError()
    }
    const result = await this.reader.read(new Uint8Array(length))
    if (result.done) {
      this.endOfStream = result.done
    }
    if (result.value) {
      buffer.set(result.value, offset)
      return result.value.byteLength
    }
    return 0
  }
  abort() {
    return this.reader.cancel() // Signals a loss of interest in the stream by a consumer
  }
  async close() {
    await this.abort()
    this.reader.releaseLock()
  }
}

/**
 * Core tokenizer
 */
class AbstractTokenizer {
  /**
   * Constructor
   * @param options Tokenizer options
   * @protected
   */
  constructor(options) {
    this.numBuffer = new Uint8Array(8)
    /**
     * Tokenizer-stream position
     */
    this.position = 0
    this.onClose = options?.onClose
    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        this.abort()
      })
    }
  }
  /**
   * Read a token from the tokenizer-stream
   * @param token - The token to read
   * @param position - If provided, the desired position in the tokenizer-stream
   * @returns Promise with token data
   */
  async readToken(token, position = this.position) {
    const uint8Array = new Uint8Array(token.len)
    const len = await this.readBuffer(uint8Array, { position })
    if (len < token.len) throw new EndOfStreamError()
    return token.get(uint8Array, 0)
  }
  /**
   * Peek a token from the tokenizer-stream.
   * @param token - Token to peek from the tokenizer-stream.
   * @param position - Offset where to begin reading within the file. If position is null, data will be read from the current file position.
   * @returns Promise with token data
   */
  async peekToken(token, position = this.position) {
    const uint8Array = new Uint8Array(token.len)
    const len = await this.peekBuffer(uint8Array, { position })
    if (len < token.len) throw new EndOfStreamError()
    return token.get(uint8Array, 0)
  }
  /**
   * Read a numeric token from the stream
   * @param token - Numeric token
   * @returns Promise with number
   */
  async readNumber(token) {
    const len = await this.readBuffer(this.numBuffer, { length: token.len })
    if (len < token.len) throw new EndOfStreamError()
    return token.get(this.numBuffer, 0)
  }
  /**
   * Read a numeric token from the stream
   * @param token - Numeric token
   * @returns Promise with number
   */
  async peekNumber(token) {
    const len = await this.peekBuffer(this.numBuffer, { length: token.len })
    if (len < token.len) throw new EndOfStreamError()
    return token.get(this.numBuffer, 0)
  }
  /**
   * Ignore number of bytes, advances the pointer in under tokenizer-stream.
   * @param length - Number of bytes to ignore
   * @return resolves the number of bytes ignored, equals length if this available, otherwise the number of bytes available
   */
  async ignore(length) {
    if (this.fileInfo.size !== undefined) {
      const bytesLeft = this.fileInfo.size - this.position
      if (length > bytesLeft) {
        this.position += bytesLeft
        return bytesLeft
      }
    }
    this.position += length
    return length
  }
  async close() {
    await this.abort()
    await this.onClose?.()
  }
  normalizeOptions(uint8Array, options) {
    if (
      options &&
      options.position !== undefined &&
      options.position < this.position
    ) {
      throw new Error(
        "`options.position` must be equal or greater than `tokenizer.position`",
      )
    }
    if (options) {
      return {
        mayBeLess: options.mayBeLess === true,
        offset: options.offset ? options.offset : 0,
        length: options.length
          ? options.length
          : uint8Array.length - (options.offset ? options.offset : 0),
        position: options.position ? options.position : this.position,
      }
    }
    return {
      mayBeLess: false,
      offset: 0,
      length: uint8Array.length,
      position: this.position,
    }
  }
  abort() {
    return Promise.resolve() // Ignore abort signal
  }
}

const maxBufferSize = 256000
class ReadStreamTokenizer extends AbstractTokenizer {
  /**
   * Constructor
   * @param streamReader stream-reader to read from
   * @param options Tokenizer options
   */
  constructor(streamReader, options) {
    super(options)
    this.streamReader = streamReader
    this.fileInfo = options?.fileInfo ?? {}
  }
  /**
   * Read buffer from tokenizer
   * @param uint8Array - Target Uint8Array to fill with data read from the tokenizer-stream
   * @param options - Read behaviour options
   * @returns Promise with number of bytes read
   */
  async readBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options)
    const skipBytes = normOptions.position - this.position
    if (skipBytes > 0) {
      await this.ignore(skipBytes)
      return this.readBuffer(uint8Array, options)
    }
    if (skipBytes < 0) {
      throw new Error(
        "`options.position` must be equal or greater than `tokenizer.position`",
      )
    }
    if (normOptions.length === 0) {
      return 0
    }
    const bytesRead = await this.streamReader.read(
      uint8Array,
      normOptions.offset,
      normOptions.length,
    )
    this.position += bytesRead
    if ((!options || !options.mayBeLess) && bytesRead < normOptions.length) {
      throw new EndOfStreamError()
    }
    return bytesRead
  }
  /**
   * Peek (read ahead) buffer from tokenizer
   * @param uint8Array - Uint8Array (or Buffer) to write data to
   * @param options - Read behaviour options
   * @returns Promise with number of bytes peeked
   */
  async peekBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options)
    let bytesRead = 0
    if (normOptions.position) {
      const skipBytes = normOptions.position - this.position
      if (skipBytes > 0) {
        const skipBuffer = new Uint8Array(normOptions.length + skipBytes)
        bytesRead = await this.peekBuffer(skipBuffer, {
          mayBeLess: normOptions.mayBeLess,
        })
        uint8Array.set(skipBuffer.subarray(skipBytes), normOptions.offset)
        return bytesRead - skipBytes
      }
      if (skipBytes < 0) {
        throw new Error("Cannot peek from a negative offset in a stream")
      }
    }
    if (normOptions.length > 0) {
      try {
        bytesRead = await this.streamReader.peek(
          uint8Array,
          normOptions.offset,
          normOptions.length,
        )
      } catch (err) {
        if (options?.mayBeLess && err instanceof EndOfStreamError) {
          return 0
        }
        throw err
      }
      if (!normOptions.mayBeLess && bytesRead < normOptions.length) {
        throw new EndOfStreamError()
      }
    }
    return bytesRead
  }
  async ignore(length) {
    // debug(`ignore ${this.position}...${this.position + length - 1}`);
    const bufSize = Math.min(maxBufferSize, length)
    const buf = new Uint8Array(bufSize)
    let totBytesRead = 0
    while (totBytesRead < length) {
      const remaining = length - totBytesRead
      const bytesRead = await this.readBuffer(buf, {
        length: Math.min(bufSize, remaining),
      })
      if (bytesRead < 0) {
        return bytesRead
      }
      totBytesRead += bytesRead
    }
    return totBytesRead
  }
  abort() {
    return this.streamReader.abort()
  }
  supportsRandomAccess() {
    return false
  }
}

class BufferTokenizer extends AbstractTokenizer {
  /**
   * Construct BufferTokenizer
   * @param uint8Array - Uint8Array to tokenize
   * @param options Tokenizer options
   */
  constructor(uint8Array, options) {
    super(options)
    this.uint8Array = uint8Array
    this.fileInfo = {
      ...(options?.fileInfo ?? {}),
      ...{ size: uint8Array.length },
    }
  }
  /**
   * Read buffer from tokenizer
   * @param uint8Array - Uint8Array to tokenize
   * @param options - Read behaviour options
   * @returns {Promise<number>}
   */
  async readBuffer(uint8Array, options) {
    if (options?.position) {
      if (options.position < this.position) {
        throw new Error(
          "`options.position` must be equal or greater than `tokenizer.position`",
        )
      }
      this.position = options.position
    }
    const bytesRead = await this.peekBuffer(uint8Array, options)
    this.position += bytesRead
    return bytesRead
  }
  /**
   * Peek (read ahead) buffer from tokenizer
   * @param uint8Array
   * @param options - Read behaviour options
   * @returns {Promise<number>}
   */
  async peekBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options)
    const bytes2read = Math.min(
      this.uint8Array.length - normOptions.position,
      normOptions.length,
    )
    if (!normOptions.mayBeLess && bytes2read < normOptions.length) {
      throw new EndOfStreamError()
    }
    uint8Array.set(
      this.uint8Array.subarray(
        normOptions.position,
        normOptions.position + bytes2read,
      ),
      normOptions.offset,
    )
    return bytes2read
  }
  close() {
    return super.close()
  }
  supportsRandomAccess() {
    return true
  }
  setPosition(position) {
    this.position = position
  }
}

/**
 * Construct ReadStreamTokenizer from given ReadableStream (WebStream API).
 * Will set fileSize, if provided given Stream has set the .path property/
 * @param webStream - Read from Node.js Stream.Readable (must be a byte stream)
 * @param options - Tokenizer options
 * @returns ReadStreamTokenizer
 */
function fromWebStream(webStream, options) {
  return new ReadStreamTokenizer(new WebStreamReader(webStream), options)
}
/**
 * Construct ReadStreamTokenizer from given Buffer.
 * @param uint8Array - Uint8Array to tokenize
 * @param options - Tokenizer options
 * @returns BufferTokenizer
 */
function fromBuffer(uint8Array, options) {
  return new BufferTokenizer(uint8Array, options)
}

const objectToString = Object.prototype.toString
const uint8ArrayStringified = "[object Uint8Array]"
const arrayBufferStringified = "[object ArrayBuffer]"

function isType(value, typeConstructor, typeStringified) {
  if (!value) {
    return false
  }

  if (value.constructor === typeConstructor) {
    return true
  }

  return objectToString.call(value) === typeStringified
}

function isUint8Array(value) {
  return isType(value, Uint8Array, uint8ArrayStringified)
}

function isArrayBuffer(value) {
  return isType(value, ArrayBuffer, arrayBufferStringified)
}

function isUint8ArrayOrArrayBuffer(value) {
  return isUint8Array(value) || isArrayBuffer(value)
}

function assertUint8Array(value) {
  if (!isUint8Array(value)) {
    throw new TypeError(`Expected \`Uint8Array\`, got \`${typeof value}\``)
  }
}

function assertUint8ArrayOrArrayBuffer(value) {
  if (!isUint8ArrayOrArrayBuffer(value)) {
    throw new TypeError(
      `Expected \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof value}\``,
    )
  }
}

const cachedDecoders = {
  utf8: new globalThis.TextDecoder("utf8"),
}

function uint8ArrayToString(array, encoding = "utf8") {
  assertUint8ArrayOrArrayBuffer(array)
  cachedDecoders[encoding] ??= new globalThis.TextDecoder(encoding)
  return cachedDecoders[encoding].decode(array)
}

function assertString(value) {
  if (typeof value !== "string") {
    throw new TypeError(`Expected \`string\`, got \`${typeof value}\``)
  }
}

const cachedEncoder = new globalThis.TextEncoder()

function stringToUint8Array(string) {
  assertString(string)
  return cachedEncoder.encode(string)
}

const byteToHexLookupTable = Array.from({ length: 256 }, (_, index) =>
  index.toString(16).padStart(2, "0"),
)

function uint8ArrayToHex(array) {
  assertUint8Array(array)

  // Concatenating a string is faster than using an array.
  let hexString = ""

  // eslint-disable-next-line unicorn/no-for-loop -- Max performance is critical.
  for (let index = 0; index < array.length; index++) {
    hexString += byteToHexLookupTable[array[index]]
  }

  return hexString
}

const hexToDecimalLookupTable = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  a: 10,
  b: 11,
  c: 12,
  d: 13,
  e: 14,
  f: 15,
  A: 10,
  B: 11,
  C: 12,
  D: 13,
  E: 14,
  F: 15,
}

function hexToUint8Array(hexString) {
  assertString(hexString)

  if (hexString.length % 2 !== 0) {
    throw new Error("Invalid Hex string length.")
  }

  const resultLength = hexString.length / 2
  const bytes = new Uint8Array(resultLength)

  for (let index = 0; index < resultLength; index++) {
    const highNibble = hexToDecimalLookupTable[hexString[index * 2]]
    const lowNibble = hexToDecimalLookupTable[hexString[index * 2 + 1]]

    if (highNibble === undefined || lowNibble === undefined) {
      throw new Error(
        `Invalid Hex character encountered at position ${index * 2}`,
      )
    }

    bytes[index] = (highNibble << 4) | lowNibble // eslint-disable-line no-bitwise
  }

  return bytes
}

/**
@param {DataView} view
@returns {number}
*/
function getUintBE(view) {
  const { byteLength } = view

  if (byteLength === 6) {
    return view.getUint16(0) * 2 ** 32 + view.getUint32(2)
  }

  if (byteLength === 5) {
    return view.getUint8(0) * 2 ** 32 + view.getUint32(1)
  }

  if (byteLength === 4) {
    return view.getUint32(0)
  }

  if (byteLength === 3) {
    return view.getUint8(0) * 2 ** 16 + view.getUint16(1)
  }

  if (byteLength === 2) {
    return view.getUint16(0)
  }

  if (byteLength === 1) {
    return view.getUint8(0)
  }
}

/**
@param {Uint8Array} array
@param {Uint8Array} value
@returns {number}
*/
function indexOf(array, value) {
  const arrayLength = array.length
  const valueLength = value.length

  if (valueLength === 0) {
    return -1
  }

  if (valueLength > arrayLength) {
    return -1
  }

  const validOffsetLength = arrayLength - valueLength

  for (let index = 0; index <= validOffsetLength; index++) {
    let isMatch = true
    for (let index2 = 0; index2 < valueLength; index2++) {
      if (array[index + index2] !== value[index2]) {
        isMatch = false
        break
      }
    }

    if (isMatch) {
      return index
    }
  }

  return -1
}

/**
@param {Uint8Array} array
@param {Uint8Array} value
@returns {boolean}
*/
function includes(array, value) {
  return indexOf(array, value) !== -1
}

function stringToBytes(string) {
  return [...string].map((character) => character.charCodeAt(0)) // eslint-disable-line unicorn/prefer-code-point
}

/**
Checks whether the TAR checksum is valid.

@param {Uint8Array} arrayBuffer - The TAR header `[offset ... offset + 512]`.
@param {number} offset - TAR header offset.
@returns {boolean} `true` if the TAR checksum is valid, otherwise `false`.
*/
function tarHeaderChecksumMatches(arrayBuffer, offset = 0) {
  const readSum = Number.parseInt(
    new StringType(6).get(arrayBuffer, 148).replace(/\0.*$/, "").trim(),
    8,
  ) // Read sum in header
  if (Number.isNaN(readSum)) {
    return false
  }

  let sum = 8 * 0x20 // Initialize signed bit sum

  for (let index = offset; index < offset + 148; index++) {
    sum += arrayBuffer[index]
  }

  for (let index = offset + 156; index < offset + 512; index++) {
    sum += arrayBuffer[index]
  }

  return readSum === sum
}

/**
ID3 UINT32 sync-safe tokenizer token.
28 bits (representing up to 256MB) integer, the msb is 0 to avoid "false syncsignals".
*/
const uint32SyncSafeToken = {
  get: (buffer, offset) =>
    (buffer[offset + 3] & 0x7f) |
    (buffer[offset + 2] << 7) |
    (buffer[offset + 1] << 14) |
    (buffer[offset] << 21),
  len: 4,
}

const extensions = [
  "jpg",
  "png",
  "apng",
  "gif",
  "webp",
  "flif",
  "xcf",
  "cr2",
  "cr3",
  "orf",
  "arw",
  "dng",
  "nef",
  "rw2",
  "raf",
  "tif",
  "bmp",
  "icns",
  "jxr",
  "psd",
  "indd",
  "zip",
  "tar",
  "rar",
  "gz",
  "bz2",
  "7z",
  "dmg",
  "mp4",
  "mid",
  "mkv",
  "webm",
  "mov",
  "avi",
  "mpg",
  "mp2",
  "mp3",
  "m4a",
  "oga",
  "ogg",
  "ogv",
  "opus",
  "flac",
  "wav",
  "spx",
  "amr",
  "pdf",
  "epub",
  "elf",
  "macho",
  "exe",
  "swf",
  "rtf",
  "wasm",
  "woff",
  "woff2",
  "eot",
  "ttf",
  "otf",
  "ico",
  "flv",
  "ps",
  "xz",
  "sqlite",
  "nes",
  "crx",
  "xpi",
  "cab",
  "deb",
  "ar",
  "rpm",
  "Z",
  "lz",
  "cfb",
  "mxf",
  "mts",
  "blend",
  "bpg",
  "docx",
  "pptx",
  "xlsx",
  "3gp",
  "3g2",
  "j2c",
  "jp2",
  "jpm",
  "jpx",
  "mj2",
  "aif",
  "qcp",
  "odt",
  "ods",
  "odp",
  "xml",
  "mobi",
  "heic",
  "cur",
  "ktx",
  "ape",
  "wv",
  "dcm",
  "ics",
  "glb",
  "pcap",
  "dsf",
  "lnk",
  "alias",
  "voc",
  "ac3",
  "m4v",
  "m4p",
  "m4b",
  "f4v",
  "f4p",
  "f4b",
  "f4a",
  "mie",
  "asf",
  "ogm",
  "ogx",
  "mpc",
  "arrow",
  "shp",
  "aac",
  "mp1",
  "it",
  "s3m",
  "xm",
  "ai",
  "skp",
  "avif",
  "eps",
  "lzh",
  "pgp",
  "asar",
  "stl",
  "chm",
  "3mf",
  "zst",
  "jxl",
  "vcf",
  "jls",
  "pst",
  "dwg",
  "parquet",
  "class",
  "arj",
  "cpio",
  "ace",
  "avro",
  "icc",
  "fbx",
  "vsdx",
  "vtt",
  "apk",
]

const mimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/flif",
  "image/x-xcf",
  "image/x-canon-cr2",
  "image/x-canon-cr3",
  "image/tiff",
  "image/bmp",
  "image/vnd.ms-photo",
  "image/vnd.adobe.photoshop",
  "application/x-indesign",
  "application/epub+zip",
  "application/x-xpinstall",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-tar",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-bzip2",
  "application/x-7z-compressed",
  "application/x-apple-diskimage",
  "application/x-apache-arrow",
  "video/mp4",
  "audio/midi",
  "video/x-matroska",
  "video/webm",
  "video/quicktime",
  "video/vnd.avi",
  "audio/wav",
  "audio/qcelp",
  "audio/x-ms-asf",
  "video/x-ms-asf",
  "application/vnd.ms-asf",
  "video/mpeg",
  "video/3gpp",
  "audio/mpeg",
  "audio/mp4", // RFC 4337
  "video/ogg",
  "audio/ogg",
  "audio/ogg; codecs=opus",
  "application/ogg",
  "audio/x-flac",
  "audio/ape",
  "audio/wavpack",
  "audio/amr",
  "application/pdf",
  "application/x-elf",
  "application/x-mach-binary",
  "application/x-msdownload",
  "application/x-shockwave-flash",
  "application/rtf",
  "application/wasm",
  "font/woff",
  "font/woff2",
  "application/vnd.ms-fontobject",
  "font/ttf",
  "font/otf",
  "image/x-icon",
  "video/x-flv",
  "application/postscript",
  "application/eps",
  "application/x-xz",
  "application/x-sqlite3",
  "application/x-nintendo-nes-rom",
  "application/x-google-chrome-extension",
  "application/vnd.ms-cab-compressed",
  "application/x-deb",
  "application/x-unix-archive",
  "application/x-rpm",
  "application/x-compress",
  "application/x-lzip",
  "application/x-cfb",
  "application/x-mie",
  "application/mxf",
  "video/mp2t",
  "application/x-blender",
  "image/bpg",
  "image/j2c",
  "image/jp2",
  "image/jpx",
  "image/jpm",
  "image/mj2",
  "audio/aiff",
  "application/xml",
  "application/x-mobipocket-ebook",
  "image/heif",
  "image/heif-sequence",
  "image/heic",
  "image/heic-sequence",
  "image/icns",
  "image/ktx",
  "application/dicom",
  "audio/x-musepack",
  "text/calendar",
  "text/vcard",
  "text/vtt",
  "model/gltf-binary",
  "application/vnd.tcpdump.pcap",
  "audio/x-dsf", // Non-standard
  "application/x.ms.shortcut", // Invented by us
  "application/x.apple.alias", // Invented by us
  "audio/x-voc",
  "audio/vnd.dolby.dd-raw",
  "audio/x-m4a",
  "image/apng",
  "image/x-olympus-orf",
  "image/x-sony-arw",
  "image/x-adobe-dng",
  "image/x-nikon-nef",
  "image/x-panasonic-rw2",
  "image/x-fujifilm-raf",
  "video/x-m4v",
  "video/3gpp2",
  "application/x-esri-shape",
  "audio/aac",
  "audio/x-it",
  "audio/x-s3m",
  "audio/x-xm",
  "video/MP1S",
  "video/MP2P",
  "application/vnd.sketchup.skp",
  "image/avif",
  "application/x-lzh-compressed",
  "application/pgp-encrypted",
  "application/x-asar",
  "model/stl",
  "application/vnd.ms-htmlhelp",
  "model/3mf",
  "image/jxl",
  "application/zstd",
  "image/jls",
  "application/vnd.ms-outlook",
  "image/vnd.dwg",
  "application/x-parquet",
  "application/java-vm",
  "application/x-arj",
  "application/x-cpio",
  "application/x-ace-compressed",
  "application/avro",
  "application/vnd.iccprofile",
  "application/x.autodesk.fbx", // Invented by us
  "application/vnd.visio",
  "application/vnd.android.package-archive",
]

/**
Primary entry point, Node.js specific entry point is index.js
*/

const reasonableDetectionSizeInBytes = 4100 // A fair amount of file-types are detectable within this range.

async function fileTypeFromBuffer(input) {
  return new FileTypeParser().fromBuffer(input)
}

function _check(buffer, headers, options) {
  options = {
    offset: 0,
    ...options,
  }

  for (const [index, header] of headers.entries()) {
    // If a bitmask is set
    if (options.mask) {
      // If header doesn't equal `buf` with bits masked off
      if (header !== (options.mask[index] & buffer[index + options.offset])) {
        return false
      }
    } else if (header !== buffer[index + options.offset]) {
      return false
    }
  }

  return true
}

class FileTypeParser {
  constructor(options) {
    this.detectors = options?.customDetectors
    this.tokenizerOptions = {
      abortSignal: options?.signal,
    }
    this.fromTokenizer = this.fromTokenizer.bind(this)
    this.fromBuffer = this.fromBuffer.bind(this)
    this.parse = this.parse.bind(this)
  }

  async fromTokenizer(tokenizer) {
    const initialPosition = tokenizer.position

    for (const detector of this.detectors || []) {
      const fileType = await detector(tokenizer)
      if (fileType) {
        return fileType
      }

      if (initialPosition !== tokenizer.position) {
        return undefined // Cannot proceed scanning of the tokenizer is at an arbitrary position
      }
    }

    return this.parse(tokenizer)
  }

  async fromBuffer(input) {
    if (!(input instanceof Uint8Array || input instanceof ArrayBuffer)) {
      throw new TypeError(
        `Expected the \`input\` argument to be of type \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof input}\``,
      )
    }

    const buffer = input instanceof Uint8Array ? input : new Uint8Array(input)

    if (!(buffer?.length > 1)) {
      return
    }

    return this.fromTokenizer(fromBuffer(buffer, this.tokenizerOptions))
  }

  async fromBlob(blob) {
    return this.fromStream(blob.stream())
  }

  async fromStream(stream) {
    const tokenizer = await fromWebStream(stream, this.tokenizerOptions)
    try {
      return await this.fromTokenizer(tokenizer)
    } finally {
      await tokenizer.close()
    }
  }

  async toDetectionStream(stream, options) {
    const { sampleSize = reasonableDetectionSizeInBytes } = options
    let detectedFileType
    let firstChunk

    const reader = stream.getReader({ mode: "byob" })
    try {
      // Read the first chunk from the stream
      const { value: chunk, done } = await reader.read(
        new Uint8Array(sampleSize),
      )
      firstChunk = chunk
      if (!done && chunk) {
        try {
          // Attempt to detect the file type from the chunk
          detectedFileType = await this.fromBuffer(chunk.slice(0, sampleSize))
        } catch (error) {
          if (!(error instanceof EndOfStreamError)) {
            throw error // Re-throw non-EndOfStreamError
          }

          detectedFileType = undefined
        }
      }

      firstChunk = chunk
    } finally {
      reader.releaseLock() // Ensure the reader is released
    }

    // Create a new ReadableStream to manage locking issues
    const transformStream = new TransformStream({
      async start(controller) {
        controller.enqueue(firstChunk) // Enqueue the initial chunk
      },
      transform(chunk, controller) {
        // Pass through the chunks without modification
        controller.enqueue(chunk)
      },
    })

    const newStream = stream.pipeThrough(transformStream)
    newStream.fileType = detectedFileType

    return newStream
  }

  check(header, options) {
    return _check(this.buffer, header, options)
  }

  checkString(header, options) {
    return this.check(stringToBytes(header), options)
  }

  async parse(tokenizer) {
    this.buffer = new Uint8Array(reasonableDetectionSizeInBytes)

    // Keep reading until EOF if the file size is unknown.
    if (tokenizer.fileInfo.size === undefined) {
      tokenizer.fileInfo.size = Number.MAX_SAFE_INTEGER
    }

    this.tokenizer = tokenizer

    await tokenizer.peekBuffer(this.buffer, { length: 12, mayBeLess: true })

    // -- 2-byte signatures --

    if (this.check([0x42, 0x4d])) {
      return {
        ext: "bmp",
        mime: "image/bmp",
      }
    }

    if (this.check([0x0b, 0x77])) {
      return {
        ext: "ac3",
        mime: "audio/vnd.dolby.dd-raw",
      }
    }

    if (this.check([0x78, 0x01])) {
      return {
        ext: "dmg",
        mime: "application/x-apple-diskimage",
      }
    }

    if (this.check([0x4d, 0x5a])) {
      return {
        ext: "exe",
        mime: "application/x-msdownload",
      }
    }

    if (this.check([0x25, 0x21])) {
      await tokenizer.peekBuffer(this.buffer, { length: 24, mayBeLess: true })

      if (
        this.checkString("PS-Adobe-", { offset: 2 }) &&
        this.checkString(" EPSF-", { offset: 14 })
      ) {
        return {
          ext: "eps",
          mime: "application/eps",
        }
      }

      return {
        ext: "ps",
        mime: "application/postscript",
      }
    }

    if (this.check([0x1f, 0xa0]) || this.check([0x1f, 0x9d])) {
      return {
        ext: "Z",
        mime: "application/x-compress",
      }
    }

    if (this.check([0xc7, 0x71])) {
      return {
        ext: "cpio",
        mime: "application/x-cpio",
      }
    }

    if (this.check([0x60, 0xea])) {
      return {
        ext: "arj",
        mime: "application/x-arj",
      }
    }

    // -- 3-byte signatures --

    if (this.check([0xef, 0xbb, 0xbf])) {
      // UTF-8-BOM
      // Strip off UTF-8-BOM
      this.tokenizer.ignore(3)
      return this.parse(tokenizer)
    }

    if (this.check([0x47, 0x49, 0x46])) {
      return {
        ext: "gif",
        mime: "image/gif",
      }
    }

    if (this.check([0x49, 0x49, 0xbc])) {
      return {
        ext: "jxr",
        mime: "image/vnd.ms-photo",
      }
    }

    if (this.check([0x1f, 0x8b, 0x8])) {
      return {
        ext: "gz",
        mime: "application/gzip",
      }
    }

    if (this.check([0x42, 0x5a, 0x68])) {
      return {
        ext: "bz2",
        mime: "application/x-bzip2",
      }
    }

    if (this.checkString("ID3")) {
      await tokenizer.ignore(6) // Skip ID3 header until the header size
      const id3HeaderLength = await tokenizer.readToken(uint32SyncSafeToken)
      if (tokenizer.position + id3HeaderLength > tokenizer.fileInfo.size) {
        // Guess file type based on ID3 header for backward compatibility
        return {
          ext: "mp3",
          mime: "audio/mpeg",
        }
      }

      await tokenizer.ignore(id3HeaderLength)
      return this.fromTokenizer(tokenizer) // Skip ID3 header, recursion
    }

    // Musepack, SV7
    if (this.checkString("MP+")) {
      return {
        ext: "mpc",
        mime: "audio/x-musepack",
      }
    }

    if (
      (this.buffer[0] === 0x43 || this.buffer[0] === 0x46) &&
      this.check([0x57, 0x53], { offset: 1 })
    ) {
      return {
        ext: "swf",
        mime: "application/x-shockwave-flash",
      }
    }

    // -- 4-byte signatures --

    // Requires a sample size of 4 bytes
    if (this.check([0xff, 0xd8, 0xff])) {
      if (this.check([0xf7], { offset: 3 })) {
        // JPG7/SOF55, indicating a ISO/IEC 14495 / JPEG-LS file
        return {
          ext: "jls",
          mime: "image/jls",
        }
      }

      return {
        ext: "jpg",
        mime: "image/jpeg",
      }
    }

    if (this.check([0x4f, 0x62, 0x6a, 0x01])) {
      return {
        ext: "avro",
        mime: "application/avro",
      }
    }

    if (this.checkString("FLIF")) {
      return {
        ext: "flif",
        mime: "image/flif",
      }
    }

    if (this.checkString("8BPS")) {
      return {
        ext: "psd",
        mime: "image/vnd.adobe.photoshop",
      }
    }

    if (this.checkString("WEBP", { offset: 8 })) {
      return {
        ext: "webp",
        mime: "image/webp",
      }
    }

    // Musepack, SV8
    if (this.checkString("MPCK")) {
      return {
        ext: "mpc",
        mime: "audio/x-musepack",
      }
    }

    if (this.checkString("FORM")) {
      return {
        ext: "aif",
        mime: "audio/aiff",
      }
    }

    if (this.checkString("icns", { offset: 0 })) {
      return {
        ext: "icns",
        mime: "image/icns",
      }
    }

    // Zip-based file formats
    // Need to be before the `zip` check
    if (this.check([0x50, 0x4b, 0x3, 0x4])) {
      // Local file header signature
      try {
        while (tokenizer.position + 30 < tokenizer.fileInfo.size) {
          await tokenizer.readBuffer(this.buffer, { length: 30 })

          const view = new DataView(this.buffer.buffer)

          // https://en.wikipedia.org/wiki/Zip_(file_format)#File_headers
          const zipHeader = {
            compressedSize: view.getUint32(18, true),
            uncompressedSize: view.getUint32(22, true),
            filenameLength: view.getUint16(26, true),
            extraFieldLength: view.getUint16(28, true),
          }

          zipHeader.filename = await tokenizer.readToken(
            new StringType(zipHeader.filenameLength, "utf-8"),
          )
          await tokenizer.ignore(zipHeader.extraFieldLength)

          if (/classes\d*\.dex/.test(zipHeader.filename)) {
            return {
              ext: "apk",
              mime: "application/vnd.android.package-archive",
            }
          }

          // Assumes signed `.xpi` from addons.mozilla.org
          if (zipHeader.filename === "META-INF/mozilla.rsa") {
            return {
              ext: "xpi",
              mime: "application/x-xpinstall",
            }
          }

          if (
            zipHeader.filename.endsWith(".rels") ||
            zipHeader.filename.endsWith(".xml")
          ) {
            const type = zipHeader.filename.split("/")[0]
            switch (type) {
              case "_rels":
                break
              case "word":
                return {
                  ext: "docx",
                  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                }
              case "ppt":
                return {
                  ext: "pptx",
                  mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                }
              case "xl":
                return {
                  ext: "xlsx",
                  mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }
              case "visio":
                return {
                  ext: "vsdx",
                  mime: "application/vnd.visio",
                }
              default:
                break
            }
          }

          if (zipHeader.filename.startsWith("xl/")) {
            return {
              ext: "xlsx",
              mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }
          }

          if (
            zipHeader.filename.startsWith("3D/") &&
            zipHeader.filename.endsWith(".model")
          ) {
            return {
              ext: "3mf",
              mime: "model/3mf",
            }
          }

          // The docx, xlsx and pptx file types extend the Office Open XML file format:
          // https://en.wikipedia.org/wiki/Office_Open_XML_file_formats
          // We look for:
          // - one entry named '[Content_Types].xml' or '_rels/.rels',
          // - one entry indicating specific type of file.
          // MS Office, OpenOffice and LibreOffice may put the parts in different order, so the check should not rely on it.
          if (
            zipHeader.filename === "mimetype" &&
            zipHeader.compressedSize === zipHeader.uncompressedSize
          ) {
            let mimeType = await tokenizer.readToken(
              new StringType(zipHeader.compressedSize, "utf-8"),
            )
            mimeType = mimeType.trim()

            switch (mimeType) {
              case "application/epub+zip":
                return {
                  ext: "epub",
                  mime: "application/epub+zip",
                }
              case "application/vnd.oasis.opendocument.text":
                return {
                  ext: "odt",
                  mime: "application/vnd.oasis.opendocument.text",
                }
              case "application/vnd.oasis.opendocument.spreadsheet":
                return {
                  ext: "ods",
                  mime: "application/vnd.oasis.opendocument.spreadsheet",
                }
              case "application/vnd.oasis.opendocument.presentation":
                return {
                  ext: "odp",
                  mime: "application/vnd.oasis.opendocument.presentation",
                }
              default:
            }
          }

          // Try to find next header manually when current one is corrupted
          if (zipHeader.compressedSize === 0) {
            let nextHeaderIndex = -1

            while (
              nextHeaderIndex < 0 &&
              tokenizer.position < tokenizer.fileInfo.size
            ) {
              await tokenizer.peekBuffer(this.buffer, { mayBeLess: true })

              nextHeaderIndex = indexOf(
                this.buffer,
                new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
              )

              // Move position to the next header if found, skip the whole buffer otherwise
              await tokenizer.ignore(
                nextHeaderIndex >= 0 ? nextHeaderIndex : this.buffer.length,
              )
            }
          } else {
            await tokenizer.ignore(zipHeader.compressedSize)
          }
        }
      } catch (error) {
        if (!(error instanceof EndOfStreamError)) {
          throw error
        }
      }

      return {
        ext: "zip",
        mime: "application/zip",
      }
    }

    if (this.checkString("OggS")) {
      // This is an OGG container
      await tokenizer.ignore(28)
      const type = new Uint8Array(8)
      await tokenizer.readBuffer(type)

      // Needs to be before `ogg` check
      if (_check(type, [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])) {
        return {
          ext: "opus",
          mime: "audio/ogg; codecs=opus",
        }
      }

      // If ' theora' in header.
      if (_check(type, [0x80, 0x74, 0x68, 0x65, 0x6f, 0x72, 0x61])) {
        return {
          ext: "ogv",
          mime: "video/ogg",
        }
      }

      // If '\x01video' in header.
      if (_check(type, [0x01, 0x76, 0x69, 0x64, 0x65, 0x6f, 0x00])) {
        return {
          ext: "ogm",
          mime: "video/ogg",
        }
      }

      // If ' FLAC' in header  https://xiph.org/flac/faq.html
      if (_check(type, [0x7f, 0x46, 0x4c, 0x41, 0x43])) {
        return {
          ext: "oga",
          mime: "audio/ogg",
        }
      }

      // 'Speex  ' in header https://en.wikipedia.org/wiki/Speex
      if (_check(type, [0x53, 0x70, 0x65, 0x65, 0x78, 0x20, 0x20])) {
        return {
          ext: "spx",
          mime: "audio/ogg",
        }
      }

      // If '\x01vorbis' in header
      if (_check(type, [0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])) {
        return {
          ext: "ogg",
          mime: "audio/ogg",
        }
      }

      // Default OGG container https://www.iana.org/assignments/media-types/application/ogg
      return {
        ext: "ogx",
        mime: "application/ogg",
      }
    }

    if (
      this.check([0x50, 0x4b]) &&
      (this.buffer[2] === 0x3 ||
        this.buffer[2] === 0x5 ||
        this.buffer[2] === 0x7) &&
      (this.buffer[3] === 0x4 ||
        this.buffer[3] === 0x6 ||
        this.buffer[3] === 0x8)
    ) {
      return {
        ext: "zip",
        mime: "application/zip",
      }
    }

    //

    // File Type Box (https://en.wikipedia.org/wiki/ISO_base_media_file_format)
    // It's not required to be first, but it's recommended to be. Almost all ISO base media files start with `ftyp` box.
    // `ftyp` box must contain a brand major identifier, which must consist of ISO 8859-1 printable characters.
    // Here we check for 8859-1 printable characters (for simplicity, it's a mask which also catches one non-printable character).
    if (
      this.checkString("ftyp", { offset: 4 }) &&
      (this.buffer[8] & 0x60) !== 0x00 // Brand major, first character ASCII?
    ) {
      // They all can have MIME `video/mp4` except `application/mp4` special-case which is hard to detect.
      // For some cases, we're specific, everything else falls to `video/mp4` with `mp4` extension.
      const brandMajor = new StringType(4, "latin1")
        .get(this.buffer, 8)
        .replace("\0", " ")
        .trim()
      switch (brandMajor) {
        case "avif":
        case "avis":
          return { ext: "avif", mime: "image/avif" }
        case "mif1":
          return { ext: "heic", mime: "image/heif" }
        case "msf1":
          return { ext: "heic", mime: "image/heif-sequence" }
        case "heic":
        case "heix":
          return { ext: "heic", mime: "image/heic" }
        case "hevc":
        case "hevx":
          return { ext: "heic", mime: "image/heic-sequence" }
        case "qt":
          return { ext: "mov", mime: "video/quicktime" }
        case "M4V":
        case "M4VH":
        case "M4VP":
          return { ext: "m4v", mime: "video/x-m4v" }
        case "M4P":
          return { ext: "m4p", mime: "video/mp4" }
        case "M4B":
          return { ext: "m4b", mime: "audio/mp4" }
        case "M4A":
          return { ext: "m4a", mime: "audio/x-m4a" }
        case "F4V":
          return { ext: "f4v", mime: "video/mp4" }
        case "F4P":
          return { ext: "f4p", mime: "video/mp4" }
        case "F4A":
          return { ext: "f4a", mime: "audio/mp4" }
        case "F4B":
          return { ext: "f4b", mime: "audio/mp4" }
        case "crx":
          return { ext: "cr3", mime: "image/x-canon-cr3" }
        default:
          if (brandMajor.startsWith("3g")) {
            if (brandMajor.startsWith("3g2")) {
              return { ext: "3g2", mime: "video/3gpp2" }
            }

            return { ext: "3gp", mime: "video/3gpp" }
          }

          return { ext: "mp4", mime: "video/mp4" }
      }
    }

    if (this.checkString("MThd")) {
      return {
        ext: "mid",
        mime: "audio/midi",
      }
    }

    if (
      this.checkString("wOFF") &&
      (this.check([0x00, 0x01, 0x00, 0x00], { offset: 4 }) ||
        this.checkString("OTTO", { offset: 4 }))
    ) {
      return {
        ext: "woff",
        mime: "font/woff",
      }
    }

    if (
      this.checkString("wOF2") &&
      (this.check([0x00, 0x01, 0x00, 0x00], { offset: 4 }) ||
        this.checkString("OTTO", { offset: 4 }))
    ) {
      return {
        ext: "woff2",
        mime: "font/woff2",
      }
    }

    if (
      this.check([0xd4, 0xc3, 0xb2, 0xa1]) ||
      this.check([0xa1, 0xb2, 0xc3, 0xd4])
    ) {
      return {
        ext: "pcap",
        mime: "application/vnd.tcpdump.pcap",
      }
    }

    // Sony DSD Stream File (DSF)
    if (this.checkString("DSD ")) {
      return {
        ext: "dsf",
        mime: "audio/x-dsf", // Non-standard
      }
    }

    if (this.checkString("LZIP")) {
      return {
        ext: "lz",
        mime: "application/x-lzip",
      }
    }

    if (this.checkString("fLaC")) {
      return {
        ext: "flac",
        mime: "audio/x-flac",
      }
    }

    if (this.check([0x42, 0x50, 0x47, 0xfb])) {
      return {
        ext: "bpg",
        mime: "image/bpg",
      }
    }

    if (this.checkString("wvpk")) {
      return {
        ext: "wv",
        mime: "audio/wavpack",
      }
    }

    if (this.checkString("%PDF")) {
      try {
        await tokenizer.ignore(1350)
        const maxBufferSize = 10 * 1024 * 1024
        const buffer = new Uint8Array(
          Math.min(maxBufferSize, tokenizer.fileInfo.size),
        )
        await tokenizer.readBuffer(buffer, { mayBeLess: true })

        // Check if this is an Adobe Illustrator file
        if (includes(buffer, new TextEncoder().encode("AIPrivateData"))) {
          return {
            ext: "ai",
            mime: "application/postscript",
          }
        }
      } catch (error) {
        // Swallow end of stream error if file is too small for the Adobe AI check
        if (!(error instanceof EndOfStreamError)) {
          throw error
        }
      }

      // Assume this is just a normal PDF
      return {
        ext: "pdf",
        mime: "application/pdf",
      }
    }

    if (this.check([0x00, 0x61, 0x73, 0x6d])) {
      return {
        ext: "wasm",
        mime: "application/wasm",
      }
    }

    // TIFF, little-endian type
    if (this.check([0x49, 0x49])) {
      const fileType = await this.readTiffHeader(false)
      if (fileType) {
        return fileType
      }
    }

    // TIFF, big-endian type
    if (this.check([0x4d, 0x4d])) {
      const fileType = await this.readTiffHeader(true)
      if (fileType) {
        return fileType
      }
    }

    if (this.checkString("MAC ")) {
      return {
        ext: "ape",
        mime: "audio/ape",
      }
    }

    // https://github.com/file/file/blob/master/magic/Magdir/matroska
    if (this.check([0x1a, 0x45, 0xdf, 0xa3])) {
      // Root element: EBML
      async function readField() {
        const msb = await tokenizer.peekNumber(UINT8)
        let mask = 0x80
        let ic = 0 // 0 = A, 1 = B, 2 = C, 3 = D

        while ((msb & mask) === 0 && mask !== 0) {
          ++ic
          mask >>= 1
        }

        const id = new Uint8Array(ic + 1)
        await tokenizer.readBuffer(id)
        return id
      }

      async function readElement() {
        const idField = await readField()
        const lengthField = await readField()

        lengthField[0] ^= 0x80 >> (lengthField.length - 1)
        const nrLength = Math.min(6, lengthField.length) // JavaScript can max read 6 bytes integer

        const idView = new DataView(idField.buffer)
        const lengthView = new DataView(
          lengthField.buffer,
          lengthField.length - nrLength,
          nrLength,
        )

        return {
          id: getUintBE(idView),
          len: getUintBE(lengthView),
        }
      }

      async function readChildren(children) {
        while (children > 0) {
          const element = await readElement()
          if (element.id === 0x42_82) {
            const rawValue = await tokenizer.readToken(
              new StringType(element.len),
            )
            return rawValue.replaceAll(/\00.*$/g, "") // Return DocType
          }

          await tokenizer.ignore(element.len) // ignore payload
          --children
        }
      }

      const re = await readElement()
      const docType = await readChildren(re.len)

      switch (docType) {
        case "webm":
          return {
            ext: "webm",
            mime: "video/webm",
          }

        case "matroska":
          return {
            ext: "mkv",
            mime: "video/x-matroska",
          }

        default:
          return
      }
    }

    // RIFF file format which might be AVI, WAV, QCP, etc
    if (this.check([0x52, 0x49, 0x46, 0x46])) {
      if (this.check([0x41, 0x56, 0x49], { offset: 8 })) {
        return {
          ext: "avi",
          mime: "video/vnd.avi",
        }
      }

      if (this.check([0x57, 0x41, 0x56, 0x45], { offset: 8 })) {
        return {
          ext: "wav",
          mime: "audio/wav",
        }
      }

      // QLCM, QCP file
      if (this.check([0x51, 0x4c, 0x43, 0x4d], { offset: 8 })) {
        return {
          ext: "qcp",
          mime: "audio/qcelp",
        }
      }
    }

    if (this.checkString("SQLi")) {
      return {
        ext: "sqlite",
        mime: "application/x-sqlite3",
      }
    }

    if (this.check([0x4e, 0x45, 0x53, 0x1a])) {
      return {
        ext: "nes",
        mime: "application/x-nintendo-nes-rom",
      }
    }

    if (this.checkString("Cr24")) {
      return {
        ext: "crx",
        mime: "application/x-google-chrome-extension",
      }
    }

    if (this.checkString("MSCF") || this.checkString("ISc(")) {
      return {
        ext: "cab",
        mime: "application/vnd.ms-cab-compressed",
      }
    }

    if (this.check([0xed, 0xab, 0xee, 0xdb])) {
      return {
        ext: "rpm",
        mime: "application/x-rpm",
      }
    }

    if (this.check([0xc5, 0xd0, 0xd3, 0xc6])) {
      return {
        ext: "eps",
        mime: "application/eps",
      }
    }

    if (this.check([0x28, 0xb5, 0x2f, 0xfd])) {
      return {
        ext: "zst",
        mime: "application/zstd",
      }
    }

    if (this.check([0x7f, 0x45, 0x4c, 0x46])) {
      return {
        ext: "elf",
        mime: "application/x-elf",
      }
    }

    if (this.check([0x21, 0x42, 0x44, 0x4e])) {
      return {
        ext: "pst",
        mime: "application/vnd.ms-outlook",
      }
    }

    if (this.checkString("PAR1")) {
      return {
        ext: "parquet",
        mime: "application/x-parquet",
      }
    }

    if (this.check([0xcf, 0xfa, 0xed, 0xfe])) {
      return {
        ext: "macho",
        mime: "application/x-mach-binary",
      }
    }

    // -- 5-byte signatures --

    if (this.check([0x4f, 0x54, 0x54, 0x4f, 0x00])) {
      return {
        ext: "otf",
        mime: "font/otf",
      }
    }

    if (this.checkString("#!AMR")) {
      return {
        ext: "amr",
        mime: "audio/amr",
      }
    }

    if (this.checkString("{\\rtf")) {
      return {
        ext: "rtf",
        mime: "application/rtf",
      }
    }

    if (this.check([0x46, 0x4c, 0x56, 0x01])) {
      return {
        ext: "flv",
        mime: "video/x-flv",
      }
    }

    if (this.checkString("IMPM")) {
      return {
        ext: "it",
        mime: "audio/x-it",
      }
    }

    if (
      this.checkString("-lh0-", { offset: 2 }) ||
      this.checkString("-lh1-", { offset: 2 }) ||
      this.checkString("-lh2-", { offset: 2 }) ||
      this.checkString("-lh3-", { offset: 2 }) ||
      this.checkString("-lh4-", { offset: 2 }) ||
      this.checkString("-lh5-", { offset: 2 }) ||
      this.checkString("-lh6-", { offset: 2 }) ||
      this.checkString("-lh7-", { offset: 2 }) ||
      this.checkString("-lzs-", { offset: 2 }) ||
      this.checkString("-lz4-", { offset: 2 }) ||
      this.checkString("-lz5-", { offset: 2 }) ||
      this.checkString("-lhd-", { offset: 2 })
    ) {
      return {
        ext: "lzh",
        mime: "application/x-lzh-compressed",
      }
    }

    // MPEG program stream (PS or MPEG-PS)
    if (this.check([0x00, 0x00, 0x01, 0xba])) {
      //  MPEG-PS, MPEG-1 Part 1
      if (this.check([0x21], { offset: 4, mask: [0xf1] })) {
        return {
          ext: "mpg", // May also be .ps, .mpeg
          mime: "video/MP1S",
        }
      }

      // MPEG-PS, MPEG-2 Part 1
      if (this.check([0x44], { offset: 4, mask: [0xc4] })) {
        return {
          ext: "mpg", // May also be .mpg, .m2p, .vob or .sub
          mime: "video/MP2P",
        }
      }
    }

    if (this.checkString("ITSF")) {
      return {
        ext: "chm",
        mime: "application/vnd.ms-htmlhelp",
      }
    }

    if (this.check([0xca, 0xfe, 0xba, 0xbe])) {
      return {
        ext: "class",
        mime: "application/java-vm",
      }
    }

    // -- 6-byte signatures --

    if (this.check([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) {
      return {
        ext: "xz",
        mime: "application/x-xz",
      }
    }

    if (this.checkString("<?xml ")) {
      return {
        ext: "xml",
        mime: "application/xml",
      }
    }

    if (this.check([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
      return {
        ext: "7z",
        mime: "application/x-7z-compressed",
      }
    }

    if (
      this.check([0x52, 0x61, 0x72, 0x21, 0x1a, 0x7]) &&
      (this.buffer[6] === 0x0 || this.buffer[6] === 0x1)
    ) {
      return {
        ext: "rar",
        mime: "application/x-rar-compressed",
      }
    }

    if (this.checkString("solid ")) {
      return {
        ext: "stl",
        mime: "model/stl",
      }
    }

    if (this.checkString("AC")) {
      const version = new StringType(4, "latin1").get(this.buffer, 2)
      if (version.match("^d*") && version >= 1000 && version <= 1050) {
        return {
          ext: "dwg",
          mime: "image/vnd.dwg",
        }
      }
    }

    if (this.checkString("070707")) {
      return {
        ext: "cpio",
        mime: "application/x-cpio",
      }
    }

    // -- 7-byte signatures --

    if (this.checkString("BLENDER")) {
      return {
        ext: "blend",
        mime: "application/x-blender",
      }
    }

    if (this.checkString("!<arch>")) {
      await tokenizer.ignore(8)
      const string = await tokenizer.readToken(new StringType(13, "ascii"))
      if (string === "debian-binary") {
        return {
          ext: "deb",
          mime: "application/x-deb",
        }
      }

      return {
        ext: "ar",
        mime: "application/x-unix-archive",
      }
    }

    if (
      this.checkString("WEBVTT") &&
      // One of LF, CR, tab, space, or end of file must follow "WEBVTT" per the spec (see `fixture/fixture-vtt-*.vtt` for examples). Note that `\0` is technically the null character (there is no such thing as an EOF character). However, checking for `\0` gives us the same result as checking for the end of the stream.
      ["\n", "\r", "\t", " ", "\0"].some((char7) =>
        this.checkString(char7, { offset: 6 }),
      )
    ) {
      return {
        ext: "vtt",
        mime: "text/vtt",
      }
    }

    // -- 8-byte signatures --

    if (this.check([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      // APNG format (https://wiki.mozilla.org/APNG_Specification)
      // 1. Find the first IDAT (image data) chunk (49 44 41 54)
      // 2. Check if there is an "acTL" chunk before the IDAT one (61 63 54 4C)

      // Offset calculated as follows:
      // - 8 bytes: PNG signature
      // - 4 (length) + 4 (chunk type) + 13 (chunk data) + 4 (CRC): IHDR chunk

      await tokenizer.ignore(8) // ignore PNG signature

      async function readChunkHeader() {
        return {
          length: await tokenizer.readToken(INT32_BE),
          type: await tokenizer.readToken(new StringType(4, "latin1")),
        }
      }

      do {
        const chunk = await readChunkHeader()
        if (chunk.length < 0) {
          return // Invalid chunk length
        }

        switch (chunk.type) {
          case "IDAT":
            return {
              ext: "png",
              mime: "image/png",
            }
          case "acTL":
            return {
              ext: "apng",
              mime: "image/apng",
            }
          default:
            await tokenizer.ignore(chunk.length + 4) // Ignore chunk-data + CRC
        }
      } while (tokenizer.position + 8 < tokenizer.fileInfo.size)

      return {
        ext: "png",
        mime: "image/png",
      }
    }

    if (this.check([0x41, 0x52, 0x52, 0x4f, 0x57, 0x31, 0x00, 0x00])) {
      return {
        ext: "arrow",
        mime: "application/x-apache-arrow",
      }
    }

    if (this.check([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00])) {
      return {
        ext: "glb",
        mime: "model/gltf-binary",
      }
    }

    // `mov` format variants
    if (
      this.check([0x66, 0x72, 0x65, 0x65], { offset: 4 }) || // `free`
      this.check([0x6d, 0x64, 0x61, 0x74], { offset: 4 }) || // `mdat` MJPEG
      this.check([0x6d, 0x6f, 0x6f, 0x76], { offset: 4 }) || // `moov`
      this.check([0x77, 0x69, 0x64, 0x65], { offset: 4 }) // `wide`
    ) {
      return {
        ext: "mov",
        mime: "video/quicktime",
      }
    }

    // -- 9-byte signatures --

    if (this.check([0x49, 0x49, 0x52, 0x4f, 0x08, 0x00, 0x00, 0x00, 0x18])) {
      return {
        ext: "orf",
        mime: "image/x-olympus-orf",
      }
    }

    if (this.checkString("gimp xcf ")) {
      return {
        ext: "xcf",
        mime: "image/x-xcf",
      }
    }

    // -- 12-byte signatures --

    if (
      this.check([
        0x49, 0x49, 0x55, 0x00, 0x18, 0x00, 0x00, 0x00, 0x88, 0xe7, 0x74, 0xd8,
      ])
    ) {
      return {
        ext: "rw2",
        mime: "image/x-panasonic-rw2",
      }
    }

    // ASF_Header_Object first 80 bytes
    if (
      this.check([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9])
    ) {
      async function readHeader() {
        const guid = new Uint8Array(16)
        await tokenizer.readBuffer(guid)
        return {
          id: guid,
          size: Number(await tokenizer.readToken(UINT64_LE)),
        }
      }

      await tokenizer.ignore(30)
      // Search for header should be in first 1KB of file.
      while (tokenizer.position + 24 < tokenizer.fileInfo.size) {
        const header = await readHeader()
        let payload = header.size - 24
        if (
          _check(
            header.id,
            [
              0x91, 0x07, 0xdc, 0xb7, 0xb7, 0xa9, 0xcf, 0x11, 0x8e, 0xe6, 0x00,
              0xc0, 0x0c, 0x20, 0x53, 0x65,
            ],
          )
        ) {
          // Sync on Stream-Properties-Object (B7DC0791-A9B7-11CF-8EE6-00C00C205365)
          const typeId = new Uint8Array(16)
          payload -= await tokenizer.readBuffer(typeId)

          if (
            _check(
              typeId,
              [
                0x40, 0x9e, 0x69, 0xf8, 0x4d, 0x5b, 0xcf, 0x11, 0xa8, 0xfd,
                0x00, 0x80, 0x5f, 0x5c, 0x44, 0x2b,
              ],
            )
          ) {
            // Found audio:
            return {
              ext: "asf",
              mime: "audio/x-ms-asf",
            }
          }

          if (
            _check(
              typeId,
              [
                0xc0, 0xef, 0x19, 0xbc, 0x4d, 0x5b, 0xcf, 0x11, 0xa8, 0xfd,
                0x00, 0x80, 0x5f, 0x5c, 0x44, 0x2b,
              ],
            )
          ) {
            // Found video:
            return {
              ext: "asf",
              mime: "video/x-ms-asf",
            }
          }

          break
        }

        await tokenizer.ignore(payload)
      }

      // Default to ASF generic extension
      return {
        ext: "asf",
        mime: "application/vnd.ms-asf",
      }
    }

    if (
      this.check([
        0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
      ])
    ) {
      return {
        ext: "ktx",
        mime: "image/ktx",
      }
    }

    if (
      (this.check([0x7e, 0x10, 0x04]) || this.check([0x7e, 0x18, 0x04])) &&
      this.check([0x30, 0x4d, 0x49, 0x45], { offset: 4 })
    ) {
      return {
        ext: "mie",
        mime: "application/x-mie",
      }
    }

    if (
      this.check(
        [
          0x27, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00,
        ],
        { offset: 2 },
      )
    ) {
      return {
        ext: "shp",
        mime: "application/x-esri-shape",
      }
    }

    if (this.check([0xff, 0x4f, 0xff, 0x51])) {
      return {
        ext: "j2c",
        mime: "image/j2c",
      }
    }

    if (
      this.check([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
      ])
    ) {
      // JPEG-2000 family

      await tokenizer.ignore(20)
      const type = await tokenizer.readToken(new StringType(4, "ascii"))
      switch (type) {
        case "jp2 ":
          return {
            ext: "jp2",
            mime: "image/jp2",
          }
        case "jpx ":
          return {
            ext: "jpx",
            mime: "image/jpx",
          }
        case "jpm ":
          return {
            ext: "jpm",
            mime: "image/jpm",
          }
        case "mjp2":
          return {
            ext: "mj2",
            mime: "image/mj2",
          }
        default:
          return
      }
    }

    if (
      this.check([0xff, 0x0a]) ||
      this.check([
        0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
      ])
    ) {
      return {
        ext: "jxl",
        mime: "image/jxl",
      }
    }

    if (this.check([0xfe, 0xff])) {
      // UTF-16-BOM-LE
      if (this.check([0, 60, 0, 63, 0, 120, 0, 109, 0, 108], { offset: 2 })) {
        return {
          ext: "xml",
          mime: "application/xml",
        }
      }

      return undefined // Some unknown text based format
    }

    // -- Unsafe signatures --

    if (
      this.check([0x0, 0x0, 0x1, 0xba]) ||
      this.check([0x0, 0x0, 0x1, 0xb3])
    ) {
      return {
        ext: "mpg",
        mime: "video/mpeg",
      }
    }

    if (this.check([0x00, 0x01, 0x00, 0x00, 0x00])) {
      return {
        ext: "ttf",
        mime: "font/ttf",
      }
    }

    if (this.check([0x00, 0x00, 0x01, 0x00])) {
      return {
        ext: "ico",
        mime: "image/x-icon",
      }
    }

    if (this.check([0x00, 0x00, 0x02, 0x00])) {
      return {
        ext: "cur",
        mime: "image/x-icon",
      }
    }

    if (this.check([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      // Detected Microsoft Compound File Binary File (MS-CFB) Format.
      return {
        ext: "cfb",
        mime: "application/x-cfb",
      }
    }

    // Increase sample size from 12 to 256.
    await tokenizer.peekBuffer(this.buffer, {
      length: Math.min(256, tokenizer.fileInfo.size),
      mayBeLess: true,
    })

    if (this.check([0x61, 0x63, 0x73, 0x70], { offset: 36 })) {
      return {
        ext: "icc",
        mime: "application/vnd.iccprofile",
      }
    }

    // ACE: requires 14 bytes in the buffer
    if (
      this.checkString("**ACE", { offset: 7 }) &&
      this.checkString("**", { offset: 12 })
    ) {
      return {
        ext: "ace",
        mime: "application/x-ace-compressed",
      }
    }

    // -- 15-byte signatures --

    if (this.checkString("BEGIN:")) {
      if (this.checkString("VCARD", { offset: 6 })) {
        return {
          ext: "vcf",
          mime: "text/vcard",
        }
      }

      if (this.checkString("VCALENDAR", { offset: 6 })) {
        return {
          ext: "ics",
          mime: "text/calendar",
        }
      }
    }

    // `raf` is here just to keep all the raw image detectors together.
    if (this.checkString("FUJIFILMCCD-RAW")) {
      return {
        ext: "raf",
        mime: "image/x-fujifilm-raf",
      }
    }

    if (this.checkString("Extended Module:")) {
      return {
        ext: "xm",
        mime: "audio/x-xm",
      }
    }

    if (this.checkString("Creative Voice File")) {
      return {
        ext: "voc",
        mime: "audio/x-voc",
      }
    }

    if (this.check([0x04, 0x00, 0x00, 0x00]) && this.buffer.length >= 16) {
      // Rough & quick check Pickle/ASAR
      const jsonSize = new DataView(this.buffer.buffer).getUint32(12, true)

      if (jsonSize > 12 && this.buffer.length >= jsonSize + 16) {
        try {
          const header = new TextDecoder().decode(
            this.buffer.slice(16, jsonSize + 16),
          )
          const json = JSON.parse(header)
          // Check if Pickle is ASAR
          if (json.files) {
            // Final check, assuring Pickle/ASAR format
            return {
              ext: "asar",
              mime: "application/x-asar",
            }
          }
        } catch {}
      }
    }

    if (
      this.check([
        0x06, 0x0e, 0x2b, 0x34, 0x02, 0x05, 0x01, 0x01, 0x0d, 0x01, 0x02, 0x01,
        0x01, 0x02,
      ])
    ) {
      return {
        ext: "mxf",
        mime: "application/mxf",
      }
    }

    if (this.checkString("SCRM", { offset: 44 })) {
      return {
        ext: "s3m",
        mime: "audio/x-s3m",
      }
    }

    // Raw MPEG-2 transport stream (188-byte packets)
    if (this.check([0x47]) && this.check([0x47], { offset: 188 })) {
      return {
        ext: "mts",
        mime: "video/mp2t",
      }
    }

    // Blu-ray Disc Audio-Video (BDAV) MPEG-2 transport stream has 4-byte TP_extra_header before each 188-byte packet
    if (
      this.check([0x47], { offset: 4 }) &&
      this.check([0x47], { offset: 196 })
    ) {
      return {
        ext: "mts",
        mime: "video/mp2t",
      }
    }

    if (
      this.check([0x42, 0x4f, 0x4f, 0x4b, 0x4d, 0x4f, 0x42, 0x49], {
        offset: 60,
      })
    ) {
      return {
        ext: "mobi",
        mime: "application/x-mobipocket-ebook",
      }
    }

    if (this.check([0x44, 0x49, 0x43, 0x4d], { offset: 128 })) {
      return {
        ext: "dcm",
        mime: "application/dicom",
      }
    }

    if (
      this.check([
        0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46,
      ])
    ) {
      return {
        ext: "lnk",
        mime: "application/x.ms.shortcut", // Invented by us
      }
    }

    if (
      this.check([
        0x62, 0x6f, 0x6f, 0x6b, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x61, 0x72, 0x6b,
        0x00, 0x00, 0x00, 0x00,
      ])
    ) {
      return {
        ext: "alias",
        mime: "application/x.apple.alias", // Invented by us
      }
    }

    if (this.checkString("Kaydara FBX Binary  \u0000")) {
      return {
        ext: "fbx",
        mime: "application/x.autodesk.fbx", // Invented by us
      }
    }

    if (
      this.check([0x4c, 0x50], { offset: 34 }) &&
      (this.check([0x00, 0x00, 0x01], { offset: 8 }) ||
        this.check([0x01, 0x00, 0x02], { offset: 8 }) ||
        this.check([0x02, 0x00, 0x02], { offset: 8 }))
    ) {
      return {
        ext: "eot",
        mime: "application/vnd.ms-fontobject",
      }
    }

    if (
      this.check([
        0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7,
        0xfe, 0x74, 0xb7, 0x1d,
      ])
    ) {
      return {
        ext: "indd",
        mime: "application/x-indesign",
      }
    }

    // Increase sample size from 256 to 512
    await tokenizer.peekBuffer(this.buffer, {
      length: Math.min(512, tokenizer.fileInfo.size),
      mayBeLess: true,
    })

    // Requires a buffer size of 512 bytes
    if (tarHeaderChecksumMatches(this.buffer)) {
      return {
        ext: "tar",
        mime: "application/x-tar",
      }
    }

    if (this.check([0xff, 0xfe])) {
      // UTF-16-BOM-BE
      if (this.check([60, 0, 63, 0, 120, 0, 109, 0, 108, 0], { offset: 2 })) {
        return {
          ext: "xml",
          mime: "application/xml",
        }
      }

      if (
        this.check(
          [
            0xff, 0x0e, 0x53, 0x00, 0x6b, 0x00, 0x65, 0x00, 0x74, 0x00, 0x63,
            0x00, 0x68, 0x00, 0x55, 0x00, 0x70, 0x00, 0x20, 0x00, 0x4d, 0x00,
            0x6f, 0x00, 0x64, 0x00, 0x65, 0x00, 0x6c, 0x00,
          ],
          { offset: 2 },
        )
      ) {
        return {
          ext: "skp",
          mime: "application/vnd.sketchup.skp",
        }
      }

      return undefined // Some text based format
    }

    if (this.checkString("-----BEGIN PGP MESSAGE-----")) {
      return {
        ext: "pgp",
        mime: "application/pgp-encrypted",
      }
    }

    // Check MPEG 1 or 2 Layer 3 header, or 'layer 0' for ADTS (MPEG sync-word 0xFFE)
    if (
      this.buffer.length >= 2 &&
      this.check([0xff, 0xe0], { offset: 0, mask: [0xff, 0xe0] })
    ) {
      if (this.check([0x10], { offset: 1, mask: [0x16] })) {
        // Check for (ADTS) MPEG-2
        if (this.check([0x08], { offset: 1, mask: [0x08] })) {
          return {
            ext: "aac",
            mime: "audio/aac",
          }
        }

        // Must be (ADTS) MPEG-4
        return {
          ext: "aac",
          mime: "audio/aac",
        }
      }

      // MPEG 1 or 2 Layer 3 header
      // Check for MPEG layer 3
      if (this.check([0x02], { offset: 1, mask: [0x06] })) {
        return {
          ext: "mp3",
          mime: "audio/mpeg",
        }
      }

      // Check for MPEG layer 2
      if (this.check([0x04], { offset: 1, mask: [0x06] })) {
        return {
          ext: "mp2",
          mime: "audio/mpeg",
        }
      }

      // Check for MPEG layer 1
      if (this.check([0x06], { offset: 1, mask: [0x06] })) {
        return {
          ext: "mp1",
          mime: "audio/mpeg",
        }
      }
    }
  }

  async readTiffTag(bigEndian) {
    const tagId = await this.tokenizer.readToken(
      bigEndian ? UINT16_BE : UINT16_LE,
    )
    this.tokenizer.ignore(10)
    switch (tagId) {
      case 50_341:
        return {
          ext: "arw",
          mime: "image/x-sony-arw",
        }
      case 50_706:
        return {
          ext: "dng",
          mime: "image/x-adobe-dng",
        }
    }
  }

  async readTiffIFD(bigEndian) {
    const numberOfTags = await this.tokenizer.readToken(
      bigEndian ? UINT16_BE : UINT16_LE,
    )
    for (let n = 0; n < numberOfTags; ++n) {
      const fileType = await this.readTiffTag(bigEndian)
      if (fileType) {
        return fileType
      }
    }
  }

  async readTiffHeader(bigEndian) {
    const version = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 2)
    const ifdOffset = (bigEndian ? UINT32_BE : UINT32_LE).get(this.buffer, 4)

    if (version === 42) {
      // TIFF file header
      if (ifdOffset >= 6) {
        if (this.checkString("CR", { offset: 8 })) {
          return {
            ext: "cr2",
            mime: "image/x-canon-cr2",
          }
        }

        if (
          ifdOffset >= 8 &&
          (this.check([0x1c, 0x00, 0xfe, 0x00], { offset: 8 }) ||
            this.check([0x1f, 0x00, 0x0b, 0x00], { offset: 8 }))
        ) {
          return {
            ext: "nef",
            mime: "image/x-nikon-nef",
          }
        }
      }

      await this.tokenizer.ignore(ifdOffset)
      const fileType = await this.readTiffIFD(bigEndian)
      return (
        fileType ?? {
          ext: "tif",
          mime: "image/tiff",
        }
      )
    }

    if (version === 43) {
      // Big TIFF file header
      return {
        ext: "tif",
        mime: "image/tiff",
      }
    }
  }
}

new Set(extensions)
new Set(mimeTypes)

var contentType = {}

/*!
 * content-type
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * RegExp to match *( ";" parameter ) in RFC 7231 sec 3.1.1.1
 *
 * parameter     = token "=" ( token / quoted-string )
 * token         = 1*tchar
 * tchar         = "!" / "#" / "$" / "%" / "&" / "'" / "*"
 *               / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
 *               / DIGIT / ALPHA
 *               ; any VCHAR, except delimiters
 * quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
 * qdtext        = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text
 * obs-text      = %x80-FF
 * quoted-pair   = "\" ( HTAB / SP / VCHAR / obs-text )
 */
var PARAM_REGEXP =
  /; *([!#$%&'*+.^_`|~0-9A-Za-z-]+) *= *("(?:[\u000b\u0020\u0021\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\u000b\u0020-\u00ff])*"|[!#$%&'*+.^_`|~0-9A-Za-z-]+) */g // eslint-disable-line no-control-regex
var TEXT_REGEXP = /^[\u000b\u0020-\u007e\u0080-\u00ff]+$/ // eslint-disable-line no-control-regex
var TOKEN_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/**
 * RegExp to match quoted-pair in RFC 7230 sec 3.2.6
 *
 * quoted-pair = "\" ( HTAB / SP / VCHAR / obs-text )
 * obs-text    = %x80-FF
 */
var QESC_REGEXP = /\\([\u000b\u0020-\u00ff])/g // eslint-disable-line no-control-regex

/**
 * RegExp to match chars that must be quoted-pair in RFC 7230 sec 3.2.6
 */
var QUOTE_REGEXP = /([\\"])/g

/**
 * RegExp to match type in RFC 7231 sec 3.1.1.1
 *
 * media-type = type "/" subtype
 * type       = token
 * subtype    = token
 */
var TYPE_REGEXP$1 = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/**
 * Module exports.
 * @public
 */

contentType.format = format
contentType.parse = parse$1

/**
 * Format object to media type.
 *
 * @param {object} obj
 * @return {string}
 * @public
 */

function format(obj) {
  if (!obj || typeof obj !== "object") {
    throw new TypeError("argument obj is required")
  }

  var parameters = obj.parameters
  var type = obj.type

  if (!type || !TYPE_REGEXP$1.test(type)) {
    throw new TypeError("invalid type")
  }

  var string = type

  // append parameters
  if (parameters && typeof parameters === "object") {
    var param
    var params = Object.keys(parameters).sort()

    for (var i = 0; i < params.length; i++) {
      param = params[i]

      if (!TOKEN_REGEXP.test(param)) {
        throw new TypeError("invalid parameter name")
      }

      string += "; " + param + "=" + qstring(parameters[param])
    }
  }

  return string
}

/**
 * Parse media type to object.
 *
 * @param {string|object} string
 * @return {Object}
 * @public
 */

function parse$1(string) {
  if (!string) {
    throw new TypeError("argument string is required")
  }

  // support req/res-like objects as argument
  var header = typeof string === "object" ? getcontenttype(string) : string

  if (typeof header !== "string") {
    throw new TypeError("argument string is required to be a string")
  }

  var index = header.indexOf(";")
  var type = index !== -1 ? header.slice(0, index).trim() : header.trim()

  if (!TYPE_REGEXP$1.test(type)) {
    throw new TypeError("invalid media type")
  }

  var obj = new ContentType(type.toLowerCase())

  // parse parameters
  if (index !== -1) {
    var key
    var match
    var value

    PARAM_REGEXP.lastIndex = index

    while ((match = PARAM_REGEXP.exec(header))) {
      if (match.index !== index) {
        throw new TypeError("invalid parameter format")
      }

      index += match[0].length
      key = match[1].toLowerCase()
      value = match[2]

      if (value.charCodeAt(0) === 0x22 /* " */) {
        // remove quotes
        value = value.slice(1, -1)

        // remove escapes
        if (value.indexOf("\\") !== -1) {
          value = value.replace(QESC_REGEXP, "$1")
        }
      }

      obj.parameters[key] = value
    }

    if (index !== header.length) {
      throw new TypeError("invalid parameter format")
    }
  }

  return obj
}

/**
 * Get content-type from req/res objects.
 *
 * @param {object}
 * @return {Object}
 * @private
 */

function getcontenttype(obj) {
  var header

  if (typeof obj.getHeader === "function") {
    // res-like
    header = obj.getHeader("content-type")
  } else if (typeof obj.headers === "object") {
    // req-like
    header = obj.headers && obj.headers["content-type"]
  }

  if (typeof header !== "string") {
    throw new TypeError("content-type header is missing from object")
  }

  return header
}

/**
 * Quote a string if necessary.
 *
 * @param {string} val
 * @return {string}
 * @private
 */

function qstring(val) {
  var str = String(val)

  // no need to quote tokens
  if (TOKEN_REGEXP.test(str)) {
    return str
  }

  if (str.length > 0 && !TEXT_REGEXP.test(str)) {
    throw new TypeError("invalid parameter value")
  }

  return '"' + str.replace(QUOTE_REGEXP, "\\$1") + '"'
}

/**
 * Class to represent a content type.
 * @private
 */
function ContentType(type) {
  this.parameters = Object.create(null)
  this.type = type
}

/*!
 * media-typer
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */
var TYPE_REGEXP =
  /^ *([A-Za-z0-9][A-Za-z0-9!#$&^_-]{0,126})\/([A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}) *$/
var parse_1 = parse

/**
 * Parse media type to object.
 *
 * @param {string} string
 * @return {object}
 * @public
 */

function parse(string) {
  if (!string) {
    throw new TypeError("argument string is required")
  }

  if (typeof string !== "string") {
    throw new TypeError("argument string is required to be a string")
  }

  var match = TYPE_REGEXP.exec(string.toLowerCase())

  if (!match) {
    throw new TypeError("invalid media type")
  }

  var type = match[1]
  var subtype = match[2]
  var suffix

  // suffix after last +
  var index = subtype.lastIndexOf("+")
  if (index !== -1) {
    suffix = subtype.substr(index + 1)
    subtype = subtype.substr(0, index)
  }

  return new MediaType(type, subtype, suffix)
}

/**
 * Class for MediaType object.
 * @public
 */

function MediaType(type, subtype, suffix) {
  this.type = type
  this.subtype = subtype
  this.suffix = suffix
}

var browser = { exports: {} }

/**
 * Helpers.
 */

var ms
var hasRequiredMs

function requireMs() {
  if (hasRequiredMs) return ms
  hasRequiredMs = 1
  var s = 1000
  var m = s * 60
  var h = m * 60
  var d = h * 24
  var w = d * 7
  var y = d * 365.25

  /**
   * Parse or format the given `val`.
   *
   * Options:
   *
   *  - `long` verbose formatting [false]
   *
   * @param {String|Number} val
   * @param {Object} [options]
   * @throws {Error} throw an error if val is not a non-empty string or a number
   * @return {String|Number}
   * @api public
   */

  ms = function (val, options) {
    options = options || {}
    var type = typeof val
    if (type === "string" && val.length > 0) {
      return parse(val)
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val)
    }
    throw new Error(
      "val is not a non-empty string or a valid number. val=" +
        JSON.stringify(val),
    )
  }

  /**
   * Parse the given `str` and return milliseconds.
   *
   * @param {String} str
   * @return {Number}
   * @api private
   */

  function parse(str) {
    str = String(str)
    if (str.length > 100) {
      return
    }
    var match =
      /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str,
      )
    if (!match) {
      return
    }
    var n = parseFloat(match[1])
    var type = (match[2] || "ms").toLowerCase()
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y
      case "weeks":
      case "week":
      case "w":
        return n * w
      case "days":
      case "day":
      case "d":
        return n * d
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n
      default:
        return undefined
    }
  }

  /**
   * Short format for `ms`.
   *
   * @param {Number} ms
   * @return {String}
   * @api private
   */

  function fmtShort(ms) {
    var msAbs = Math.abs(ms)
    if (msAbs >= d) {
      return Math.round(ms / d) + "d"
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h"
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m"
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s"
    }
    return ms + "ms"
  }

  /**
   * Long format for `ms`.
   *
   * @param {Number} ms
   * @return {String}
   * @api private
   */

  function fmtLong(ms) {
    var msAbs = Math.abs(ms)
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day")
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour")
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute")
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second")
    }
    return ms + " ms"
  }

  /**
   * Pluralization helper.
   */

  function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5
    return Math.round(ms / n) + " " + name + (isPlural ? "s" : "")
  }
  return ms
}

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

function setup(env) {
  createDebug.debug = createDebug
  createDebug.default = createDebug
  createDebug.coerce = coerce
  createDebug.disable = disable
  createDebug.enable = enable
  createDebug.enabled = enabled
  createDebug.humanize = requireMs()
  createDebug.destroy = destroy

  Object.keys(env).forEach((key) => {
    createDebug[key] = env[key]
  })

  /**
   * The currently active debug mode names, and names to skip.
   */

  createDebug.names = []
  createDebug.skips = []

  /**
   * Map of special "%n" handling functions, for the debug "format" argument.
   *
   * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
   */
  createDebug.formatters = {}

  /**
   * Selects a color for a debug namespace
   * @param {String} namespace The namespace string for the debug instance to be colored
   * @return {Number|String} An ANSI color code for the given namespace
   * @api private
   */
  function selectColor(namespace) {
    let hash = 0

    for (let i = 0; i < namespace.length; i++) {
      hash = (hash << 5) - hash + namespace.charCodeAt(i)
      hash |= 0 // Convert to 32bit integer
    }

    return createDebug.colors[Math.abs(hash) % createDebug.colors.length]
  }
  createDebug.selectColor = selectColor

  /**
   * Create a debugger with the given `namespace`.
   *
   * @param {String} namespace
   * @return {Function}
   * @api public
   */
  function createDebug(namespace) {
    let prevTime
    let enableOverride = null
    let namespacesCache
    let enabledCache

    function debug(...args) {
      // Disabled?
      if (!debug.enabled) {
        return
      }

      const self = debug

      // Set `diff` timestamp
      const curr = Number(new Date())
      const ms = curr - (prevTime || curr)
      self.diff = ms
      self.prev = prevTime
      self.curr = curr
      prevTime = curr

      args[0] = createDebug.coerce(args[0])

      if (typeof args[0] !== "string") {
        // Anything else let's inspect with %O
        args.unshift("%O")
      }

      // Apply any `formatters` transformations
      let index = 0
      args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
        // If we encounter an escaped % then don't increase the array index
        if (match === "%%") {
          return "%"
        }
        index++
        const formatter = createDebug.formatters[format]
        if (typeof formatter === "function") {
          const val = args[index]
          match = formatter.call(self, val)

          // Now we need to remove `args[index]` since it's inlined in the `format`
          args.splice(index, 1)
          index--
        }
        return match
      })

      // Apply env-specific formatting (colors, etc.)
      createDebug.formatArgs.call(self, args)

      const logFn = self.log || createDebug.log
      logFn.apply(self, args)
    }

    debug.namespace = namespace
    debug.useColors = createDebug.useColors()
    debug.color = createDebug.selectColor(namespace)
    debug.extend = extend
    debug.destroy = createDebug.destroy // XXX Temporary. Will be removed in the next major release.

    Object.defineProperty(debug, "enabled", {
      enumerable: true,
      configurable: false,
      get: () => {
        if (enableOverride !== null) {
          return enableOverride
        }
        if (namespacesCache !== createDebug.namespaces) {
          namespacesCache = createDebug.namespaces
          enabledCache = createDebug.enabled(namespace)
        }

        return enabledCache
      },
      set: (v) => {
        enableOverride = v
      },
    })

    // Env-specific initialization logic for debug instances
    if (typeof createDebug.init === "function") {
      createDebug.init(debug)
    }

    return debug
  }

  function extend(namespace, delimiter) {
    const newDebug = createDebug(
      this.namespace +
        (typeof delimiter === "undefined" ? ":" : delimiter) +
        namespace,
    )
    newDebug.log = this.log
    return newDebug
  }

  /**
   * Enables a debug mode by namespaces. This can include modes
   * separated by a colon and wildcards.
   *
   * @param {String} namespaces
   * @api public
   */
  function enable(namespaces) {
    createDebug.save(namespaces)
    createDebug.namespaces = namespaces

    createDebug.names = []
    createDebug.skips = []

    const split = (typeof namespaces === "string" ? namespaces : "")
      .trim()
      .replace(" ", ",")
      .split(",")
      .filter(Boolean)

    for (const ns of split) {
      if (ns[0] === "-") {
        createDebug.skips.push(ns.slice(1))
      } else {
        createDebug.names.push(ns)
      }
    }
  }

  /**
   * Checks if the given string matches a namespace template, honoring
   * asterisks as wildcards.
   *
   * @param {String} search
   * @param {String} template
   * @return {Boolean}
   */
  function matchesTemplate(search, template) {
    let searchIndex = 0
    let templateIndex = 0
    let starIndex = -1
    let matchIndex = 0

    while (searchIndex < search.length) {
      if (
        templateIndex < template.length &&
        (template[templateIndex] === search[searchIndex] ||
          template[templateIndex] === "*")
      ) {
        // Match character or proceed with wildcard
        if (template[templateIndex] === "*") {
          starIndex = templateIndex
          matchIndex = searchIndex
          templateIndex++ // Skip the '*'
        } else {
          searchIndex++
          templateIndex++
        }
      } else if (starIndex !== -1) {
        // eslint-disable-line no-negated-condition
        // Backtrack to the last '*' and try to match more characters
        templateIndex = starIndex + 1
        matchIndex++
        searchIndex = matchIndex
      } else {
        return false // No match
      }
    }

    // Handle trailing '*' in template
    while (templateIndex < template.length && template[templateIndex] === "*") {
      templateIndex++
    }

    return templateIndex === template.length
  }

  /**
   * Disable debug output.
   *
   * @return {String} namespaces
   * @api public
   */
  function disable() {
    const namespaces = [
      ...createDebug.names,
      ...createDebug.skips.map((namespace) => "-" + namespace),
    ].join(",")
    createDebug.enable("")
    return namespaces
  }

  /**
   * Returns true if the given mode name is enabled, false otherwise.
   *
   * @param {String} name
   * @return {Boolean}
   * @api public
   */
  function enabled(name) {
    for (const skip of createDebug.skips) {
      if (matchesTemplate(name, skip)) {
        return false
      }
    }

    for (const ns of createDebug.names) {
      if (matchesTemplate(name, ns)) {
        return true
      }
    }

    return false
  }

  /**
   * Coerce `val`.
   *
   * @param {Mixed} val
   * @return {Mixed}
   * @api private
   */
  function coerce(val) {
    if (val instanceof Error) {
      return val.stack || val.message
    }
    return val
  }

  /**
   * XXX DO NOT USE. This is a temporary stub function.
   * XXX It WILL be removed in the next major release.
   */
  function destroy() {
    console.warn(
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
    )
  }

  createDebug.enable(createDebug.load())

  return createDebug
}

var common = setup

/* eslint-env browser */

;(function (module, exports) {
  /**
   * This is the web browser implementation of `debug()`.
   */

  exports.formatArgs = formatArgs
  exports.save = save
  exports.load = load
  exports.useColors = useColors
  exports.storage = localstorage()
  exports.destroy = (() => {
    let warned = false

    return () => {
      if (!warned) {
        warned = true
        console.warn(
          "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
        )
      }
    }
  })()

  /**
   * Colors.
   */

  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33",
  ]

  /**
   * Currently only WebKit-based Web Inspectors, Firefox >= v31,
   * and the Firebug extension (any Firefox version) are known
   * to support "%c" CSS customizations.
   *
   * TODO: add a `localStorage` variable to explicitly enable/disable colors
   */

  // eslint-disable-next-line complexity
  function useColors() {
    // NB: In an Electron preload script, document will be defined but not fully
    // initialized. Since we know we're in Chrome, we'll just detect this case
    // explicitly
    if (
      typeof window !== "undefined" &&
      window.process &&
      (window.process.type === "renderer" || window.process.__nwjs)
    ) {
      return true
    }

    // Internet Explorer and Edge do not support colors.
    if (
      typeof navigator !== "undefined" &&
      navigator.userAgent &&
      navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
    ) {
      return false
    }

    let m

    // Is webkit? http://stackoverflow.com/a/16459606/376773
    // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    // eslint-disable-next-line no-return-assign
    return (
      (typeof document !== "undefined" &&
        document.documentElement &&
        document.documentElement.style &&
        document.documentElement.style.WebkitAppearance) ||
      // Is firebug? http://stackoverflow.com/a/398120/376773
      (typeof window !== "undefined" &&
        window.console &&
        (window.console.firebug ||
          (window.console.exception && window.console.table))) ||
      // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      (typeof navigator !== "undefined" &&
        navigator.userAgent &&
        (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
        parseInt(m[1], 10) >= 31) ||
      // Double check webkit in userAgent just in case we are in a worker
      (typeof navigator !== "undefined" &&
        navigator.userAgent &&
        navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
    )
  }

  /**
   * Colorize log arguments if enabled.
   *
   * @api public
   */

  function formatArgs(args) {
    args[0] =
      (this.useColors ? "%c" : "") +
      this.namespace +
      (this.useColors ? " %c" : " ") +
      args[0] +
      (this.useColors ? "%c " : " ") +
      "+" +
      module.exports.humanize(this.diff)

    if (!this.useColors) {
      return
    }

    const c = "color: " + this.color
    args.splice(1, 0, c, "color: inherit")

    // The final "%c" is somewhat tricky, because there could be other
    // arguments passed either before or after the %c, so we need to
    // figure out the correct index to insert the CSS into
    let index = 0
    let lastC = 0
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return
      }
      index++
      if (match === "%c") {
        // We only are interested in the *last* %c
        // (the user may have provided their own)
        lastC = index
      }
    })

    args.splice(lastC, 0, c)
  }

  /**
   * Invokes `console.debug()` when available.
   * No-op when `console.debug` is not a "function".
   * If `console.debug` is not available, falls back
   * to `console.log`.
   *
   * @api public
   */
  exports.log = console.debug || console.log || (() => {})

  /**
   * Save `namespaces`.
   *
   * @param {String} namespaces
   * @api private
   */
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces)
      } else {
        exports.storage.removeItem("debug")
      }
    } catch (error) {
      // Swallow
      // XXX (@Qix-) should we be logging these?
    }
  }

  /**
   * Load `namespaces`.
   *
   * @return {String} returns the previously persisted debug modes
   * @api private
   */
  function load() {
    let r
    try {
      r = exports.storage.getItem("debug")
    } catch (error) {
      // Swallow
      // XXX (@Qix-) should we be logging these?
    }

    // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG
    }

    return r
  }

  /**
   * Localstorage attempts to return the localstorage.
   *
   * This is necessary because safari throws
   * when a user disables cookies/localstorage
   * and you attempt to access it.
   *
   * @return {LocalStorage}
   * @api private
   */

  function localstorage() {
    try {
      // TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
      // The Browser also has localStorage in the global context.
      return localStorage
    } catch (error) {
      // Swallow
      // XXX (@Qix-) should we be logging these?
    }
  }

  module.exports = common(exports)

  const { formatters } = module.exports

  /**
   * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
   */

  formatters.j = function (v) {
    try {
      return JSON.stringify(v)
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message
    }
  }
})(browser, browser.exports)

var browserExports = browser.exports
var initDebug = /*@__PURE__*/ getDefaultExportFromCjs(browserExports)

var TargetType
;(function (TargetType) {
  TargetType[(TargetType["shot"] = 10)] = "shot"
  TargetType[(TargetType["scene"] = 20)] = "scene"
  TargetType[(TargetType["track"] = 30)] = "track"
  TargetType[(TargetType["part"] = 40)] = "part"
  TargetType[(TargetType["album"] = 50)] = "album"
  TargetType[(TargetType["edition"] = 60)] = "edition"
  TargetType[(TargetType["collection"] = 70)] = "collection"
})(TargetType || (TargetType = {}))
var TrackType
;(function (TrackType) {
  TrackType[(TrackType["video"] = 1)] = "video"
  TrackType[(TrackType["audio"] = 2)] = "audio"
  TrackType[(TrackType["complex"] = 3)] = "complex"
  TrackType[(TrackType["logo"] = 4)] = "logo"
  TrackType[(TrackType["subtitle"] = 17)] = "subtitle"
  TrackType[(TrackType["button"] = 18)] = "button"
  TrackType[(TrackType["control"] = 32)] = "control"
})(TrackType || (TrackType = {}))

const makeParseError = (name) => {
  return class ParseError extends Error {
    constructor(message) {
      super(message)
      this.name = name
    }
  }
}
// Concrete error class representing a file type determination failure.
class CouldNotDetermineFileTypeError extends makeParseError(
  "CouldNotDetermineFileTypeError",
) {}
// Concrete error class representing an unsupported file type.
class UnsupportedFileTypeError extends makeParseError(
  "UnsupportedFileTypeError",
) {}
// Concrete error class representing unexpected file content.
class UnexpectedFileContentError extends makeParseError(
  "UnexpectedFileContentError",
) {
  constructor(fileType, message) {
    super(message)
    this.fileType = fileType
  }
  // Override toString to include file type information.
  toString() {
    return `${this.name} (FileType: ${this.fileType}): ${this.message}`
  }
}
// Concrete error class representing a field decoding error.
class FieldDecodingError extends makeParseError("FieldDecodingError") {}
class InternalParserError extends makeParseError("InternalParserError") {}
// Factory function to create a specific type of UnexpectedFileContentError.
const makeUnexpectedFileContentError = (fileType) => {
  return class extends UnexpectedFileContentError {
    constructor(message) {
      super(fileType, message)
    }
  }
}

function getBit(buf, off, bit) {
  return (buf[off] & (1 << bit)) !== 0
}
/**
 * Found delimiting zero in uint8Array
 * @param uint8Array Uint8Array to find the zero delimiter in
 * @param start Offset in uint8Array
 * @param end Last position to parse in uint8Array
 * @param encoding The string encoding used
 * @return Absolute position on uint8Array where zero found
 */
function findZero(uint8Array, start, end, encoding) {
  let i = start
  if (encoding === "utf-16le") {
    while (uint8Array[i] !== 0 || uint8Array[i + 1] !== 0) {
      if (i >= end) return end
      i += 2
    }
    return i
  }
  while (uint8Array[i] !== 0) {
    if (i >= end) return end
    i++
  }
  return i
}
function trimRightNull(x) {
  const pos0 = x.indexOf("\0")
  return pos0 === -1 ? x : x.substr(0, pos0)
}
function swapBytes(uint8Array) {
  const l = uint8Array.length
  if ((l & 1) !== 0) throw new FieldDecodingError("Buffer length must be even")
  for (let i = 0; i < l; i += 2) {
    const a = uint8Array[i]
    uint8Array[i] = uint8Array[i + 1]
    uint8Array[i + 1] = a
  }
  return uint8Array
}
/**
 * Decode string
 */
function decodeString(uint8Array, encoding) {
  // annoying workaround for a double BOM issue
  // https://github.com/leetreveil/musicmetadata/issues/84
  if (uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
    // little endian
    return decodeString(uint8Array.subarray(2), encoding)
  }
  if (
    encoding === "utf-16le" &&
    uint8Array[0] === 0xfe &&
    uint8Array[1] === 0xff
  ) {
    // BOM, indicating big endian decoding
    if ((uint8Array.length & 1) !== 0)
      throw new FieldDecodingError(
        "Expected even number of octets for 16-bit unicode string",
      )
    return decodeString(swapBytes(uint8Array), encoding)
  }
  return new StringType(uint8Array.length, encoding).get(uint8Array, 0)
}
function stripNulls(str) {
  str = str.replace(/^\x00+/g, "")
  str = str.replace(/\x00+$/g, "")
  return str
}
/**
 * Read bit-aligned number start from buffer
 * Total offset in bits = byteOffset * 8 + bitOffset
 * @param source Byte buffer
 * @param byteOffset Starting offset in bytes
 * @param bitOffset Starting offset in bits: 0 = lsb
 * @param len Length of number in bits
 * @return Decoded bit aligned number
 */
function getBitAllignedNumber$1(source, byteOffset, bitOffset, len) {
  const byteOff = byteOffset + ~~(bitOffset / 8)
  const bitOff = bitOffset % 8
  let value = source[byteOff]
  value &= 0xff >> bitOff
  const bitsRead = 8 - bitOff
  const bitsLeft = len - bitsRead
  if (bitsLeft < 0) {
    value >>= 8 - bitOff - len
  } else if (bitsLeft > 0) {
    value <<= bitsLeft
    value |= getBitAllignedNumber$1(
      source,
      byteOffset,
      bitOffset + bitsRead,
      bitsLeft,
    )
  }
  return value
}
/**
 * Read bit-aligned number start from buffer
 * Total offset in bits = byteOffset * 8 + bitOffset
 * @param source Byte Uint8Array
 * @param byteOffset Starting offset in bytes
 * @param bitOffset Starting offset in bits: 0 = most significant bit, 7 is the least significant bit
 * @return True if bit is set
 */
function isBitSet$2(source, byteOffset, bitOffset) {
  return getBitAllignedNumber$1(source, byteOffset, bitOffset, 1) === 1
}
function a2hex(str) {
  const arr = []
  for (let i = 0, l = str.length; i < l; i++) {
    const hex = Number(str.charCodeAt(i)).toString(16)
    arr.push(hex.length === 1 ? `0${hex}` : hex)
  }
  return arr.join(" ")
}
/**
 * Convert power ratio to DB
 * ratio: [0..1]
 */
function ratioToDb(ratio) {
  return 10 * Math.log10(ratio)
}
/**
 * Convert dB to ratio
 * db Decibels
 */
function dbToRatio(dB) {
  return 10 ** (dB / 10)
}
/**
 * Convert replay gain to ratio and Decibel
 * @param value string holding a ratio like '0.034' or '-7.54 dB'
 */
function toRatio(value) {
  const ps = value.split(" ").map((p) => p.trim().toLowerCase())
  // @ts-ignore
  if (ps.length >= 1) {
    const v = Number.parseFloat(ps[0])
    return ps.length === 2 && ps[1] === "db"
      ? {
          dB: v,
          ratio: dbToRatio(v),
        }
      : {
          dB: ratioToDb(v),
          ratio: v,
        }
  }
}

/**
 * The picture type according to the ID3v2 APIC frame
 * Ref: http://id3.org/id3v2.3.0#Attached_picture
 */
var AttachedPictureType
;(function (AttachedPictureType) {
  AttachedPictureType[(AttachedPictureType["Other"] = 0)] = "Other"
  AttachedPictureType[
    (AttachedPictureType["32x32 pixels 'file icon' (PNG only)"] = 1)
  ] = "32x32 pixels 'file icon' (PNG only)"
  AttachedPictureType[(AttachedPictureType["Other file icon"] = 2)] =
    "Other file icon"
  AttachedPictureType[(AttachedPictureType["Cover (front)"] = 3)] =
    "Cover (front)"
  AttachedPictureType[(AttachedPictureType["Cover (back)"] = 4)] =
    "Cover (back)"
  AttachedPictureType[(AttachedPictureType["Leaflet page"] = 5)] =
    "Leaflet page"
  AttachedPictureType[
    (AttachedPictureType["Media (e.g. label side of CD)"] = 6)
  ] = "Media (e.g. label side of CD)"
  AttachedPictureType[
    (AttachedPictureType["Lead artist/lead performer/soloist"] = 7)
  ] = "Lead artist/lead performer/soloist"
  AttachedPictureType[(AttachedPictureType["Artist/performer"] = 8)] =
    "Artist/performer"
  AttachedPictureType[(AttachedPictureType["Conductor"] = 9)] = "Conductor"
  AttachedPictureType[(AttachedPictureType["Band/Orchestra"] = 10)] =
    "Band/Orchestra"
  AttachedPictureType[(AttachedPictureType["Composer"] = 11)] = "Composer"
  AttachedPictureType[(AttachedPictureType["Lyricist/text writer"] = 12)] =
    "Lyricist/text writer"
  AttachedPictureType[(AttachedPictureType["Recording Location"] = 13)] =
    "Recording Location"
  AttachedPictureType[(AttachedPictureType["During recording"] = 14)] =
    "During recording"
  AttachedPictureType[(AttachedPictureType["During performance"] = 15)] =
    "During performance"
  AttachedPictureType[
    (AttachedPictureType["Movie/video screen capture"] = 16)
  ] = "Movie/video screen capture"
  AttachedPictureType[(AttachedPictureType["A bright coloured fish"] = 17)] =
    "A bright coloured fish"
  AttachedPictureType[(AttachedPictureType["Illustration"] = 18)] =
    "Illustration"
  AttachedPictureType[(AttachedPictureType["Band/artist logotype"] = 19)] =
    "Band/artist logotype"
  AttachedPictureType[(AttachedPictureType["Publisher/Studio logotype"] = 20)] =
    "Publisher/Studio logotype"
})(AttachedPictureType || (AttachedPictureType = {}))
/**
 * https://id3.org/id3v2.3.0#Synchronised_lyrics.2Ftext
 */
var LyricsContentType
;(function (LyricsContentType) {
  LyricsContentType[(LyricsContentType["other"] = 0)] = "other"
  LyricsContentType[(LyricsContentType["lyrics"] = 1)] = "lyrics"
  LyricsContentType[(LyricsContentType["text"] = 2)] = "text"
  LyricsContentType[(LyricsContentType["movement_part"] = 3)] = "movement_part"
  LyricsContentType[(LyricsContentType["events"] = 4)] = "events"
  LyricsContentType[(LyricsContentType["chord"] = 5)] = "chord"
  LyricsContentType[(LyricsContentType["trivia_pop"] = 6)] = "trivia_pop"
})(LyricsContentType || (LyricsContentType = {}))
var TimestampFormat
;(function (TimestampFormat) {
  TimestampFormat[(TimestampFormat["notSynchronized0"] = 0)] =
    "notSynchronized0"
  TimestampFormat[(TimestampFormat["mpegFrameNumber"] = 1)] = "mpegFrameNumber"
  TimestampFormat[(TimestampFormat["milliseconds"] = 2)] = "milliseconds"
})(TimestampFormat || (TimestampFormat = {}))
/**
 * 28 bits (representing up to 256MB) integer, the msb is 0 to avoid 'false syncsignals'.
 * 4 * %0xxxxxxx
 */
const UINT32SYNCSAFE = {
  get: (buf, off) => {
    return (
      (buf[off + 3] & 0x7f) |
      (buf[off + 2] << 7) |
      (buf[off + 1] << 14) |
      (buf[off] << 21)
    )
  },
  len: 4,
}
/**
 * ID3v2 header
 * Ref: http://id3.org/id3v2.3.0#ID3v2_header
 * ToDo
 */
const ID3v2Header = {
  len: 10,
  get: (buf, off) => {
    return {
      // ID3v2/file identifier   "ID3"
      fileIdentifier: new StringType(3, "ascii").get(buf, off),
      // ID3v2 versionIndex
      version: {
        major: INT8.get(buf, off + 3),
        revision: INT8.get(buf, off + 4),
      },
      // ID3v2 flags
      flags: {
        // Unsynchronisation
        unsynchronisation: getBit(buf, off + 5, 7),
        // Extended header
        isExtendedHeader: getBit(buf, off + 5, 6),
        // Experimental indicator
        expIndicator: getBit(buf, off + 5, 5),
        footer: getBit(buf, off + 5, 4),
      },
      size: UINT32SYNCSAFE.get(buf, off + 6),
    }
  },
}
const ExtendedHeader = {
  len: 10,
  get: (buf, off) => {
    return {
      // Extended header size
      size: UINT32_BE.get(buf, off),
      // Extended Flags
      extendedFlags: UINT16_BE.get(buf, off + 4),
      // Size of padding
      sizeOfPadding: UINT32_BE.get(buf, off + 6),
      // CRC data present
      crcDataPresent: getBit(buf, off + 4, 31),
    }
  },
}
const TextEncodingToken = {
  len: 1,
  get: (uint8Array, off) => {
    switch (uint8Array[off]) {
      case 0x00:
        return { encoding: "latin1" } // binary
      case 0x01:
        return { encoding: "utf-16le", bom: true }
      case 0x02:
        return { encoding: "utf-16le", bom: false }
      case 0x03:
        return { encoding: "utf8", bom: false }
      default:
        return { encoding: "utf8", bom: false }
    }
  },
}
/**
 * Used to read first portion of `SYLT` frame
 */
const TextHeader = {
  len: 4,
  get: (uint8Array, off) => {
    return {
      encoding: TextEncodingToken.get(uint8Array, off),
      language: new StringType(3, "latin1").get(uint8Array, off + 1),
    }
  },
}
/**
 * Used to read first portion of `SYLT` frame
 */
const SyncTextHeader = {
  len: 6,
  get: (uint8Array, off) => {
    const text = TextHeader.get(uint8Array, off)
    return {
      encoding: text.encoding,
      language: text.language,
      timeStampFormat: UINT8.get(uint8Array, off + 4),
      contentType: UINT8.get(uint8Array, off + 5),
    }
  },
}

const commonTags = {
  "year": { multiple: false },
  "track": { multiple: false },
  "disk": { multiple: false },
  "title": { multiple: false },
  "artist": { multiple: false },
  "artists": { multiple: true, unique: true },
  "albumartist": { multiple: false },
  "album": { multiple: false },
  "date": { multiple: false },
  "originaldate": { multiple: false },
  "originalyear": { multiple: false },
  "releasedate": { multiple: false },
  "comment": { multiple: true, unique: false },
  "genre": { multiple: true, unique: true },
  "picture": { multiple: true, unique: true },
  "composer": { multiple: true, unique: true },
  "lyrics": { multiple: true, unique: false },
  "albumsort": { multiple: false, unique: true },
  "titlesort": { multiple: false, unique: true },
  "work": { multiple: false, unique: true },
  "artistsort": { multiple: false, unique: true },
  "albumartistsort": { multiple: false, unique: true },
  "composersort": { multiple: false, unique: true },
  "lyricist": { multiple: true, unique: true },
  "writer": { multiple: true, unique: true },
  "conductor": { multiple: true, unique: true },
  "remixer": { multiple: true, unique: true },
  "arranger": { multiple: true, unique: true },
  "engineer": { multiple: true, unique: true },
  "producer": { multiple: true, unique: true },
  "technician": { multiple: true, unique: true },
  "djmixer": { multiple: true, unique: true },
  "mixer": { multiple: true, unique: true },
  "label": { multiple: true, unique: true },
  "grouping": { multiple: false },
  "subtitle": { multiple: true },
  "discsubtitle": { multiple: false },
  "totaltracks": { multiple: false },
  "totaldiscs": { multiple: false },
  "compilation": { multiple: false },
  "rating": { multiple: true },
  "bpm": { multiple: false },
  "mood": { multiple: false },
  "media": { multiple: false },
  "catalognumber": { multiple: true, unique: true },
  "tvShow": { multiple: false },
  "tvShowSort": { multiple: false },
  "tvSeason": { multiple: false },
  "tvEpisode": { multiple: false },
  "tvEpisodeId": { multiple: false },
  "tvNetwork": { multiple: false },
  "podcast": { multiple: false },
  "podcasturl": { multiple: false },
  "releasestatus": { multiple: false },
  "releasetype": { multiple: true },
  "releasecountry": { multiple: false },
  "script": { multiple: false },
  "language": { multiple: false },
  "copyright": { multiple: false },
  "license": { multiple: false },
  "encodedby": { multiple: false },
  "encodersettings": { multiple: false },
  "gapless": { multiple: false },
  "barcode": { multiple: false },
  "isrc": { multiple: true },
  "asin": { multiple: false },
  "musicbrainz_recordingid": { multiple: false },
  "musicbrainz_trackid": { multiple: false },
  "musicbrainz_albumid": { multiple: false },
  "musicbrainz_artistid": { multiple: true },
  "musicbrainz_albumartistid": { multiple: true },
  "musicbrainz_releasegroupid": { multiple: false },
  "musicbrainz_workid": { multiple: false },
  "musicbrainz_trmid": { multiple: false },
  "musicbrainz_discid": { multiple: false },
  "acoustid_id": { multiple: false },
  "acoustid_fingerprint": { multiple: false },
  "musicip_puid": { multiple: false },
  "musicip_fingerprint": { multiple: false },
  "website": { multiple: false },
  "performer:instrument": { multiple: true, unique: true },
  "averageLevel": { multiple: false },
  "peakLevel": { multiple: false },
  "notes": { multiple: true, unique: false },
  "key": { multiple: false },
  "originalalbum": { multiple: false },
  "originalartist": { multiple: false },
  "discogs_artist_id": { multiple: true, unique: true },
  "discogs_release_id": { multiple: false },
  "discogs_label_id": { multiple: false },
  "discogs_master_release_id": { multiple: false },
  "discogs_votes": { multiple: false },
  "discogs_rating": { multiple: false },
  "replaygain_track_peak": { multiple: false },
  "replaygain_track_gain": { multiple: false },
  "replaygain_album_peak": { multiple: false },
  "replaygain_album_gain": { multiple: false },
  "replaygain_track_minmax": { multiple: false },
  "replaygain_album_minmax": { multiple: false },
  "replaygain_undo": { multiple: false },
  "description": { multiple: true },
  "longDescription": { multiple: false },
  "category": { multiple: true },
  "hdVideo": { multiple: false },
  "keywords": { multiple: true },
  "movement": { multiple: false },
  "movementIndex": { multiple: false },
  "movementTotal": { multiple: false },
  "podcastId": { multiple: false },
  "showMovement": { multiple: false },
  "stik": { multiple: false },
}
/**
 * @param alias Name of common tag
 * @returns {boolean|*} true if given alias is mapped as a singleton', otherwise false
 */
function isSingleton(alias) {
  return commonTags[alias] && !commonTags[alias].multiple
}
/**
 * @param alias Common (generic) tag
 * @returns {boolean|*} true if given alias is a singleton or explicitly marked as unique
 */
function isUnique(alias) {
  return !commonTags[alias].multiple || commonTags[alias].unique || false
}

class CommonTagMapper {
  static toIntOrNull(str) {
    const cleaned = Number.parseInt(str, 10)
    return Number.isNaN(cleaned) ? null : cleaned
  }
  // TODO: a string of 1of1 would fail to be converted
  // converts 1/10 to no : 1, of : 10
  // or 1 to no : 1, of : 0
  static normalizeTrack(origVal) {
    const split = origVal.toString().split("/")
    return {
      no: Number.parseInt(split[0], 10) || null,
      of: Number.parseInt(split[1], 10) || null,
    }
  }
  constructor(tagTypes, tagMap) {
    this.tagTypes = tagTypes
    this.tagMap = tagMap
  }
  /**
   * Process and set common tags
   * write common tags to
   * @param tag Native tag
   * @param warnings Register warnings
   * @return common name
   */
  mapGenericTag(tag, warnings) {
    tag = { id: tag.id, value: tag.value } // clone object
    this.postMap(tag, warnings)
    // Convert native tag event to generic 'alias' tag
    const id = this.getCommonName(tag.id)
    return id ? { id, value: tag.value } : null
  }
  /**
   * Convert native tag key to common tag key
   * @param tag Native header tag
   * @return common tag name (alias)
   */
  getCommonName(tag) {
    return this.tagMap[tag]
  }
  /**
   * Handle post mapping exceptions / correction
   * @param tag Tag e.g. {"©alb", "Buena Vista Social Club")
   * @param warnings Used to register warnings
   */
  postMap(tag, warnings) {
    return
  }
}
CommonTagMapper.maxRatingScore = 1

/**
 * ID3v1 tag mappings
 */
const id3v1TagMap = {
  title: "title",
  artist: "artist",
  album: "album",
  year: "year",
  comment: "comment",
  track: "track",
  genre: "genre",
}
class ID3v1TagMapper extends CommonTagMapper {
  constructor() {
    super(["ID3v1"], id3v1TagMap)
  }
}

class CaseInsensitiveTagMap extends CommonTagMapper {
  constructor(tagTypes, tagMap) {
    const upperCaseMap = {}
    for (const tag of Object.keys(tagMap)) {
      upperCaseMap[tag.toUpperCase()] = tagMap[tag]
    }
    super(tagTypes, upperCaseMap)
  }
  /**
   * @tag  Native header tag
   * @return common tag name (alias)
   */
  getCommonName(tag) {
    return this.tagMap[tag.toUpperCase()]
  }
}

/**
 * ID3v2.3/ID3v2.4 tag mappings
 */
const id3v24TagMap = {
  // id3v2.3
  "TIT2": "title",
  "TPE1": "artist",
  "TXXX:Artists": "artists",
  "TPE2": "albumartist",
  "TALB": "album",
  "TDRV": "date", // [ 'date', 'year' ] ToDo: improve 'year' mapping
  /**
   * Original release year
   */
  "TORY": "originalyear",
  "TPOS": "disk",
  "TCON": "genre",
  "APIC": "picture",
  "TCOM": "composer",
  "USLT": "lyrics",
  "TSOA": "albumsort",
  "TSOT": "titlesort",
  "TOAL": "originalalbum",
  "TSOP": "artistsort",
  "TSO2": "albumartistsort",
  "TSOC": "composersort",
  "TEXT": "lyricist",
  "TXXX:Writer": "writer",
  "TPE3": "conductor",
  // 'IPLS:instrument': 'performer:instrument', // ToDo
  "TPE4": "remixer",
  "IPLS:arranger": "arranger",
  "IPLS:engineer": "engineer",
  "IPLS:producer": "producer",
  "IPLS:DJ-mix": "djmixer",
  "IPLS:mix": "mixer",
  "TPUB": "label",
  "TIT1": "grouping",
  "TIT3": "subtitle",
  "TRCK": "track",
  "TCMP": "compilation",
  "POPM": "rating",
  "TBPM": "bpm",
  "TMED": "media",
  "TXXX:CATALOGNUMBER": "catalognumber",
  "TXXX:MusicBrainz Album Status": "releasestatus",
  "TXXX:MusicBrainz Album Type": "releasetype",
  /**
   * Release country as documented: https://picard.musicbrainz.org/docs/mappings/#cite_note-0
   */
  "TXXX:MusicBrainz Album Release Country": "releasecountry",
  /**
   * Release country as implemented // ToDo: report
   */
  "TXXX:RELEASECOUNTRY": "releasecountry",
  "TXXX:SCRIPT": "script",
  "TLAN": "language",
  "TCOP": "copyright",
  "WCOP": "license",
  "TENC": "encodedby",
  "TSSE": "encodersettings",
  "TXXX:BARCODE": "barcode",
  "TXXX:ISRC": "isrc",
  "TSRC": "isrc",
  "TXXX:ASIN": "asin",
  "TXXX:originalyear": "originalyear",
  "UFID:http://musicbrainz.org": "musicbrainz_recordingid",
  "TXXX:MusicBrainz Release Track Id": "musicbrainz_trackid",
  "TXXX:MusicBrainz Album Id": "musicbrainz_albumid",
  "TXXX:MusicBrainz Artist Id": "musicbrainz_artistid",
  "TXXX:MusicBrainz Album Artist Id": "musicbrainz_albumartistid",
  "TXXX:MusicBrainz Release Group Id": "musicbrainz_releasegroupid",
  "TXXX:MusicBrainz Work Id": "musicbrainz_workid",
  "TXXX:MusicBrainz TRM Id": "musicbrainz_trmid",
  "TXXX:MusicBrainz Disc Id": "musicbrainz_discid",
  "TXXX:ACOUSTID_ID": "acoustid_id",
  "TXXX:Acoustid Id": "acoustid_id",
  "TXXX:Acoustid Fingerprint": "acoustid_fingerprint",
  "TXXX:MusicIP PUID": "musicip_puid",
  "TXXX:MusicMagic Fingerprint": "musicip_fingerprint",
  "WOAR": "website",
  // id3v2.4
  // ToDo: In same sequence as defined at http://id3.org/id3v2.4.0-frames
  "TDRC": "date", // date YYYY-MM-DD
  "TYER": "year",
  "TDOR": "originaldate",
  // 'TMCL:instrument': 'performer:instrument',
  "TIPL:arranger": "arranger",
  "TIPL:engineer": "engineer",
  "TIPL:producer": "producer",
  "TIPL:DJ-mix": "djmixer",
  "TIPL:mix": "mixer",
  "TMOO": "mood",
  // additional mappings:
  "SYLT": "lyrics",
  "TSST": "discsubtitle",
  "TKEY": "key",
  "COMM": "comment",
  "TOPE": "originalartist",
  // Windows Media Player
  "PRIV:AverageLevel": "averageLevel",
  "PRIV:PeakLevel": "peakLevel",
  // Discogs
  "TXXX:DISCOGS_ARTIST_ID": "discogs_artist_id",
  "TXXX:DISCOGS_ARTISTS": "artists",
  "TXXX:DISCOGS_ARTIST_NAME": "artists",
  "TXXX:DISCOGS_ALBUM_ARTISTS": "albumartist",
  "TXXX:DISCOGS_CATALOG": "catalognumber",
  "TXXX:DISCOGS_COUNTRY": "releasecountry",
  "TXXX:DISCOGS_DATE": "originaldate",
  "TXXX:DISCOGS_LABEL": "label",
  "TXXX:DISCOGS_LABEL_ID": "discogs_label_id",
  "TXXX:DISCOGS_MASTER_RELEASE_ID": "discogs_master_release_id",
  "TXXX:DISCOGS_RATING": "discogs_rating",
  "TXXX:DISCOGS_RELEASED": "date",
  "TXXX:DISCOGS_RELEASE_ID": "discogs_release_id",
  "TXXX:DISCOGS_VOTES": "discogs_votes",
  "TXXX:CATALOGID": "catalognumber",
  "TXXX:STYLE": "genre",
  "TXXX:REPLAYGAIN_TRACK_PEAK": "replaygain_track_peak",
  "TXXX:REPLAYGAIN_TRACK_GAIN": "replaygain_track_gain",
  "TXXX:REPLAYGAIN_ALBUM_PEAK": "replaygain_album_peak",
  "TXXX:REPLAYGAIN_ALBUM_GAIN": "replaygain_album_gain",
  "TXXX:MP3GAIN_MINMAX": "replaygain_track_minmax",
  "TXXX:MP3GAIN_ALBUM_MINMAX": "replaygain_album_minmax",
  "TXXX:MP3GAIN_UNDO": "replaygain_undo",
  "MVNM": "movement",
  "MVIN": "movementIndex",
  "PCST": "podcast",
  "TCAT": "category",
  "TDES": "description",
  "TDRL": "releasedate",
  "TGID": "podcastId",
  "TKWD": "keywords",
  "WFED": "podcasturl",
  "GRP1": "grouping",
}
class ID3v24TagMapper extends CaseInsensitiveTagMap {
  static toRating(popm) {
    return {
      source: popm.email,
      rating:
        popm.rating > 0
          ? ((popm.rating - 1) / 254) * CommonTagMapper.maxRatingScore
          : undefined,
    }
  }
  constructor() {
    super(["ID3v2.3", "ID3v2.4"], id3v24TagMap)
  }
  /**
   * Handle post mapping exceptions / correction
   * @param tag to post map
   * @param warnings Wil be used to register (collect) warnings
   */
  postMap(tag, warnings) {
    switch (tag.id) {
      case "UFID":
        {
          // decode MusicBrainz Recording Id
          const idTag = tag.value
          if (idTag.owner_identifier === "http://musicbrainz.org") {
            tag.id += `:${idTag.owner_identifier}`
            tag.value = decodeString(idTag.identifier, "latin1") // latin1 == iso-8859-1
          }
        }
        break
      case "PRIV":
        {
          const customTag = tag.value
          switch (customTag.owner_identifier) {
            // decode Windows Media Player
            case "AverageLevel":
            case "PeakValue":
              tag.id += `:${customTag.owner_identifier}`
              tag.value =
                customTag.data.length === 4
                  ? UINT32_LE.get(customTag.data, 0)
                  : null
              if (tag.value === null) {
                warnings.addWarning("Failed to parse PRIV:PeakValue")
              }
              break
            default:
              warnings.addWarning(
                `Unknown PRIV owner-identifier: ${customTag.data}`,
              )
          }
        }
        break
      case "POPM":
        tag.value = ID3v24TagMapper.toRating(tag.value)
        break
    }
  }
}

/**
 * ASF Metadata tag mappings.
 * See http://msdn.microsoft.com/en-us/library/ms867702.aspx
 */
const asfTagMap = {
  "Title": "title",
  "Author": "artist",
  "WM/AlbumArtist": "albumartist",
  "WM/AlbumTitle": "album",
  "WM/Year": "date", // changed to 'year' to 'date' based on Picard mappings; ToDo: check me
  "WM/OriginalReleaseTime": "originaldate",
  "WM/OriginalReleaseYear": "originalyear",
  "Description": "comment",
  "WM/TrackNumber": "track",
  "WM/PartOfSet": "disk",
  "WM/Genre": "genre",
  "WM/Composer": "composer",
  "WM/Lyrics": "lyrics",
  "WM/AlbumSortOrder": "albumsort",
  "WM/TitleSortOrder": "titlesort",
  "WM/ArtistSortOrder": "artistsort",
  "WM/AlbumArtistSortOrder": "albumartistsort",
  "WM/ComposerSortOrder": "composersort",
  "WM/Writer": "lyricist",
  "WM/Conductor": "conductor",
  "WM/ModifiedBy": "remixer",
  "WM/Engineer": "engineer",
  "WM/Producer": "producer",
  "WM/DJMixer": "djmixer",
  "WM/Mixer": "mixer",
  "WM/Publisher": "label",
  "WM/ContentGroupDescription": "grouping",
  "WM/SubTitle": "subtitle",
  "WM/SetSubTitle": "discsubtitle",
  // 'WM/PartOfSet': 'totaldiscs',
  "WM/IsCompilation": "compilation",
  "WM/SharedUserRating": "rating",
  "WM/BeatsPerMinute": "bpm",
  "WM/Mood": "mood",
  "WM/Media": "media",
  "WM/CatalogNo": "catalognumber",
  "MusicBrainz/Album Status": "releasestatus",
  "MusicBrainz/Album Type": "releasetype",
  "MusicBrainz/Album Release Country": "releasecountry",
  "WM/Script": "script",
  "WM/Language": "language",
  "Copyright": "copyright",
  "LICENSE": "license",
  "WM/EncodedBy": "encodedby",
  "WM/EncodingSettings": "encodersettings",
  "WM/Barcode": "barcode",
  "WM/ISRC": "isrc",
  "MusicBrainz/Track Id": "musicbrainz_recordingid",
  "MusicBrainz/Release Track Id": "musicbrainz_trackid",
  "MusicBrainz/Album Id": "musicbrainz_albumid",
  "MusicBrainz/Artist Id": "musicbrainz_artistid",
  "MusicBrainz/Album Artist Id": "musicbrainz_albumartistid",
  "MusicBrainz/Release Group Id": "musicbrainz_releasegroupid",
  "MusicBrainz/Work Id": "musicbrainz_workid",
  "MusicBrainz/TRM Id": "musicbrainz_trmid",
  "MusicBrainz/Disc Id": "musicbrainz_discid",
  "Acoustid/Id": "acoustid_id",
  "Acoustid/Fingerprint": "acoustid_fingerprint",
  "MusicIP/PUID": "musicip_puid",
  "WM/ARTISTS": "artists",
  "WM/InitialKey": "key",
  "ASIN": "asin",
  "WM/Work": "work",
  "WM/AuthorURL": "website",
  "WM/Picture": "picture",
}
class AsfTagMapper extends CommonTagMapper {
  static toRating(rating) {
    return {
      rating: Number.parseFloat(rating + 1) / 5,
    }
  }
  constructor() {
    super(["asf"], asfTagMap)
  }
  postMap(tag) {
    switch (tag.id) {
      case "WM/SharedUserRating": {
        const keys = tag.id.split(":")
        tag.value = AsfTagMapper.toRating(tag.value)
        tag.id = keys[0]
        break
      }
    }
  }
}

/**
 * ID3v2.2 tag mappings
 */
const id3v22TagMap = {
  TT2: "title",
  TP1: "artist",
  TP2: "albumartist",
  TAL: "album",
  TYE: "year",
  COM: "comment",
  TRK: "track",
  TPA: "disk",
  TCO: "genre",
  PIC: "picture",
  TCM: "composer",
  TOR: "originaldate",
  TOT: "originalalbum",
  TXT: "lyricist",
  TP3: "conductor",
  TPB: "label",
  TT1: "grouping",
  TT3: "subtitle",
  TLA: "language",
  TCR: "copyright",
  WCP: "license",
  TEN: "encodedby",
  TSS: "encodersettings",
  WAR: "website",
  PCS: "podcast",
  TCP: "compilation",
  TDR: "date",
  TS2: "albumartistsort",
  TSA: "albumsort",
  TSC: "composersort",
  TSP: "artistsort",
  TST: "titlesort",
  WFD: "podcasturl",
  TBP: "bpm",
}
class ID3v22TagMapper extends CaseInsensitiveTagMap {
  constructor() {
    super(["ID3v2.2"], id3v22TagMap)
  }
}

/**
 * ID3v2.2 tag mappings
 */
const apev2TagMap = {
  "Title": "title",
  "Artist": "artist",
  "Artists": "artists",
  "Album Artist": "albumartist",
  "Album": "album",
  "Year": "date",
  "Originalyear": "originalyear",
  "Originaldate": "originaldate",
  "Releasedate": "releasedate",
  "Comment": "comment",
  "Track": "track",
  "Disc": "disk",
  "DISCNUMBER": "disk", // ToDo: backwards compatibility', valid tag?
  "Genre": "genre",
  "Cover Art (Front)": "picture",
  "Cover Art (Back)": "picture",
  "Composer": "composer",
  "Lyrics": "lyrics",
  "ALBUMSORT": "albumsort",
  "TITLESORT": "titlesort",
  "WORK": "work",
  "ARTISTSORT": "artistsort",
  "ALBUMARTISTSORT": "albumartistsort",
  "COMPOSERSORT": "composersort",
  "Lyricist": "lyricist",
  "Writer": "writer",
  "Conductor": "conductor",
  // 'Performer=artist (instrument)': 'performer:instrument',
  "MixArtist": "remixer",
  "Arranger": "arranger",
  "Engineer": "engineer",
  "Producer": "producer",
  "DJMixer": "djmixer",
  "Mixer": "mixer",
  "Label": "label",
  "Grouping": "grouping",
  "Subtitle": "subtitle",
  "DiscSubtitle": "discsubtitle",
  "Compilation": "compilation",
  "BPM": "bpm",
  "Mood": "mood",
  "Media": "media",
  "CatalogNumber": "catalognumber",
  "MUSICBRAINZ_ALBUMSTATUS": "releasestatus",
  "MUSICBRAINZ_ALBUMTYPE": "releasetype",
  "RELEASECOUNTRY": "releasecountry",
  "Script": "script",
  "Language": "language",
  "Copyright": "copyright",
  "LICENSE": "license",
  "EncodedBy": "encodedby",
  "EncoderSettings": "encodersettings",
  "Barcode": "barcode",
  "ISRC": "isrc",
  "ASIN": "asin",
  "musicbrainz_trackid": "musicbrainz_recordingid",
  "musicbrainz_releasetrackid": "musicbrainz_trackid",
  "MUSICBRAINZ_ALBUMID": "musicbrainz_albumid",
  "MUSICBRAINZ_ARTISTID": "musicbrainz_artistid",
  "MUSICBRAINZ_ALBUMARTISTID": "musicbrainz_albumartistid",
  "MUSICBRAINZ_RELEASEGROUPID": "musicbrainz_releasegroupid",
  "MUSICBRAINZ_WORKID": "musicbrainz_workid",
  "MUSICBRAINZ_TRMID": "musicbrainz_trmid",
  "MUSICBRAINZ_DISCID": "musicbrainz_discid",
  "Acoustid_Id": "acoustid_id",
  "ACOUSTID_FINGERPRINT": "acoustid_fingerprint",
  "MUSICIP_PUID": "musicip_puid",
  "Weblink": "website",
  "REPLAYGAIN_TRACK_GAIN": "replaygain_track_gain",
  "REPLAYGAIN_TRACK_PEAK": "replaygain_track_peak",
  "MP3GAIN_MINMAX": "replaygain_track_minmax",
  "MP3GAIN_UNDO": "replaygain_undo",
}
class APEv2TagMapper extends CaseInsensitiveTagMap {
  constructor() {
    super(["APEv2"], apev2TagMap)
  }
}

/**
 * Ref: https://github.com/sergiomb2/libmp4v2/wiki/iTunesMetadata
 */
const mp4TagMap = {
  "©nam": "title",
  "©ART": "artist",
  "aART": "albumartist",
  /**
   * ToDo: Album artist seems to be stored here while Picard documentation says: aART
   */
  "----:com.apple.iTunes:Band": "albumartist",
  "©alb": "album",
  "©day": "date",
  "©cmt": "comment",
  "©com": "comment",
  "trkn": "track",
  "disk": "disk",
  "©gen": "genre",
  "covr": "picture",
  "©wrt": "composer",
  "©lyr": "lyrics",
  "soal": "albumsort",
  "sonm": "titlesort",
  "soar": "artistsort",
  "soaa": "albumartistsort",
  "soco": "composersort",
  "----:com.apple.iTunes:LYRICIST": "lyricist",
  "----:com.apple.iTunes:CONDUCTOR": "conductor",
  "----:com.apple.iTunes:REMIXER": "remixer",
  "----:com.apple.iTunes:ENGINEER": "engineer",
  "----:com.apple.iTunes:PRODUCER": "producer",
  "----:com.apple.iTunes:DJMIXER": "djmixer",
  "----:com.apple.iTunes:MIXER": "mixer",
  "----:com.apple.iTunes:LABEL": "label",
  "©grp": "grouping",
  "----:com.apple.iTunes:SUBTITLE": "subtitle",
  "----:com.apple.iTunes:DISCSUBTITLE": "discsubtitle",
  "cpil": "compilation",
  "tmpo": "bpm",
  "----:com.apple.iTunes:MOOD": "mood",
  "----:com.apple.iTunes:MEDIA": "media",
  "----:com.apple.iTunes:CATALOGNUMBER": "catalognumber",
  "tvsh": "tvShow",
  "tvsn": "tvSeason",
  "tves": "tvEpisode",
  "sosn": "tvShowSort",
  "tven": "tvEpisodeId",
  "tvnn": "tvNetwork",
  "pcst": "podcast",
  "purl": "podcasturl",
  "----:com.apple.iTunes:MusicBrainz Album Status": "releasestatus",
  "----:com.apple.iTunes:MusicBrainz Album Type": "releasetype",
  "----:com.apple.iTunes:MusicBrainz Album Release Country": "releasecountry",
  "----:com.apple.iTunes:SCRIPT": "script",
  "----:com.apple.iTunes:LANGUAGE": "language",
  "cprt": "copyright",
  "©cpy": "copyright",
  "----:com.apple.iTunes:LICENSE": "license",
  "©too": "encodedby",
  "pgap": "gapless",
  "----:com.apple.iTunes:BARCODE": "barcode",
  "----:com.apple.iTunes:ISRC": "isrc",
  "----:com.apple.iTunes:ASIN": "asin",
  "----:com.apple.iTunes:NOTES": "comment",
  "----:com.apple.iTunes:MusicBrainz Track Id": "musicbrainz_recordingid",
  "----:com.apple.iTunes:MusicBrainz Release Track Id": "musicbrainz_trackid",
  "----:com.apple.iTunes:MusicBrainz Album Id": "musicbrainz_albumid",
  "----:com.apple.iTunes:MusicBrainz Artist Id": "musicbrainz_artistid",
  "----:com.apple.iTunes:MusicBrainz Album Artist Id":
    "musicbrainz_albumartistid",
  "----:com.apple.iTunes:MusicBrainz Release Group Id":
    "musicbrainz_releasegroupid",
  "----:com.apple.iTunes:MusicBrainz Work Id": "musicbrainz_workid",
  "----:com.apple.iTunes:MusicBrainz TRM Id": "musicbrainz_trmid",
  "----:com.apple.iTunes:MusicBrainz Disc Id": "musicbrainz_discid",
  "----:com.apple.iTunes:Acoustid Id": "acoustid_id",
  "----:com.apple.iTunes:Acoustid Fingerprint": "acoustid_fingerprint",
  "----:com.apple.iTunes:MusicIP PUID": "musicip_puid",
  "----:com.apple.iTunes:fingerprint": "musicip_fingerprint",
  "----:com.apple.iTunes:replaygain_track_gain": "replaygain_track_gain",
  "----:com.apple.iTunes:replaygain_track_peak": "replaygain_track_peak",
  "----:com.apple.iTunes:replaygain_album_gain": "replaygain_album_gain",
  "----:com.apple.iTunes:replaygain_album_peak": "replaygain_album_peak",
  "----:com.apple.iTunes:replaygain_track_minmax": "replaygain_track_minmax",
  "----:com.apple.iTunes:replaygain_album_minmax": "replaygain_album_minmax",
  "----:com.apple.iTunes:replaygain_undo": "replaygain_undo",
  // Additional mappings:
  "gnre": "genre", // ToDo: check mapping
  "----:com.apple.iTunes:ALBUMARTISTSORT": "albumartistsort",
  "----:com.apple.iTunes:ARTISTS": "artists",
  "----:com.apple.iTunes:ORIGINALDATE": "originaldate",
  "----:com.apple.iTunes:ORIGINALYEAR": "originalyear",
  "----:com.apple.iTunes:RELEASEDATE": "releasedate",
  // '----:com.apple.iTunes:PERFORMER': 'performer'
  "desc": "description",
  "ldes": "longDescription",
  "©mvn": "movement",
  "©mvi": "movementIndex",
  "©mvc": "movementTotal",
  "©wrk": "work",
  "catg": "category",
  "egid": "podcastId",
  "hdvd": "hdVideo",
  "keyw": "keywords",
  "shwm": "showMovement",
  "stik": "stik",
  "rate": "rating",
}
const tagType = "iTunes"
class MP4TagMapper extends CaseInsensitiveTagMap {
  constructor() {
    super([tagType], mp4TagMap)
  }
  postMap(tag, warnings) {
    switch (tag.id) {
      case "rate":
        tag.value = {
          source: undefined,
          rating: Number.parseFloat(tag.value) / 100,
        }
        break
    }
  }
}

/**
 * Vorbis tag mappings
 *
 * Mapping from native header format to one or possibly more 'common' entries
 * The common entries aim to read the same information from different media files
 * independent of the underlying format
 */
const vorbisTagMap = {
  "TITLE": "title",
  "ARTIST": "artist",
  "ARTISTS": "artists",
  "ALBUMARTIST": "albumartist",
  "ALBUM ARTIST": "albumartist",
  "ALBUM": "album",
  "DATE": "date",
  "ORIGINALDATE": "originaldate",
  "ORIGINALYEAR": "originalyear",
  "RELEASEDATE": "releasedate",
  "COMMENT": "comment",
  "TRACKNUMBER": "track",
  "DISCNUMBER": "disk",
  "GENRE": "genre",
  "METADATA_BLOCK_PICTURE": "picture",
  "COMPOSER": "composer",
  "LYRICS": "lyrics",
  "ALBUMSORT": "albumsort",
  "TITLESORT": "titlesort",
  "WORK": "work",
  "ARTISTSORT": "artistsort",
  "ALBUMARTISTSORT": "albumartistsort",
  "COMPOSERSORT": "composersort",
  "LYRICIST": "lyricist",
  "WRITER": "writer",
  "CONDUCTOR": "conductor",
  // 'PERFORMER=artist (instrument)': 'performer:instrument', // ToDo
  "REMIXER": "remixer",
  "ARRANGER": "arranger",
  "ENGINEER": "engineer",
  "PRODUCER": "producer",
  "DJMIXER": "djmixer",
  "MIXER": "mixer",
  "LABEL": "label",
  "GROUPING": "grouping",
  "SUBTITLE": "subtitle",
  "DISCSUBTITLE": "discsubtitle",
  "TRACKTOTAL": "totaltracks",
  "DISCTOTAL": "totaldiscs",
  "COMPILATION": "compilation",
  "RATING": "rating",
  "BPM": "bpm",
  "KEY": "key",
  "MOOD": "mood",
  "MEDIA": "media",
  "CATALOGNUMBER": "catalognumber",
  "RELEASESTATUS": "releasestatus",
  "RELEASETYPE": "releasetype",
  "RELEASECOUNTRY": "releasecountry",
  "SCRIPT": "script",
  "LANGUAGE": "language",
  "COPYRIGHT": "copyright",
  "LICENSE": "license",
  "ENCODEDBY": "encodedby",
  "ENCODERSETTINGS": "encodersettings",
  "BARCODE": "barcode",
  "ISRC": "isrc",
  "ASIN": "asin",
  "MUSICBRAINZ_TRACKID": "musicbrainz_recordingid",
  "MUSICBRAINZ_RELEASETRACKID": "musicbrainz_trackid",
  "MUSICBRAINZ_ALBUMID": "musicbrainz_albumid",
  "MUSICBRAINZ_ARTISTID": "musicbrainz_artistid",
  "MUSICBRAINZ_ALBUMARTISTID": "musicbrainz_albumartistid",
  "MUSICBRAINZ_RELEASEGROUPID": "musicbrainz_releasegroupid",
  "MUSICBRAINZ_WORKID": "musicbrainz_workid",
  "MUSICBRAINZ_TRMID": "musicbrainz_trmid",
  "MUSICBRAINZ_DISCID": "musicbrainz_discid",
  "ACOUSTID_ID": "acoustid_id",
  "ACOUSTID_ID_FINGERPRINT": "acoustid_fingerprint",
  "MUSICIP_PUID": "musicip_puid",
  // 'FINGERPRINT=MusicMagic Fingerprint {fingerprint}': 'musicip_fingerprint', // ToDo
  "WEBSITE": "website",
  "NOTES": "notes",
  "TOTALTRACKS": "totaltracks",
  "TOTALDISCS": "totaldiscs",
  // Discogs
  "DISCOGS_ARTIST_ID": "discogs_artist_id",
  "DISCOGS_ARTISTS": "artists",
  "DISCOGS_ARTIST_NAME": "artists",
  "DISCOGS_ALBUM_ARTISTS": "albumartist",
  "DISCOGS_CATALOG": "catalognumber",
  "DISCOGS_COUNTRY": "releasecountry",
  "DISCOGS_DATE": "originaldate",
  "DISCOGS_LABEL": "label",
  "DISCOGS_LABEL_ID": "discogs_label_id",
  "DISCOGS_MASTER_RELEASE_ID": "discogs_master_release_id",
  "DISCOGS_RATING": "discogs_rating",
  "DISCOGS_RELEASED": "date",
  "DISCOGS_RELEASE_ID": "discogs_release_id",
  "DISCOGS_VOTES": "discogs_votes",
  "CATALOGID": "catalognumber",
  "STYLE": "genre",
  //
  "REPLAYGAIN_TRACK_GAIN": "replaygain_track_gain",
  "REPLAYGAIN_TRACK_PEAK": "replaygain_track_peak",
  "REPLAYGAIN_ALBUM_GAIN": "replaygain_album_gain",
  "REPLAYGAIN_ALBUM_PEAK": "replaygain_album_peak",
  // To Sure if these (REPLAYGAIN_MINMAX, REPLAYGAIN_ALBUM_MINMAX & REPLAYGAIN_UNDO) are used for Vorbis:
  "REPLAYGAIN_MINMAX": "replaygain_track_minmax",
  "REPLAYGAIN_ALBUM_MINMAX": "replaygain_album_minmax",
  "REPLAYGAIN_UNDO": "replaygain_undo",
}
class VorbisTagMapper extends CommonTagMapper {
  static toRating(email, rating, maxScore) {
    return {
      source: email ? email.toLowerCase() : undefined,
      rating:
        (Number.parseFloat(rating) / maxScore) * CommonTagMapper.maxRatingScore,
    }
  }
  constructor() {
    super(["vorbis"], vorbisTagMap)
  }
  postMap(tag) {
    if (tag.id === "RATING") {
      // The way Winamp 5.666 assigns rating
      tag.value = VorbisTagMapper.toRating(undefined, tag.value, 100)
    } else if (tag.id.indexOf("RATING:") === 0) {
      const keys = tag.id.split(":")
      tag.value = VorbisTagMapper.toRating(keys[1], tag.value, 1)
      tag.id = keys[0]
    }
  }
}

/**
 * RIFF Info Tags; part of the EXIF 2.3
 * Ref: http://owl.phy.queensu.ca/~phil/exiftool/TagNames/RIFF.html#Info
 */
const riffInfoTagMap = {
  IART: "artist", // Artist
  ICRD: "date", // DateCreated
  INAM: "title", // Title
  TITL: "title",
  IPRD: "album", // Product
  ITRK: "track",
  IPRT: "track", // Additional tag for track index
  COMM: "comment", // Comments
  ICMT: "comment", // Country
  ICNT: "releasecountry",
  GNRE: "genre", // Genre
  IWRI: "writer", // WrittenBy
  RATE: "rating",
  YEAR: "year",
  ISFT: "encodedby", // Software
  CODE: "encodedby", // EncodedBy
  TURL: "website", // URL,
  IGNR: "genre", // Genre
  IENG: "engineer", // Engineer
  ITCH: "technician", // Technician
  IMED: "media", // Original Media
  IRPD: "album", // Product, where the file was intended for
}
class RiffInfoTagMapper extends CommonTagMapper {
  constructor() {
    super(["exif"], riffInfoTagMap)
  }
}

/**
 * EBML Tag map
 */
const ebmlTagMap = {
  "segment:title": "title",
  "album:ARTIST": "albumartist",
  "album:ARTISTSORT": "albumartistsort",
  "album:TITLE": "album",
  "album:DATE_RECORDED": "originaldate",
  "album:DATE_RELEASED": "releasedate",
  "album:PART_NUMBER": "disk",
  "album:TOTAL_PARTS": "totaltracks",
  "track:ARTIST": "artist",
  "track:ARTISTSORT": "artistsort",
  "track:TITLE": "title",
  "track:PART_NUMBER": "track",
  "track:MUSICBRAINZ_TRACKID": "musicbrainz_recordingid",
  "track:MUSICBRAINZ_ALBUMID": "musicbrainz_albumid",
  "track:MUSICBRAINZ_ARTISTID": "musicbrainz_artistid",
  "track:PUBLISHER": "label",
  "track:GENRE": "genre",
  "track:ENCODER": "encodedby",
  "track:ENCODER_OPTIONS": "encodersettings",
  "edition:TOTAL_PARTS": "totaldiscs",
  "picture": "picture",
}
class MatroskaTagMapper extends CaseInsensitiveTagMap {
  constructor() {
    super(["matroska"], ebmlTagMap)
  }
}

/**
 * ID3v1 tag mappings
 */
const tagMap = {
  "NAME": "title",
  "AUTH": "artist",
  "(c) ": "copyright",
  "ANNO": "comment",
}
class AiffTagMapper extends CommonTagMapper {
  constructor() {
    super(["AIFF"], tagMap)
  }
}

class CombinedTagMapper {
  constructor() {
    this.tagMappers = {}
    ;[
      new ID3v1TagMapper(),
      new ID3v22TagMapper(),
      new ID3v24TagMapper(),
      new MP4TagMapper(),
      new MP4TagMapper(),
      new VorbisTagMapper(),
      new APEv2TagMapper(),
      new AsfTagMapper(),
      new RiffInfoTagMapper(),
      new MatroskaTagMapper(),
      new AiffTagMapper(),
    ].forEach((mapper) => {
      this.registerTagMapper(mapper)
    })
  }
  /**
   * Convert native to generic (common) tags
   * @param tagType Originating tag format
   * @param tag     Native tag to map to a generic tag id
   * @param warnings
   * @return Generic tag result (output of this function)
   */
  mapTag(tagType, tag, warnings) {
    const tagMapper = this.tagMappers[tagType]
    if (tagMapper) {
      return this.tagMappers[tagType].mapGenericTag(tag, warnings)
    }
    throw new InternalParserError(
      `No generic tag mapper defined for tag-format: ${tagType}`,
    )
  }
  registerTagMapper(genericTagMapper) {
    for (const tagType of genericTagMapper.tagTypes) {
      this.tagMappers[tagType] = genericTagMapper
    }
  }
}

/**
 * Parse LRC (Lyrics) formatted text
 * Ref: https://en.wikipedia.org/wiki/LRC_(file_format)
 * @param lrcString
 */
function parseLrc(lrcString) {
  const lines = lrcString.split("\n")
  const syncText = []
  // Regular expression to match LRC timestamps (e.g., [00:45.52])
  const timestampRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/
  for (const line of lines) {
    const match = line.match(timestampRegex)
    if (match) {
      const minutes = Number.parseInt(match[1], 10)
      const seconds = Number.parseInt(match[2], 10)
      const hundredths = Number.parseInt(match[3], 10)
      // Convert the timestamp to milliseconds, as per TimestampFormat.milliseconds
      const timestamp = (minutes * 60 + seconds) * 1000 + hundredths * 10
      // Get the text portion of the line (e.g., "あの蝶は自由になれたかな")
      const text = line.replace(timestampRegex, "").trim()
      syncText.push({ timestamp, text })
    }
  }
  // Creating the ILyricsTag object
  return {
    contentType: LyricsContentType.lyrics,
    timeStampFormat: TimestampFormat.milliseconds,
    syncText,
  }
}

const debug$q = initDebug("music-metadata:collector")
const TagPriority = [
  "matroska",
  "APEv2",
  "vorbis",
  "ID3v2.4",
  "ID3v2.3",
  "ID3v2.2",
  "exif",
  "asf",
  "iTunes",
  "AIFF",
  "ID3v1",
]
/**
 * Provided to the parser to uodate the metadata result.
 * Responsible for triggering async updates
 */
class MetadataCollector {
  constructor(opts) {
    this.opts = opts
    this.format = {
      tagTypes: [],
      trackInfo: [],
    }
    this.native = {}
    this.common = {
      track: { no: null, of: null },
      disk: { no: null, of: null },
      movementIndex: { no: null, of: null },
    }
    this.quality = {
      warnings: [],
    }
    /**
     * Keeps track of origin priority for each mapped id
     */
    this.commonOrigin = {}
    /**
     * Maps a tag type to a priority
     */
    this.originPriority = {}
    this.tagMapper = new CombinedTagMapper()
    let priority = 1
    for (const tagType of TagPriority) {
      this.originPriority[tagType] = priority++
    }
    this.originPriority.artificial = 500 // Filled using alternative tags
    this.originPriority.id3v1 = 600 // Consider as the worst because of the field length limit
  }
  /**
   * @returns {boolean} true if one or more tags have been found
   */
  hasAny() {
    return Object.keys(this.native).length > 0
  }
  addStreamInfo(streamInfo) {
    debug$q(
      `streamInfo: type=${streamInfo.type ? TrackType[streamInfo.type] : "?"}, codec=${streamInfo.codecName}`,
    )
    this.format.trackInfo.push(streamInfo)
  }
  setFormat(key, value) {
    debug$q(`format: ${key} = ${value}`)
    this.format[key] = value // as any to override readonly
    if (this.opts?.observer) {
      this.opts.observer({
        metadata: this,
        tag: { type: "format", id: key, value },
      })
    }
  }
  async addTag(tagType, tagId, value) {
    debug$q(`tag ${tagType}.${tagId} = ${value}`)
    if (!this.native[tagType]) {
      this.format.tagTypes.push(tagType)
      this.native[tagType] = []
    }
    this.native[tagType].push({ id: tagId, value })
    await this.toCommon(tagType, tagId, value)
  }
  addWarning(warning) {
    this.quality.warnings.push({ message: warning })
  }
  async postMap(tagType, tag) {
    // Common tag (alias) found
    // check if we need to do something special with common tag
    // if the event has been aliased then we need to clean it before
    // it is emitted to the user. e.g. genre (20) -> Electronic
    switch (tag.id) {
      case "artist":
        if (this.commonOrigin.artist === this.originPriority[tagType]) {
          // Assume the artist field is used as artists
          return this.postMap("artificial", { id: "artists", value: tag.value })
        }
        if (!this.common.artists) {
          // Fill artists using artist source
          this.setGenericTag("artificial", { id: "artists", value: tag.value })
        }
        break
      case "artists":
        if (
          !this.common.artist ||
          this.commonOrigin.artist === this.originPriority.artificial
        ) {
          if (
            !this.common.artists ||
            this.common.artists.indexOf(tag.value) === -1
          ) {
            // Fill artist using artists source
            const artists = (this.common.artists || []).concat([tag.value])
            const value = joinArtists(artists)
            const artistTag = { id: "artist", value }
            this.setGenericTag("artificial", artistTag)
          }
        }
        break
      case "picture":
        return this.postFixPicture(tag.value).then((picture) => {
          if (picture !== null) {
            tag.value = picture
            this.setGenericTag(tagType, tag)
          }
        })
      case "totaltracks":
        this.common.track.of = CommonTagMapper.toIntOrNull(tag.value)
        return
      case "totaldiscs":
        this.common.disk.of = CommonTagMapper.toIntOrNull(tag.value)
        return
      case "movementTotal":
        this.common.movementIndex.of = CommonTagMapper.toIntOrNull(tag.value)
        return
      case "track":
      case "disk":
      case "movementIndex": {
        const of = this.common[tag.id].of // store of value, maybe maybe overwritten
        this.common[tag.id] = CommonTagMapper.normalizeTrack(tag.value)
        this.common[tag.id].of = of != null ? of : this.common[tag.id].of
        return
      }
      case "bpm":
      case "year":
      case "originalyear":
        tag.value = Number.parseInt(tag.value, 10)
        break
      case "date": {
        // ToDo: be more strict on 'YYYY...'
        const year = Number.parseInt(tag.value.substr(0, 4), 10)
        if (!Number.isNaN(year)) {
          this.common.year = year
        }
        break
      }
      case "discogs_label_id":
      case "discogs_release_id":
      case "discogs_master_release_id":
      case "discogs_artist_id":
      case "discogs_votes":
        tag.value =
          typeof tag.value === "string"
            ? Number.parseInt(tag.value, 10)
            : tag.value
        break
      case "replaygain_track_gain":
      case "replaygain_track_peak":
      case "replaygain_album_gain":
      case "replaygain_album_peak":
        tag.value = toRatio(tag.value)
        break
      case "replaygain_track_minmax":
        tag.value = tag.value.split(",").map((v) => Number.parseInt(v, 10))
        break
      case "replaygain_undo": {
        const minMix = tag.value.split(",").map((v) => Number.parseInt(v, 10))
        tag.value = {
          leftChannel: minMix[0],
          rightChannel: minMix[1],
        }
        break
      }
      case "gapless": // iTunes gap-less flag
      case "compilation":
      case "podcast":
      case "showMovement":
        tag.value = tag.value === "1" || tag.value === 1 // boolean
        break
      case "isrc": {
        // Only keep unique values
        const commonTag = this.common[tag.id]
        if (commonTag && commonTag.indexOf(tag.value) !== -1) return
        break
      }
      case "comment":
        if (typeof tag.value === "string") {
          tag.value = { text: tag.value }
        }
        if (tag.value.descriptor === "iTunPGAP") {
          this.setGenericTag(tagType, {
            id: "gapless",
            value: tag.value.text === "1",
          })
        }
        break
      case "lyrics":
        if (typeof tag.value === "string") {
          tag.value = parseLrc(tag.value)
        }
        break
      // nothing to do
    }
    if (tag.value !== null) {
      this.setGenericTag(tagType, tag)
    }
  }
  /**
   * Convert native tags to common tags
   * @returns {IAudioMetadata} Native + common tags
   */
  toCommonMetadata() {
    return {
      format: this.format,
      native: this.native,
      quality: this.quality,
      common: this.common,
    }
  }
  /**
   * Fix some common issues with picture object
   * @param picture Picture
   */
  async postFixPicture(picture) {
    if (picture.data && picture.data.length > 0) {
      if (!picture.format) {
        const fileType = await fileTypeFromBuffer(Uint8Array.from(picture.data)) // ToDO: remove Buffer
        if (fileType) {
          picture.format = fileType.mime
        } else {
          return null
        }
      }
      picture.format = picture.format.toLocaleLowerCase()
      switch (picture.format) {
        case "image/jpg":
          picture.format = "image/jpeg" // ToDo: register warning
      }
      return picture
    }
    this.addWarning("Empty picture tag found")
    return null
  }
  /**
   * Convert native tag to common tags
   */
  async toCommon(tagType, tagId, value) {
    const tag = { id: tagId, value }
    const genericTag = this.tagMapper.mapTag(tagType, tag, this)
    if (genericTag) {
      await this.postMap(tagType, genericTag)
    }
  }
  /**
   * Set generic tag
   */
  setGenericTag(tagType, tag) {
    debug$q(`common.${tag.id} = ${tag.value}`)
    const prio0 = this.commonOrigin[tag.id] || 1000
    const prio1 = this.originPriority[tagType]
    if (isSingleton(tag.id)) {
      if (prio1 <= prio0) {
        this.common[tag.id] = tag.value
        this.commonOrigin[tag.id] = prio1
      } else {
        return debug$q(
          `Ignore native tag (singleton): ${tagType}.${tag.id} = ${tag.value}`,
        )
      }
    } else {
      if (prio1 === prio0) {
        if (
          !isUnique(tag.id) ||
          this.common[tag.id].indexOf(tag.value) === -1
        ) {
          this.common[tag.id].push(tag.value)
        } else {
          debug$q(`Ignore duplicate value: ${tagType}.${tag.id} = ${tag.value}`)
        }
        // no effect? this.commonOrigin[tag.id] = prio1;
      } else if (prio1 < prio0) {
        this.common[tag.id] = [tag.value]
        this.commonOrigin[tag.id] = prio1
      } else {
        return debug$q(
          `Ignore native tag (list): ${tagType}.${tag.id} = ${tag.value}`,
        )
      }
    }
    if (this.opts?.observer) {
      this.opts.observer({
        metadata: this,
        tag: { type: "common", id: tag.id, value: tag.value },
      })
    }
    // ToDo: trigger metadata event
  }
}
function joinArtists(artists) {
  if (artists.length > 2) {
    return `${artists.slice(0, artists.length - 1).join(", ")} & ${artists[artists.length - 1]}`
  }
  return artists.join(" & ")
}

const mpegParserLoader = {
  parserType: "mpeg",
  extensions: [".mp2", ".mp3", ".m2a", ".aac", "aacp"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return MpegParser$1
      })
    ).MpegParser(metadata, tokenizer, options)
  },
}

const apeParserLoader = {
  parserType: "apev2",
  extensions: [".ape"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return APEv2Parser$1
      })
    ).APEv2Parser(metadata, tokenizer, options)
  },
}

const asfParserLoader = {
  parserType: "asf",
  extensions: [".asf"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return AsfParser$1
      })
    ).AsfParser(metadata, tokenizer, options)
  },
}

const dsdiffParserLoader = {
  parserType: "dsdiff",
  extensions: [".dff"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return DsdiffParser$1
      })
    ).DsdiffParser(metadata, tokenizer, options)
  },
}

const aiffParserLoader = {
  parserType: "aiff",
  extensions: [".aif", "aiff", "aifc"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return AiffParser
      })
    ).AIFFParser(metadata, tokenizer, options)
  },
}

const dsfParserLoader = {
  parserType: "dsf",
  extensions: [".dsf"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return DsfParser$1
      })
    ).DsfParser(metadata, tokenizer, options)
  },
}

const flacParserLoader = {
  parserType: "flac",
  extensions: [".flac"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return FlacParser$1
      })
    ).FlacParser(metadata, tokenizer, options)
  },
}

const matroskaParserLoader = {
  parserType: "matroska",
  extensions: [".mka", ".mkv", ".mk3d", ".mks", "webm"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return MatroskaParser$1
      })
    ).MatroskaParser(metadata, tokenizer, options)
  },
}

const mp4ParserLoader = {
  parserType: "mp4",
  extensions: [".mp4", ".m4a", ".m4b", ".m4pa", "m4v", "m4r", "3gp"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return MP4Parser$1
      })
    ).MP4Parser(metadata, tokenizer, options)
  },
}

const musepackParserLoader = {
  parserType: "musepack",
  extensions: [".mpc"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return MusepackParser$1
      })
    ).MusepackParser(metadata, tokenizer, options)
  },
}

const oggParserLoader = {
  parserType: "ogg",
  extensions: [".ogg", ".ogv", ".oga", ".ogm", ".ogx", ".opus", ".spx"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return OggParser$1
      })
    ).OggParser(metadata, tokenizer, options)
  },
}

const wavpackParserLoader = {
  parserType: "wavpack",
  extensions: [".wv", ".wvp"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return WavPackParser$1
      })
    ).WavPackParser(metadata, tokenizer, options)
  },
}

const riffParserLoader = {
  parserType: "riff",
  extensions: [".wav", "wave", ".bwf"],
  async load(metadata, tokenizer, options) {
    return new (
      await Promise.resolve().then(function () {
        return WaveParser$1
      })
    ).WaveParser(metadata, tokenizer, options)
  },
}

const debug$p = initDebug("music-metadata:parser:factory")
function parseHttpContentType(contentType$1) {
  const type = contentType.parse(contentType$1)
  const mime = parse_1(type.type)
  return {
    type: mime.type,
    subtype: mime.subtype,
    suffix: mime.suffix,
    parameters: type.parameters,
  }
}
class ParserFactory {
  constructor() {
    this.parsers = []
    ;[
      flacParserLoader,
      mpegParserLoader,
      apeParserLoader,
      mp4ParserLoader,
      matroskaParserLoader,
      riffParserLoader,
      oggParserLoader,
      asfParserLoader,
      aiffParserLoader,
      wavpackParserLoader,
      musepackParserLoader,
      dsfParserLoader,
      dsdiffParserLoader,
    ].forEach((parser) => this.registerParser(parser))
  }
  registerParser(parser) {
    this.parsers.push(parser)
  }
  async parse(tokenizer, parserLoader, opts) {
    if (tokenizer.supportsRandomAccess()) {
      debug$p(
        "tokenizer supports random-access, scanning for appending headers",
      )
      await scanAppendingHeaders(tokenizer, opts)
    } else {
      debug$p(
        "tokenizer does not support random-access, cannot scan for appending headers",
      )
    }
    if (!parserLoader) {
      const buf = new Uint8Array(4100)
      if (tokenizer.fileInfo.mimeType) {
        parserLoader = this.findLoaderForType(
          getParserIdForMimeType(tokenizer.fileInfo.mimeType),
        )
      }
      if (!parserLoader && tokenizer.fileInfo.path) {
        parserLoader = this.findLoaderForExtension(tokenizer.fileInfo.path)
      }
      if (!parserLoader) {
        // Parser could not be determined on MIME-type or extension
        debug$p("Guess parser on content...")
        await tokenizer.peekBuffer(buf, { mayBeLess: true })
        const guessedType = await fileTypeFromBuffer(buf)
        if (!guessedType || !guessedType.mime) {
          throw new CouldNotDetermineFileTypeError(
            "Failed to determine audio format",
          )
        }
        debug$p(
          `Guessed file type is mime=${guessedType.mime}, extension=${guessedType.ext}`,
        )
        parserLoader = this.findLoaderForType(
          getParserIdForMimeType(guessedType.mime),
        )
        if (!parserLoader) {
          throw new UnsupportedFileTypeError(
            `Guessed MIME-type not supported: ${guessedType.mime}`,
          )
        }
      }
    }
    // Parser found, execute parser
    debug$p(`Loading ${parserLoader.parserType} parser...`)
    const metadata = new MetadataCollector(opts)
    const parser = await parserLoader.load(metadata, tokenizer, opts ?? {})
    debug$p(`Parser ${parserLoader.parserType} loaded`)
    await parser.parse()
    return metadata.toCommonMetadata()
  }
  /**
   * @param filePath - Path, filename or extension to audio file
   * @return Parser submodule name
   */
  findLoaderForExtension(filePath) {
    if (!filePath) return
    const extension = getExtension(filePath).toLocaleLowerCase() || filePath
    return this.parsers.find(
      (parser) => parser.extensions.indexOf(extension) !== -1,
    )
  }
  findLoaderForType(moduleName) {
    return moduleName
      ? this.parsers.find((parser) => parser.parserType === moduleName)
      : undefined
  }
}
function getExtension(fname) {
  const i = fname.lastIndexOf(".")
  return i === -1 ? "" : fname.slice(i)
}
/**
 * @param httpContentType - HTTP Content-Type, extension, path or filename
 * @returns Parser submodule name
 */
function getParserIdForMimeType(httpContentType) {
  let mime
  if (!httpContentType) return
  try {
    mime = parseHttpContentType(httpContentType)
  } catch (err) {
    debug$p(`Invalid HTTP Content-Type header value: ${httpContentType}`)
    return
  }
  const subType =
    mime.subtype.indexOf("x-") === 0 ? mime.subtype.substring(2) : mime.subtype
  switch (mime.type) {
    case "audio":
      switch (subType) {
        case "mp3": // Incorrect MIME-type, Chrome, in Web API File object
        case "mpeg":
          return "mpeg"
        case "aac":
        case "aacp":
          return "mpeg" // adts
        case "flac":
          return "flac"
        case "ape":
        case "monkeys-audio":
          return "apev2"
        case "mp4":
        case "m4a":
          return "mp4"
        case "ogg": // RFC 7845
        case "opus": // RFC 6716
        case "speex": // RFC 5574
          return "ogg"
        case "ms-wma":
        case "ms-wmv":
        case "ms-asf":
          return "asf"
        case "aiff":
        case "aif":
        case "aifc":
          return "aiff"
        case "vnd.wave":
        case "wav":
        case "wave":
          return "riff"
        case "wavpack":
          return "wavpack"
        case "musepack":
          return "musepack"
        case "matroska":
        case "webm":
          return "matroska"
        case "dsf":
          return "dsf"
        case "amr":
          return "amr"
      }
      break
    case "video":
      switch (subType) {
        case "ms-asf":
        case "ms-wmv":
          return "asf"
        case "m4v":
        case "mp4":
          return "mp4"
        case "ogg":
          return "ogg"
        case "matroska":
        case "webm":
          return "matroska"
      }
      break
    case "application":
      switch (subType) {
        case "vnd.ms-asf":
          return "asf"
        case "ogg":
          return "ogg"
      }
      break
  }
}

class BasicParser {
  /**
   * Initialize parser with output (metadata), input (tokenizer) & parsing options (options).
   * @param {INativeMetadataCollector} metadata Output
   * @param {ITokenizer} tokenizer Input
   * @param {IOptions} options Parsing options
   */
  constructor(metadata, tokenizer, options) {
    this.metadata = metadata
    this.tokenizer = tokenizer
    this.options = options
  }
}

const validFourCC = /^[\x21-\x7e©][\x20-\x7e\x00()]{3}/
/**
 * Token for read FourCC
 * Ref: https://en.wikipedia.org/wiki/FourCC
 */
const FourCcToken = {
  len: 4,
  get: (buf, off) => {
    const id = uint8ArrayToString(
      buf.slice(off, off + FourCcToken.len),
      "latin1",
    )
    if (!id.match(validFourCC)) {
      throw new FieldDecodingError(
        `FourCC contains invalid characters: ${a2hex(id)} "${id}"`,
      )
    }
    return id
  },
  put: (buffer, offset, id) => {
    const str = stringToUint8Array(id)
    if (str.length !== 4) throw new InternalParserError("Invalid length")
    buffer.set(str, offset)
    return offset + 4
  },
}

var DataType$2
;(function (DataType) {
  DataType[(DataType["text_utf8"] = 0)] = "text_utf8"
  DataType[(DataType["binary"] = 1)] = "binary"
  DataType[(DataType["external_info"] = 2)] = "external_info"
  DataType[(DataType["reserved"] = 3)] = "reserved"
})(DataType$2 || (DataType$2 = {}))
/**
 * APE_DESCRIPTOR: defines the sizes (and offsets) of all the pieces, as well as the MD5 checksum
 */
const DescriptorParser = {
  len: 52,
  get: (buf, off) => {
    return {
      // should equal 'MAC '
      ID: FourCcToken.get(buf, off),
      // versionIndex number * 1000 (3.81 = 3810) (remember that 4-byte alignment causes this to take 4-bytes)
      version: UINT32_LE.get(buf, off + 4) / 1000,
      // the number of descriptor bytes (allows later expansion of this header)
      descriptorBytes: UINT32_LE.get(buf, off + 8),
      // the number of header APE_HEADER bytes
      headerBytes: UINT32_LE.get(buf, off + 12),
      // the number of header APE_HEADER bytes
      seekTableBytes: UINT32_LE.get(buf, off + 16),
      // the number of header data bytes (from original file)
      headerDataBytes: UINT32_LE.get(buf, off + 20),
      // the number of bytes of APE frame data
      apeFrameDataBytes: UINT32_LE.get(buf, off + 24),
      // the high order number of APE frame data bytes
      apeFrameDataBytesHigh: UINT32_LE.get(buf, off + 28),
      // the terminating data of the file (not including tag data)
      terminatingDataBytes: UINT32_LE.get(buf, off + 32),
      // the MD5 hash of the file (see notes for usage... it's a little tricky)
      fileMD5: new Uint8ArrayType(16).get(buf, off + 36),
    }
  },
}
/**
 * APE_HEADER: describes all of the necessary information about the APE file
 */
const Header$5 = {
  len: 24,
  get: (buf, off) => {
    return {
      // the compression level (see defines I.E. COMPRESSION_LEVEL_FAST)
      compressionLevel: UINT16_LE.get(buf, off),
      // any format flags (for future use)
      formatFlags: UINT16_LE.get(buf, off + 2),
      // the number of audio blocks in one frame
      blocksPerFrame: UINT32_LE.get(buf, off + 4),
      // the number of audio blocks in the final frame
      finalFrameBlocks: UINT32_LE.get(buf, off + 8),
      // the total number of frames
      totalFrames: UINT32_LE.get(buf, off + 12),
      // the bits per sample (typically 16)
      bitsPerSample: UINT16_LE.get(buf, off + 16),
      // the number of channels (1 or 2)
      channel: UINT16_LE.get(buf, off + 18),
      // the sample rate (typically 44100)
      sampleRate: UINT32_LE.get(buf, off + 20),
    }
  },
}
/**
 * APE Tag Header/Footer Version 2.0
 * TAG: describes all the properties of the file [optional]
 */
const TagFooter = {
  len: 32,
  get: (buf, off) => {
    return {
      // should equal 'APETAGEX'
      ID: new StringType(8, "ascii").get(buf, off),
      // equals CURRENT_APE_TAG_VERSION
      version: UINT32_LE.get(buf, off + 8),
      // the complete size of the tag, including this footer (excludes header)
      size: UINT32_LE.get(buf, off + 12),
      // the number of fields in the tag
      fields: UINT32_LE.get(buf, off + 16),
      // reserved for later use (must be zero),
      flags: parseTagFlags(UINT32_LE.get(buf, off + 20)),
    }
  },
}
/**
 * APE Tag v2.0 Item Header
 */
const TagItemHeader = {
  len: 8,
  get: (buf, off) => {
    return {
      // Length of assigned value in bytes
      size: UINT32_LE.get(buf, off),
      // reserved for later use (must be zero),
      flags: parseTagFlags(UINT32_LE.get(buf, off + 4)),
    }
  },
}
function parseTagFlags(flags) {
  return {
    containsHeader: isBitSet$1(flags, 31),
    containsFooter: isBitSet$1(flags, 30),
    isHeader: isBitSet$1(flags, 29),
    readOnly: isBitSet$1(flags, 0),
    dataType: (flags & 6) >> 1,
  }
}
/**
 * @param num {number}
 * @param bit 0 is least significant bit (LSB)
 * @return {boolean} true if bit is 1; otherwise false
 */
function isBitSet$1(num, bit) {
  return (num & (1 << bit)) !== 0
}

const debug$o = initDebug("music-metadata:parser:APEv2")
const tagFormat$1 = "APEv2"
const preamble = "APETAGEX"
class ApeContentError extends makeUnexpectedFileContentError("APEv2") {}
class APEv2Parser extends BasicParser {
  constructor() {
    super(...arguments)
    this.ape = {}
  }
  static tryParseApeHeader(metadata, tokenizer, options) {
    const apeParser = new APEv2Parser(metadata, tokenizer, options)
    return apeParser.tryParseApeHeader()
  }
  /**
   * Calculate the media file duration
   * @param ah ApeHeader
   * @return {number} duration in seconds
   */
  static calculateDuration(ah) {
    let duration =
      ah.totalFrames > 1 ? ah.blocksPerFrame * (ah.totalFrames - 1) : 0
    duration += ah.finalFrameBlocks
    return duration / ah.sampleRate
  }
  /**
   * Calculates the APEv1 / APEv2 first field offset
   * @param tokenizer
   * @param offset
   */
  static async findApeFooterOffset(tokenizer, offset) {
    // Search for APE footer header at the end of the file
    const apeBuf = new Uint8Array(TagFooter.len)
    const position = tokenizer.position
    await tokenizer.readBuffer(apeBuf, { position: offset - TagFooter.len })
    tokenizer.setPosition(position)
    const tagFooter = TagFooter.get(apeBuf, 0)
    if (tagFooter.ID === "APETAGEX") {
      if (tagFooter.flags.isHeader) {
        debug$o(`APE Header found at offset=${offset - TagFooter.len}`)
      } else {
        debug$o(`APE Footer found at offset=${offset - TagFooter.len}`)
        offset -= tagFooter.size
      }
      return { footer: tagFooter, offset }
    }
  }
  static parseTagFooter(metadata, buffer, options) {
    const footer = TagFooter.get(buffer, buffer.length - TagFooter.len)
    if (footer.ID !== preamble)
      throw new ApeContentError("Unexpected APEv2 Footer ID preamble value")
    fromBuffer$1(buffer)
    const apeParser = new APEv2Parser(metadata, fromBuffer$1(buffer), options)
    return apeParser.parseTags(footer)
  }
  /**
   * Parse APEv1 / APEv2 header if header signature found
   */
  async tryParseApeHeader() {
    if (
      this.tokenizer.fileInfo.size &&
      this.tokenizer.fileInfo.size - this.tokenizer.position < TagFooter.len
    ) {
      debug$o("No APEv2 header found, end-of-file reached")
      return
    }
    const footer = await this.tokenizer.peekToken(TagFooter)
    if (footer.ID === preamble) {
      await this.tokenizer.ignore(TagFooter.len)
      return this.parseTags(footer)
    }
    debug$o(`APEv2 header not found at offset=${this.tokenizer.position}`)
    if (this.tokenizer.fileInfo.size) {
      // Try to read the APEv2 header using just the footer-header
      const remaining = this.tokenizer.fileInfo.size - this.tokenizer.position // ToDo: take ID3v1 into account
      const buffer = new Uint8Array(remaining)
      await this.tokenizer.readBuffer(buffer)
      return APEv2Parser.parseTagFooter(this.metadata, buffer, this.options)
    }
  }
  async parse() {
    const descriptor = await this.tokenizer.readToken(DescriptorParser)
    if (descriptor.ID !== "MAC ")
      throw new ApeContentError("Unexpected descriptor ID")
    this.ape.descriptor = descriptor
    const lenExp = descriptor.descriptorBytes - DescriptorParser.len
    const header = await (lenExp > 0
      ? this.parseDescriptorExpansion(lenExp)
      : this.parseHeader())
    await this.tokenizer.ignore(header.forwardBytes)
    return this.tryParseApeHeader()
  }
  async parseTags(footer) {
    const keyBuffer = new Uint8Array(256) // maximum tag key length
    let bytesRemaining = footer.size - TagFooter.len
    debug$o(
      `Parse APE tags at offset=${this.tokenizer.position}, size=${bytesRemaining}`,
    )
    for (let i = 0; i < footer.fields; i++) {
      if (bytesRemaining < TagItemHeader.len) {
        this.metadata.addWarning(
          `APEv2 Tag-header: ${footer.fields - i} items remaining, but no more tag data to read.`,
        )
        break
      }
      // Only APEv2 tag has tag item headers
      const tagItemHeader = await this.tokenizer.readToken(TagItemHeader)
      bytesRemaining -= TagItemHeader.len + tagItemHeader.size
      await this.tokenizer.peekBuffer(keyBuffer, {
        length: Math.min(keyBuffer.length, bytesRemaining),
      })
      let zero = findZero(keyBuffer, 0, keyBuffer.length)
      const key = await this.tokenizer.readToken(new StringType(zero, "ascii"))
      await this.tokenizer.ignore(1)
      bytesRemaining -= key.length + 1
      switch (tagItemHeader.flags.dataType) {
        case DataType$2.text_utf8: {
          // utf-8 text-string
          const value = await this.tokenizer.readToken(
            new StringType(tagItemHeader.size, "utf8"),
          )
          const values = value.split(/\x00/g)
          await Promise.all(
            values.map((val) => this.metadata.addTag(tagFormat$1, key, val)),
          )
          break
        }
        case DataType$2.binary: // binary (probably artwork)
          if (this.options.skipCovers) {
            await this.tokenizer.ignore(tagItemHeader.size)
          } else {
            const picData = new Uint8Array(tagItemHeader.size)
            await this.tokenizer.readBuffer(picData)
            zero = findZero(picData, 0, picData.length)
            const description = uint8ArrayToString(picData.slice(0, zero))
            const data = picData.slice(zero + 1)
            await this.metadata.addTag(tagFormat$1, key, {
              description,
              data,
            })
          }
          break
        case DataType$2.external_info:
          debug$o(`Ignore external info ${key}`)
          await this.tokenizer.ignore(tagItemHeader.size)
          break
        case DataType$2.reserved:
          debug$o(`Ignore external info ${key}`)
          this.metadata.addWarning(
            `APEv2 header declares a reserved datatype for "${key}"`,
          )
          await this.tokenizer.ignore(tagItemHeader.size)
          break
      }
    }
  }
  async parseDescriptorExpansion(lenExp) {
    await this.tokenizer.ignore(lenExp)
    return this.parseHeader()
  }
  async parseHeader() {
    const header = await this.tokenizer.readToken(Header$5)
    // ToDo before
    this.metadata.setFormat("lossless", true)
    this.metadata.setFormat("container", "Monkey's Audio")
    this.metadata.setFormat("bitsPerSample", header.bitsPerSample)
    this.metadata.setFormat("sampleRate", header.sampleRate)
    this.metadata.setFormat("numberOfChannels", header.channel)
    this.metadata.setFormat("duration", APEv2Parser.calculateDuration(header))
    if (!this.ape.descriptor) {
      throw new ApeContentError("Missing APE descriptor")
    }
    return {
      forwardBytes:
        this.ape.descriptor.seekTableBytes +
        this.ape.descriptor.headerDataBytes +
        this.ape.descriptor.apeFrameDataBytes +
        this.ape.descriptor.terminatingDataBytes,
    }
  }
}

var APEv2Parser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  APEv2Parser: APEv2Parser,
  ApeContentError: ApeContentError,
})

const debug$n = initDebug("music-metadata:parser:ID3v1")
/**
 * ID3v1 Genre mappings
 * Ref: https://de.wikipedia.org/wiki/Liste_der_ID3v1-Genres
 */
const Genres = [
  "Blues",
  "Classic Rock",
  "Country",
  "Dance",
  "Disco",
  "Funk",
  "Grunge",
  "Hip-Hop",
  "Jazz",
  "Metal",
  "New Age",
  "Oldies",
  "Other",
  "Pop",
  "R&B",
  "Rap",
  "Reggae",
  "Rock",
  "Techno",
  "Industrial",
  "Alternative",
  "Ska",
  "Death Metal",
  "Pranks",
  "Soundtrack",
  "Euro-Techno",
  "Ambient",
  "Trip-Hop",
  "Vocal",
  "Jazz+Funk",
  "Fusion",
  "Trance",
  "Classical",
  "Instrumental",
  "Acid",
  "House",
  "Game",
  "Sound Clip",
  "Gospel",
  "Noise",
  "Alt. Rock",
  "Bass",
  "Soul",
  "Punk",
  "Space",
  "Meditative",
  "Instrumental Pop",
  "Instrumental Rock",
  "Ethnic",
  "Gothic",
  "Darkwave",
  "Techno-Industrial",
  "Electronic",
  "Pop-Folk",
  "Eurodance",
  "Dream",
  "Southern Rock",
  "Comedy",
  "Cult",
  "Gangsta Rap",
  "Top 40",
  "Christian Rap",
  "Pop/Funk",
  "Jungle",
  "Native American",
  "Cabaret",
  "New Wave",
  "Psychedelic",
  "Rave",
  "Showtunes",
  "Trailer",
  "Lo-Fi",
  "Tribal",
  "Acid Punk",
  "Acid Jazz",
  "Polka",
  "Retro",
  "Musical",
  "Rock & Roll",
  "Hard Rock",
  "Folk",
  "Folk/Rock",
  "National Folk",
  "Swing",
  "Fast-Fusion",
  "Bebob",
  "Latin",
  "Revival",
  "Celtic",
  "Bluegrass",
  "Avantgarde",
  "Gothic Rock",
  "Progressive Rock",
  "Psychedelic Rock",
  "Symphonic Rock",
  "Slow Rock",
  "Big Band",
  "Chorus",
  "Easy Listening",
  "Acoustic",
  "Humour",
  "Speech",
  "Chanson",
  "Opera",
  "Chamber Music",
  "Sonata",
  "Symphony",
  "Booty Bass",
  "Primus",
  "Porn Groove",
  "Satire",
  "Slow Jam",
  "Club",
  "Tango",
  "Samba",
  "Folklore",
  "Ballad",
  "Power Ballad",
  "Rhythmic Soul",
  "Freestyle",
  "Duet",
  "Punk Rock",
  "Drum Solo",
  "A Cappella",
  "Euro-House",
  "Dance Hall",
  "Goa",
  "Drum & Bass",
  "Club-House",
  "Hardcore",
  "Terror",
  "Indie",
  "BritPop",
  "Negerpunk",
  "Polsk Punk",
  "Beat",
  "Christian Gangsta Rap",
  "Heavy Metal",
  "Black Metal",
  "Crossover",
  "Contemporary Christian",
  "Christian Rock",
  "Merengue",
  "Salsa",
  "Thrash Metal",
  "Anime",
  "JPop",
  "Synthpop",
  "Abstract",
  "Art Rock",
  "Baroque",
  "Bhangra",
  "Big Beat",
  "Breakbeat",
  "Chillout",
  "Downtempo",
  "Dub",
  "EBM",
  "Eclectic",
  "Electro",
  "Electroclash",
  "Emo",
  "Experimental",
  "Garage",
  "Global",
  "IDM",
  "Illbient",
  "Industro-Goth",
  "Jam Band",
  "Krautrock",
  "Leftfield",
  "Lounge",
  "Math Rock",
  "New Romantic",
  "Nu-Breakz",
  "Post-Punk",
  "Post-Rock",
  "Psytrance",
  "Shoegaze",
  "Space Rock",
  "Trop Rock",
  "World Music",
  "Neoclassical",
  "Audiobook",
  "Audio Theatre",
  "Neue Deutsche Welle",
  "Podcast",
  "Indie Rock",
  "G-Funk",
  "Dubstep",
  "Garage Rock",
  "Psybient",
]
/**
 * Spec: http://id3.org/ID3v1
 * Wiki: https://en.wikipedia.org/wiki/ID3
 */
const Iid3v1Token = {
  len: 128,
  /**
   * @param buf Buffer possibly holding the 128 bytes ID3v1.1 metadata header
   * @param off Offset in buffer in bytes
   * @returns ID3v1.1 header if first 3 bytes equals 'TAG', otherwise null is returned
   */
  get: (buf, off) => {
    const header = new Id3v1StringType(3).get(buf, off)
    return header === "TAG"
      ? {
          header,
          title: new Id3v1StringType(30).get(buf, off + 3),
          artist: new Id3v1StringType(30).get(buf, off + 33),
          album: new Id3v1StringType(30).get(buf, off + 63),
          year: new Id3v1StringType(4).get(buf, off + 93),
          comment: new Id3v1StringType(28).get(buf, off + 97),
          // ID3v1.1 separator for track
          zeroByte: UINT8.get(buf, off + 127),
          // track: ID3v1.1 field added by Michael Mutschler
          track: UINT8.get(buf, off + 126),
          genre: UINT8.get(buf, off + 127),
        }
      : null
  },
}
class Id3v1StringType {
  constructor(len) {
    this.len = len
    this.stringType = new StringType(len, "latin1")
  }
  get(buf, off) {
    let value = this.stringType.get(buf, off)
    value = trimRightNull(value)
    value = value.trim()
    return value.length > 0 ? value : undefined
  }
}
class ID3v1Parser extends BasicParser {
  constructor(metadata, tokenizer, options) {
    super(metadata, tokenizer, options)
    this.apeHeader = options.apeHeader
  }
  static getGenre(genreIndex) {
    if (genreIndex < Genres.length) {
      return Genres[genreIndex]
    }
    return undefined // ToDO: generate warning
  }
  async parse() {
    if (!this.tokenizer.fileInfo.size) {
      debug$n("Skip checking for ID3v1 because the file-size is unknown")
      return
    }
    if (this.apeHeader) {
      this.tokenizer.ignore(this.apeHeader.offset - this.tokenizer.position)
      const apeParser = new APEv2Parser(
        this.metadata,
        this.tokenizer,
        this.options,
      )
      await apeParser.parseTags(this.apeHeader.footer)
    }
    const offset = this.tokenizer.fileInfo.size - Iid3v1Token.len
    if (this.tokenizer.position > offset) {
      debug$n("Already consumed the last 128 bytes")
      return
    }
    const header = await this.tokenizer.readToken(Iid3v1Token, offset)
    if (header) {
      debug$n(
        "ID3v1 header found at: pos=%s",
        this.tokenizer.fileInfo.size - Iid3v1Token.len,
      )
      const props = ["title", "artist", "album", "comment", "track", "year"]
      for (const id of props) {
        if (header[id] && header[id] !== "") await this.addTag(id, header[id])
      }
      const genre = ID3v1Parser.getGenre(header.genre)
      if (genre) await this.addTag("genre", genre)
    } else {
      debug$n(
        "ID3v1 header not found at: pos=%s",
        this.tokenizer.fileInfo.size - Iid3v1Token.len,
      )
    }
  }
  async addTag(id, value) {
    await this.metadata.addTag("ID3v1", id, value)
  }
}
async function hasID3v1Header(tokenizer) {
  if (tokenizer.fileInfo.size >= 128) {
    const tag = new Uint8Array(3)
    const position = tokenizer.position
    await tokenizer.readBuffer(tag, { position: tokenizer.fileInfo.size - 128 })
    tokenizer.setPosition(position) // Restore tokenizer position
    return new TextDecoder("latin1").decode(tag) === "TAG"
  }
  return false
}

const endTag2 = "LYRICS200"
async function getLyricsHeaderLength(tokenizer) {
  const fileSize = tokenizer.fileInfo.size
  if (fileSize >= 143) {
    const buf = new Uint8Array(15)
    const position = tokenizer.position
    await tokenizer.readBuffer(buf, { position: fileSize - 143 })
    tokenizer.setPosition(position) // Restore position
    const txt = new TextDecoder("latin1").decode(buf)
    const tag = txt.slice(6)
    if (tag === endTag2) {
      return Number.parseInt(txt.slice(0, 6), 10) + 15
    }
  }
  return 0
}

/**
 * Primary entry point, Node.js specific entry point is MusepackParser.ts
 */
/**
 * Parse Web API File
 * Requires Blob to be able to stream using a ReadableStreamBYOBReader, only available since Node.js ≥ 20
 * @param blob - Blob to parse
 * @param options - Parsing options
 * @returns Metadata
 */
async function parseBlob(blob, options = {}) {
  const fileInfo = { mimeType: blob.type, size: blob.size }
  if (blob instanceof File) {
    fileInfo.path = blob.name
  }
  return parseWebStream(blob.stream(), fileInfo, options)
}
/**
 * Parse audio from Web Stream.Readable
 * @param webStream - WebStream to read the audio track from
 * @param options - Parsing options
 * @param fileInfo - File information object or MIME-type string
 * @returns Metadata
 */
async function parseWebStream(webStream, fileInfo, options = {}) {
  const tokenizer = fromWebStream$1(webStream, {
    fileInfo: typeof fileInfo === "string" ? { mimeType: fileInfo } : fileInfo,
  })
  try {
    return await parseFromTokenizer(tokenizer, options)
  } finally {
    await tokenizer.close()
  }
}
/**
 * Parse audio from memory
 * @param uint8Array - Uint8Array holding audio data
 * @param fileInfo - File information object or MIME-type string
 * @param options - Parsing options
 * @returns Metadata
 * Ref: https://github.com/Borewit/strtok3/blob/e6938c81ff685074d5eb3064a11c0b03ca934c1d/src/index.ts#L15
 */
async function parseBuffer(uint8Array, fileInfo, options = {}) {
  const tokenizer = fromBuffer$1(uint8Array, {
    fileInfo: typeof fileInfo === "string" ? { mimeType: fileInfo } : fileInfo,
  })
  return parseFromTokenizer(tokenizer, options)
}
/**
 * Parse audio from ITokenizer source
 * @param tokenizer - Audio source implementing the tokenizer interface
 * @param options - Parsing options
 * @returns Metadata
 */
function parseFromTokenizer(tokenizer, options) {
  const parserFactory = new ParserFactory()
  return parserFactory.parse(tokenizer, undefined, options)
}
/**
 * Create a dictionary ordered by their tag id (key)
 * @param nativeTags list of tags
 * @returns tags indexed by id
 */
function orderTags(nativeTags) {
  const tags = {}
  for (const { id, value } of nativeTags) {
    if (!tags[id]) {
      tags[id] = []
    }
    tags[id].push(value)
  }
  return tags
}
/**
 * Convert rating to 1-5 star rating
 * @param rating Normalized rating [0..1] (common.rating[n].rating)
 * @returns Number of stars: 1, 2, 3, 4 or 5 stars
 */
function ratingToStars(rating) {
  return rating === undefined ? 0 : 1 + Math.round(rating * 4)
}
/**
 * Select most likely cover image.
 * @param pictures Usually metadata.common.picture
 * @return Cover image, if any, otherwise null
 */
function selectCover(pictures) {
  return pictures
    ? pictures.reduce((acc, cur) => {
        if (
          cur.name &&
          cur.name.toLowerCase() in ["front", "cover", "cover (front)"]
        )
          return cur
        return acc
      })
    : null
}
async function scanAppendingHeaders(tokenizer, options = {}) {
  let apeOffset = tokenizer.fileInfo.size
  if (await hasID3v1Header(tokenizer)) {
    apeOffset -= 128
    const lyricsLen = await getLyricsHeaderLength(tokenizer)
    apeOffset -= lyricsLen
  }
  options.apeHeader = await APEv2Parser.findApeFooterOffset(
    tokenizer,
    apeOffset,
  )
}

const debug$m = initDebug("music-metadata:id3v2:frame-parser")
const defaultEnc = "latin1" // latin1 == iso-8859-1;
function parseGenre(origVal) {
  // match everything inside parentheses
  const genres = []
  let code
  let word = ""
  for (const c of origVal) {
    if (typeof code === "string") {
      if (c === "(" && code === "") {
        word += "("
        code = undefined
      } else if (c === ")") {
        if (word !== "") {
          genres.push(word)
          word = ""
        }
        const genre = parseGenreCode(code)
        if (genre) {
          genres.push(genre)
        }
        code = undefined
      } else code += c
    } else if (c === "(") {
      code = ""
    } else {
      word += c
    }
  }
  if (word) {
    if (genres.length === 0 && word.match(/^\d*$/)) {
      word = parseGenreCode(word)
    }
    if (word) {
      genres.push(word)
    }
  }
  return genres
}
function parseGenreCode(code) {
  if (code === "RX") return "Remix"
  if (code === "CR") return "Cover"
  if (code.match(/^\d*$/)) {
    return Genres[Number.parseInt(code)]
  }
}
class FrameParser {
  /**
   * Create id3v2 frame parser
   * @param major - Major version, e.g. (4) for  id3v2.4
   * @param warningCollector - Used to collect decode issue
   */
  constructor(major, warningCollector) {
    this.major = major
    this.warningCollector = warningCollector
  }
  readData(uint8Array, type, includeCovers) {
    if (uint8Array.length === 0) {
      this.warningCollector.addWarning(
        `id3v2.${this.major} header has empty tag type=${type}`,
      )
      return
    }
    const { encoding, bom } = TextEncodingToken.get(uint8Array, 0)
    const length = uint8Array.length
    let offset = 0
    let output = [] // ToDo
    const nullTerminatorLength = FrameParser.getNullTerminatorLength(encoding)
    let fzero
    debug$m(`Parsing tag type=${type}, encoding=${encoding}, bom=${bom}`)
    switch (type !== "TXXX" && type[0] === "T" ? "T*" : type) {
      case "T*": // 4.2.1. Text information frames - details
      case "GRP1": // iTunes-specific ID3v2 grouping field
      case "IPLS": // v2.3: Involved people list
      case "MVIN":
      case "MVNM":
      case "PCS":
      case "PCST": {
        let text
        try {
          text = decodeString(uint8Array.slice(1), encoding).replace(
            /\x00+$/,
            "",
          )
        } catch (error) {
          if (error instanceof Error) {
            this.warningCollector.addWarning(
              `id3v2.${this.major} type=${type} header has invalid string value: ${error.message}`,
            )
            break
          }
          throw error
        }
        switch (type) {
          case "TMCL": // Musician credits list
          case "TIPL": // Involved people list
          case "IPLS": // Involved people list
            output = FrameParser.functionList(this.splitValue(type, text))
            break
          case "TRK":
          case "TRCK":
          case "TPOS":
            output = text
            break
          case "TCOM":
          case "TEXT":
          case "TOLY":
          case "TOPE":
          case "TPE1":
          case "TSRC":
            // id3v2.3 defines that TCOM, TEXT, TOLY, TOPE & TPE1 values are separated by /
            output = this.splitValue(type, text)
            break
          case "TCO":
          case "TCON":
            output = this.splitValue(type, text)
              .map((v) => parseGenre(v))
              .reduce((acc, val) => acc.concat(val), [])
            break
          case "PCS":
          case "PCST":
            // TODO: Why `default` not results `1` but `''`?
            output = this.major >= 4 ? this.splitValue(type, text) : [text]
            output = Array.isArray(output) && output[0] === "" ? 1 : 0
            break
          default:
            output = this.major >= 4 ? this.splitValue(type, text) : [text]
        }
        break
      }
      case "TXXX": {
        const idAndData = FrameParser.readIdentifierAndData(
          uint8Array,
          offset + 1,
          length,
          encoding,
        )
        const textTag = {
          description: idAndData.id,
          text: this.splitValue(
            type,
            decodeString(idAndData.data, encoding).replace(/\x00+$/, ""),
          ),
        }
        output = textTag
        break
      }
      case "PIC":
      case "APIC":
        if (includeCovers) {
          const pic = {}
          offset += 1
          switch (this.major) {
            case 2:
              pic.format = decodeString(
                uint8Array.slice(offset, offset + 3),
                "latin1",
              ) // 'latin1'; // latin1 == iso-8859-1;
              offset += 3
              break
            case 3:
            case 4:
              fzero = findZero(uint8Array, offset, length, defaultEnc)
              pic.format = decodeString(
                uint8Array.slice(offset, fzero),
                defaultEnc,
              )
              offset = fzero + 1
              break
            default:
              throw makeUnexpectedMajorVersionError$1(this.major)
          }
          pic.format = FrameParser.fixPictureMimeType(pic.format)
          pic.type = AttachedPictureType[uint8Array[offset]]
          offset += 1
          fzero = findZero(uint8Array, offset, length, encoding)
          pic.description = decodeString(
            uint8Array.slice(offset, fzero),
            encoding,
          )
          offset = fzero + nullTerminatorLength
          pic.data = uint8Array.slice(offset, length)
          output = pic
        }
        break
      case "CNT":
      case "PCNT":
        output = UINT32_BE.get(uint8Array, 0)
        break
      case "SYLT": {
        const syltHeader = SyncTextHeader.get(uint8Array, 0)
        offset += SyncTextHeader.len
        const result = {
          descriptor: "",
          language: syltHeader.language,
          contentType: syltHeader.contentType,
          timeStampFormat: syltHeader.timeStampFormat,
          syncText: [],
        }
        let readSyllables = false
        while (offset < length) {
          const nullStr = FrameParser.readNullTerminatedString(
            uint8Array.subarray(offset),
            syltHeader.encoding,
          )
          offset += nullStr.len
          if (readSyllables) {
            const timestamp = UINT32_BE.get(uint8Array, offset)
            offset += UINT32_BE.len
            result.syncText.push({
              text: nullStr.text,
              timestamp,
            })
          } else {
            result.descriptor = nullStr.text
            readSyllables = true
          }
        }
        output = result
        break
      }
      case "ULT":
      case "USLT":
      case "COM":
      case "COMM": {
        const textHeader = TextHeader.get(uint8Array, offset)
        offset += TextHeader.len
        const descriptorStr = FrameParser.readNullTerminatedString(
          uint8Array.subarray(offset),
          textHeader.encoding,
        )
        offset += descriptorStr.len
        const textStr = FrameParser.readNullTerminatedString(
          uint8Array.subarray(offset),
          textHeader.encoding,
        )
        const comment = {
          language: textHeader.language,
          descriptor: descriptorStr.text,
          text: textStr.text,
        }
        output = comment
        break
      }
      case "UFID": {
        const ufid = FrameParser.readIdentifierAndData(
          uint8Array,
          offset,
          length,
          defaultEnc,
        )
        output = { owner_identifier: ufid.id, identifier: ufid.data }
        break
      }
      case "PRIV": {
        // private frame
        const priv = FrameParser.readIdentifierAndData(
          uint8Array,
          offset,
          length,
          defaultEnc,
        )
        output = { owner_identifier: priv.id, data: priv.data }
        break
      }
      case "POPM": {
        // Popularimeter
        fzero = findZero(uint8Array, offset, length, defaultEnc)
        const email = decodeString(uint8Array.slice(offset, fzero), defaultEnc)
        offset = fzero + 1
        const dataLen = length - offset
        output = {
          email,
          rating: UINT8.get(uint8Array, offset),
          counter:
            dataLen >= 5 ? UINT32_BE.get(uint8Array, offset + 1) : undefined,
        }
        break
      }
      case "GEOB": {
        // General encapsulated object
        fzero = findZero(uint8Array, offset + 1, length, encoding)
        const mimeType = decodeString(
          uint8Array.slice(offset + 1, fzero),
          defaultEnc,
        )
        offset = fzero + 1
        fzero = findZero(uint8Array, offset, length, encoding)
        const filename = decodeString(
          uint8Array.slice(offset, fzero),
          defaultEnc,
        )
        offset = fzero + 1
        fzero = findZero(uint8Array, offset, length, encoding)
        const description = decodeString(
          uint8Array.slice(offset, fzero),
          defaultEnc,
        )
        offset = fzero + 1
        const geob = {
          type: mimeType,
          filename,
          description,
          data: uint8Array.slice(offset, length),
        }
        output = geob
        break
      }
      // W-Frames:
      case "WCOM":
      case "WCOP":
      case "WOAF":
      case "WOAR":
      case "WOAS":
      case "WORS":
      case "WPAY":
      case "WPUB":
        // Decode URL
        fzero = findZero(uint8Array, offset + 1, length, encoding)
        output = decodeString(uint8Array.slice(offset, fzero), defaultEnc)
        break
      case "WXXX": {
        // Decode URL
        fzero = findZero(uint8Array, offset + 1, length, encoding)
        const description = decodeString(
          uint8Array.slice(offset + 1, fzero),
          encoding,
        )
        offset = fzero + (encoding === "utf-16le" ? 2 : 1)
        output = {
          description,
          url: decodeString(uint8Array.slice(offset, length), defaultEnc),
        }
        break
      }
      case "WFD":
      case "WFED":
        output = decodeString(
          uint8Array.slice(
            offset + 1,
            findZero(uint8Array, offset + 1, length, encoding),
          ),
          encoding,
        )
        break
      case "MCDI": {
        // Music CD identifier
        output = uint8Array.slice(0, length)
        break
      }
      default:
        debug$m(`Warning: unsupported id3v2-tag-type: ${type}`)
        break
    }
    return output
  }
  static readNullTerminatedString(uint8Array, encoding) {
    let offset = encoding.bom ? 2 : 0
    const zeroIndex = findZero(
      uint8Array,
      offset,
      uint8Array.length,
      encoding.encoding,
    )
    const txt = uint8Array.slice(offset, zeroIndex)
    if (encoding.encoding === "utf-16le") {
      offset = zeroIndex + 2
    } else {
      offset = zeroIndex + 1
    }
    return {
      text: decodeString(txt, encoding.encoding),
      len: offset,
    }
  }
  static fixPictureMimeType(pictureType) {
    pictureType = pictureType.toLocaleLowerCase()
    switch (pictureType) {
      case "jpg":
        return "image/jpeg"
      case "png":
        return "image/png"
    }
    return pictureType
  }
  /**
   * Converts TMCL (Musician credits list) or TIPL (Involved people list)
   * @param entries
   */
  static functionList(entries) {
    const res = {}
    for (let i = 0; i + 1 < entries.length; i += 2) {
      const names = entries[i + 1].split(",")
      res[entries[i]] = res[entries[i]] ? res[entries[i]].concat(names) : names
    }
    return res
  }
  /**
   * id3v2.4 defines that multiple T* values are separated by 0x00
   * id3v2.3 defines that TCOM, TEXT, TOLY, TOPE & TPE1 values are separated by /
   * @param tag - Tag name
   * @param text - Concatenated tag value
   * @returns Split tag value
   */
  splitValue(tag, text) {
    let values
    if (this.major < 4) {
      values = text.split(/\x00/g)
      if (values.length > 1) {
        this.warningCollector.addWarning(
          `ID3v2.${this.major} ${tag} uses non standard null-separator.`,
        )
      } else {
        values = text.split(/\//g)
      }
    } else {
      values = text.split(/\x00/g)
    }
    return FrameParser.trimArray(values)
  }
  static trimArray(values) {
    return values.map((value) => value.replace(/\x00+$/, "").trim())
  }
  static readIdentifierAndData(uint8Array, offset, length, encoding) {
    const fzero = findZero(uint8Array, offset, length, encoding)
    const id = decodeString(uint8Array.slice(offset, fzero), encoding)
    offset = fzero + FrameParser.getNullTerminatorLength(encoding)
    return { id, data: uint8Array.slice(offset, length) }
  }
  static getNullTerminatorLength(enc) {
    return enc === "utf-16le" ? 2 : 1
  }
}
class Id3v2ContentError extends makeUnexpectedFileContentError("id3v2") {}
function makeUnexpectedMajorVersionError$1(majorVer) {
  throw new Id3v2ContentError(`Unexpected majorVer: ${majorVer}`)
}

const asciiDecoder = new TextDecoder("ascii")
class ID3v2Parser {
  constructor() {
    this.tokenizer = undefined
    this.id3Header = undefined
    this.metadata = undefined
    this.headerType = undefined
    this.options = undefined
  }
  static removeUnsyncBytes(buffer) {
    let readI = 0
    let writeI = 0
    while (readI < buffer.length - 1) {
      if (readI !== writeI) {
        buffer[writeI] = buffer[readI]
      }
      readI += buffer[readI] === 0xff && buffer[readI + 1] === 0 ? 2 : 1
      writeI++
    }
    if (readI < buffer.length) {
      buffer[writeI++] = buffer[readI]
    }
    return buffer.slice(0, writeI)
  }
  static getFrameHeaderLength(majorVer) {
    switch (majorVer) {
      case 2:
        return 6
      case 3:
      case 4:
        return 10
      default:
        throw makeUnexpectedMajorVersionError(majorVer)
    }
  }
  static readFrameFlags(b) {
    return {
      status: {
        tag_alter_preservation: getBit(b, 0, 6),
        file_alter_preservation: getBit(b, 0, 5),
        read_only: getBit(b, 0, 4),
      },
      format: {
        grouping_identity: getBit(b, 1, 7),
        compression: getBit(b, 1, 3),
        encryption: getBit(b, 1, 2),
        unsynchronisation: getBit(b, 1, 1),
        data_length_indicator: getBit(b, 1, 0),
      },
    }
  }
  static readFrameData(
    uint8Array,
    frameHeader,
    majorVer,
    includeCovers,
    warningCollector,
  ) {
    const frameParser = new FrameParser(majorVer, warningCollector)
    switch (majorVer) {
      case 2:
        return frameParser.readData(uint8Array, frameHeader.id, includeCovers)
      case 3:
      case 4:
        if (frameHeader.flags?.format.unsynchronisation) {
          uint8Array = ID3v2Parser.removeUnsyncBytes(uint8Array)
        }
        if (frameHeader.flags?.format.data_length_indicator) {
          uint8Array = uint8Array.slice(4, uint8Array.length)
        }
        return frameParser.readData(uint8Array, frameHeader.id, includeCovers)
      default:
        throw makeUnexpectedMajorVersionError(majorVer)
    }
  }
  /**
   * Create a combined tag key, of tag & description
   * @param tag e.g.: COM
   * @param description e.g. iTunPGAP
   * @returns string e.g. COM:iTunPGAP
   */
  static makeDescriptionTagName(tag, description) {
    return tag + (description ? `:${description}` : "")
  }
  async parse(metadata, tokenizer, options) {
    this.tokenizer = tokenizer
    this.metadata = metadata
    this.options = options
    const id3Header = await this.tokenizer.readToken(ID3v2Header)
    if (id3Header.fileIdentifier !== "ID3") {
      throw new Id3v2ContentError(
        "expected ID3-header file-identifier 'ID3' was not found",
      )
    }
    this.id3Header = id3Header
    this.headerType = `ID3v2.${id3Header.version.major}`
    return id3Header.flags.isExtendedHeader
      ? this.parseExtendedHeader()
      : this.parseId3Data(id3Header.size)
  }
  async parseExtendedHeader() {
    const extendedHeader = await this.tokenizer.readToken(ExtendedHeader)
    const dataRemaining = extendedHeader.size - ExtendedHeader.len
    return dataRemaining > 0
      ? this.parseExtendedHeaderData(dataRemaining, extendedHeader.size)
      : this.parseId3Data(this.id3Header.size - extendedHeader.size)
  }
  async parseExtendedHeaderData(dataRemaining, extendedHeaderSize) {
    await this.tokenizer.ignore(dataRemaining)
    return this.parseId3Data(this.id3Header.size - extendedHeaderSize)
  }
  async parseId3Data(dataLen) {
    const uint8Array = await this.tokenizer.readToken(
      new Uint8ArrayType(dataLen),
    )
    for (const tag of this.parseMetadata(uint8Array)) {
      switch (tag.id) {
        case "TXXX":
          if (tag.value) {
            await this.handleTag(
              tag,
              tag.value.text,
              () => tag.value.description,
            )
          }
          break
        default:
          await (Array.isArray(tag.value)
            ? Promise.all(tag.value.map((value) => this.addTag(tag.id, value)))
            : this.addTag(tag.id, tag.value))
      }
    }
  }
  async handleTag(tag, values, descriptor, resolveValue = (value) => value) {
    await Promise.all(
      values.map((value) =>
        this.addTag(
          ID3v2Parser.makeDescriptionTagName(tag.id, descriptor(value)),
          resolveValue(value),
        ),
      ),
    )
  }
  async addTag(id, value) {
    await this.metadata.addTag(this.headerType, id, value)
  }
  parseMetadata(data) {
    let offset = 0
    const tags = []
    while (true) {
      if (offset === data.length) break
      const frameHeaderLength = ID3v2Parser.getFrameHeaderLength(
        this.id3Header.version.major,
      )
      if (offset + frameHeaderLength > data.length) {
        this.metadata.addWarning("Illegal ID3v2 tag length")
        break
      }
      const frameHeaderBytes = data.slice(offset, offset + frameHeaderLength)
      offset += frameHeaderLength
      const frameHeader = this.readFrameHeader(
        frameHeaderBytes,
        this.id3Header.version.major,
      )
      const frameDataBytes = data.slice(offset, offset + frameHeader.length)
      offset += frameHeader.length
      const values = ID3v2Parser.readFrameData(
        frameDataBytes,
        frameHeader,
        this.id3Header.version.major,
        !this.options.skipCovers,
        this.metadata,
      )
      if (values) {
        tags.push({ id: frameHeader.id, value: values })
      }
    }
    return tags
  }
  readFrameHeader(uint8Array, majorVer) {
    let header
    switch (majorVer) {
      case 2:
        header = {
          id: asciiDecoder.decode(uint8Array.slice(0, 3)),
          length: UINT24_BE.get(uint8Array, 3),
        }
        if (!header.id.match(/[A-Z0-9]{3}/g)) {
          this.metadata.addWarning(
            `Invalid ID3v2.${this.id3Header.version.major} frame-header-ID: ${header.id}`,
          )
        }
        break
      case 3:
      case 4:
        header = {
          id: asciiDecoder.decode(uint8Array.slice(0, 4)),
          length: (majorVer === 4 ? UINT32SYNCSAFE : UINT32_BE).get(
            uint8Array,
            4,
          ),
          flags: ID3v2Parser.readFrameFlags(uint8Array.slice(8, 10)),
        }
        if (!header.id.match(/[A-Z0-9]{4}/g)) {
          this.metadata.addWarning(
            `Invalid ID3v2.${this.id3Header.version.major} frame-header-ID: ${header.id}`,
          )
        }
        break
      default:
        throw makeUnexpectedMajorVersionError(majorVer)
    }
    return header
  }
}
function makeUnexpectedMajorVersionError(majorVer) {
  throw new Id3v2ContentError(`Unexpected majorVer: ${majorVer}`)
}

const debug$l = initDebug("music-metadata:parser:ID3")
/**
 * Abstract parser which tries take ID3v2 and ID3v1 headers.
 */
class AbstractID3Parser extends BasicParser {
  constructor() {
    super(...arguments)
    this.id3parser = new ID3v2Parser()
  }
  static async startsWithID3v2Header(tokenizer) {
    return (await tokenizer.peekToken(ID3v2Header)).fileIdentifier === "ID3"
  }
  async parse() {
    try {
      await this.parseID3v2()
    } catch (err) {
      if (err instanceof EndOfStreamError$1) {
        debug$l("End-of-stream")
      } else {
        throw err
      }
    }
  }
  finalize() {
    return
  }
  async parseID3v2() {
    await this.tryReadId3v2Headers()
    debug$l(
      "End of ID3v2 header, go to MPEG-parser: pos=%s",
      this.tokenizer.position,
    )
    await this.postId3v2Parse()
    if (this.options.skipPostHeaders && this.metadata.hasAny()) {
      this.finalize()
    } else {
      const id3v1parser = new ID3v1Parser(
        this.metadata,
        this.tokenizer,
        this.options,
      )
      await id3v1parser.parse()
      this.finalize()
    }
  }
  async tryReadId3v2Headers() {
    const id3Header = await this.tokenizer.peekToken(ID3v2Header)
    if (id3Header.fileIdentifier === "ID3") {
      debug$l("Found ID3v2 header, pos=%s", this.tokenizer.position)
      await this.id3parser.parse(this.metadata, this.tokenizer, this.options)
      return this.tryReadId3v2Headers()
    }
  }
}

/**
 * https://github.com/Borewit/music-metadata/wiki/Replay-Gain-Data-Format#name-code
 */
var NameCode
;(function (NameCode) {
  /**
   * not set
   */
  NameCode[(NameCode["not_set"] = 0)] = "not_set"
  /**
   * Radio Gain Adjustment
   */
  NameCode[(NameCode["radio"] = 1)] = "radio"
  /**
   * Audiophile Gain Adjustment
   */
  NameCode[(NameCode["audiophile"] = 2)] = "audiophile"
})(NameCode || (NameCode = {}))
/**
 * https://github.com/Borewit/music-metadata/wiki/Replay-Gain-Data-Format#originator-code
 */
var ReplayGainOriginator
;(function (ReplayGainOriginator) {
  /**
   * Replay Gain unspecified
   */
  ReplayGainOriginator[(ReplayGainOriginator["unspecified"] = 0)] =
    "unspecified"
  /**
   * Replay Gain pre-set by artist/producer/mastering engineer
   */
  ReplayGainOriginator[(ReplayGainOriginator["engineer"] = 1)] = "engineer"
  /**
   * Replay Gain set by user
   */
  ReplayGainOriginator[(ReplayGainOriginator["user"] = 2)] = "user"
  /**
   * Replay Gain determined automatically, as described on this site
   */
  ReplayGainOriginator[(ReplayGainOriginator["automatic"] = 3)] = "automatic"
  /**
   * Set by simple RMS average
   */
  ReplayGainOriginator[(ReplayGainOriginator["rms_average"] = 4)] =
    "rms_average"
})(ReplayGainOriginator || (ReplayGainOriginator = {}))
/**
 * Replay Gain Data Format
 *
 * https://github.com/Borewit/music-metadata/wiki/Replay-Gain-Data-Format
 */
const ReplayGain = {
  len: 2,
  get: (buf, off) => {
    const gain_type = getBitAllignedNumber$1(buf, off, 0, 3)
    const sign = getBitAllignedNumber$1(buf, off, 6, 1)
    const gain_adj = getBitAllignedNumber$1(buf, off, 7, 9) / 10.0
    if (gain_type > 0) {
      return {
        type: getBitAllignedNumber$1(buf, off, 0, 3),
        origin: getBitAllignedNumber$1(buf, off, 3, 3),
        adjustment: sign ? -gain_adj : gain_adj,
      }
    }
    return undefined
  },
}

/**
 * Extended Lame Header
 */
/**
 * Info Tag
 * @link http://gabriel.mp3-tech.org/mp3infotag.html
 * @link https://github.com/quodlibet/mutagen/blob/abd58ee58772224334a18817c3fb31103572f70e/mutagen/mp3/_util.py#L112
 */
const ExtendedLameHeader = {
  len: 27,
  get: (buf, off) => {
    const track_peak = UINT32_BE.get(buf, off + 2)
    return {
      revision: getBitAllignedNumber$1(buf, off, 0, 4),
      vbr_method: getBitAllignedNumber$1(buf, off, 4, 4),
      lowpass_filter: 100 * UINT8.get(buf, off + 1),
      track_peak: track_peak === 0 ? null : track_peak / 2 ** 23,
      track_gain: ReplayGain.get(buf, 6),
      album_gain: ReplayGain.get(buf, 8),
      music_length: UINT32_BE.get(buf, off + 20),
      music_crc: UINT8.get(buf, off + 24),
      header_crc: UINT16_BE.get(buf, off + 24),
    }
  },
}

/**
 * Info Tag: Xing, LAME
 */
const InfoTagHeaderTag = new StringType(4, "ascii")
/**
 * LAME TAG value
 * Did not find any official documentation for this
 * Value e.g.: "3.98.4"
 */
const LameEncoderVersion = new StringType(6, "ascii")
/**
 * Info Tag
 * Ref: http://gabriel.mp3-tech.org/mp3infotag.html
 */
const XingHeaderFlags = {
  len: 4,
  get: (buf, off) => {
    return {
      frames: isBitSet$2(buf, off, 31),
      bytes: isBitSet$2(buf, off, 30),
      toc: isBitSet$2(buf, off, 29),
      vbrScale: isBitSet$2(buf, off, 28),
    }
  },
}
// /**
//  * XING Header Tag
//  * Ref: http://gabriel.mp3-tech.org/mp3infotag.html
//  */
async function readXingHeader(tokenizer) {
  const flags = await tokenizer.readToken(XingHeaderFlags)
  const xingInfoTag = { numFrames: null, streamSize: null, vbrScale: null }
  if (flags.frames) {
    xingInfoTag.numFrames = await tokenizer.readToken(UINT32_BE)
  }
  if (flags.bytes) {
    xingInfoTag.streamSize = await tokenizer.readToken(UINT32_BE)
  }
  if (flags.toc) {
    xingInfoTag.toc = new Uint8Array(100)
    await tokenizer.readBuffer(xingInfoTag.toc)
  }
  if (flags.vbrScale) {
    xingInfoTag.vbrScale = await tokenizer.readToken(UINT32_BE)
  }
  const lameTag = await tokenizer.peekToken(new StringType(4, "ascii"))
  if (lameTag === "LAME") {
    await tokenizer.ignore(4)
    xingInfoTag.lame = {
      version: await tokenizer.readToken(new StringType(5, "ascii")),
    }
    const match = xingInfoTag.lame.version.match(/\d+.\d+/g)
    if (match !== null) {
      const majorMinorVersion = match[0] // e.g. 3.97
      const version = majorMinorVersion
        .split(".")
        .map((n) => Number.parseInt(n, 10))
      if (version[0] >= 3 && version[1] >= 90) {
        xingInfoTag.lame.extended =
          await tokenizer.readToken(ExtendedLameHeader)
      }
    }
  }
  return xingInfoTag
}

const debug$k = initDebug("music-metadata:parser:mpeg")
class MpegContentError extends makeUnexpectedFileContentError("MPEG") {}
/**
 * Cache buffer size used for searching synchronization preabmle
 */
const maxPeekLen = 1024
/**
 * MPEG-4 Audio definitions
 * Ref:  https://wiki.multimedia.cx/index.php/MPEG-4_Audio
 */
const MPEG4 = {
  /**
   * Audio Object Types
   */
  AudioObjectTypes: [
    "AAC Main",
    "AAC LC", // Low Complexity
    "AAC SSR", // Scalable Sample Rate
    "AAC LTP", // Long Term Prediction
  ],
  /**
   * Sampling Frequencies
   * https://wiki.multimedia.cx/index.php/MPEG-4_Audio#Sampling_Frequencies
   */
  SamplingFrequencies: [
    96000,
    88200,
    64000,
    48000,
    44100,
    32000,
    24000,
    22050,
    16000,
    12000,
    11025,
    8000,
    7350,
    null,
    null,
    -1,
  ],
  /**
   * Channel Configurations
   */
}
const MPEG4_ChannelConfigurations = [
  undefined,
  ["front-center"],
  ["front-left", "front-right"],
  ["front-center", "front-left", "front-right"],
  ["front-center", "front-left", "front-right", "back-center"],
  ["front-center", "front-left", "front-right", "back-left", "back-right"],
  [
    "front-center",
    "front-left",
    "front-right",
    "back-left",
    "back-right",
    "LFE-channel",
  ],
  [
    "front-center",
    "front-left",
    "front-right",
    "side-left",
    "side-right",
    "back-left",
    "back-right",
    "LFE-channel",
  ],
]
/**
 * MPEG Audio Layer I/II/III frame header
 * Ref: https://www.mp3-tech.org/programmer/frame_header.html
 * Bit layout: AAAAAAAA AAABBCCD EEEEFFGH IIJJKLMM
 * Ref: https://wiki.multimedia.cx/index.php/ADTS
 */
class MpegFrameHeader {
  constructor(buf, off) {
    // E(15,12): Bitrate index
    this.bitrateIndex = null
    // F(11,10): Sampling rate frequency index
    this.sampRateFreqIndex = null
    // G(9): Padding bit
    this.padding = null
    // H(8): Private bit
    this.privateBit = null
    // I(7,6): Channel Mode
    this.channelModeIndex = null
    // J(5,4): Mode extension (Only used in Joint stereo)
    this.modeExtension = null
    // L(2): Original
    this.isOriginalMedia = null
    this.version = null
    this.bitrate = null
    this.samplingRate = null
    this.frameLength = 0
    // B(20,19): MPEG Audio versionIndex ID
    this.versionIndex = getBitAllignedNumber$1(buf, off + 1, 3, 2)
    // C(18,17): Layer description
    this.layer =
      MpegFrameHeader.LayerDescription[
        getBitAllignedNumber$1(buf, off + 1, 5, 2)
      ]
    if (this.versionIndex > 1 && this.layer === 0) {
      this.parseAdtsHeader(buf, off) // Audio Data Transport Stream (ADTS)
    } else {
      this.parseMpegHeader(buf, off) // Conventional MPEG header
    }
    // D(16): Protection bit (if true 16-bit CRC follows header)
    this.isProtectedByCRC = !isBitSet$2(buf, off + 1, 7)
  }
  calcDuration(numFrames) {
    return this.samplingRate == null
      ? null
      : (numFrames * this.calcSamplesPerFrame()) / this.samplingRate
  }
  calcSamplesPerFrame() {
    return MpegFrameHeader.samplesInFrameTable[this.version === 1 ? 0 : 1][
      this.layer
    ]
  }
  calculateSideInfoLength() {
    if (this.layer !== 3) return 2
    if (this.channelModeIndex === 3) {
      // mono
      if (this.version === 1) {
        return 17
      }
      if (this.version === 2 || this.version === 2.5) {
        return 9
      }
    } else {
      if (this.version === 1) {
        return 32
      }
      if (this.version === 2 || this.version === 2.5) {
        return 17
      }
    }
    return null
  }
  calcSlotSize() {
    return [null, 4, 1, 1][this.layer]
  }
  parseMpegHeader(buf, off) {
    this.container = "MPEG"
    // E(15,12): Bitrate index
    this.bitrateIndex = getBitAllignedNumber$1(buf, off + 2, 0, 4)
    // F(11,10): Sampling rate frequency index
    this.sampRateFreqIndex = getBitAllignedNumber$1(buf, off + 2, 4, 2)
    // G(9): Padding bit
    this.padding = isBitSet$2(buf, off + 2, 6)
    // H(8): Private bit
    this.privateBit = isBitSet$2(buf, off + 2, 7)
    // I(7,6): Channel Mode
    this.channelModeIndex = getBitAllignedNumber$1(buf, off + 3, 0, 2)
    // J(5,4): Mode extension (Only used in Joint stereo)
    this.modeExtension = getBitAllignedNumber$1(buf, off + 3, 2, 2)
    // K(3): Copyright
    this.isCopyrighted = isBitSet$2(buf, off + 3, 4)
    // L(2): Original
    this.isOriginalMedia = isBitSet$2(buf, off + 3, 5)
    // M(3): The original bit indicates, if it is set, that the frame is located on its original media.
    this.emphasis = getBitAllignedNumber$1(buf, off + 3, 7, 2)
    this.version = MpegFrameHeader.VersionID[this.versionIndex]
    this.channelMode = MpegFrameHeader.ChannelMode[this.channelModeIndex]
    this.codec = `MPEG ${this.version} Layer ${this.layer}`
    // Calculate bitrate
    const bitrateInKbps = this.calcBitrate()
    if (!bitrateInKbps) {
      throw new MpegContentError("Cannot determine bit-rate")
    }
    this.bitrate = bitrateInKbps * 1000
    // Calculate sampling rate
    this.samplingRate = this.calcSamplingRate()
    if (this.samplingRate == null) {
      throw new MpegContentError("Cannot determine sampling-rate")
    }
  }
  parseAdtsHeader(buf, off) {
    debug$k("layer=0 => ADTS")
    this.version = this.versionIndex === 2 ? 4 : 2
    this.container = `ADTS/MPEG-${this.version}`
    const profileIndex = getBitAllignedNumber$1(buf, off + 2, 0, 2)
    this.codec = "AAC"
    this.codecProfile = MPEG4.AudioObjectTypes[profileIndex]
    debug$k(`MPEG-4 audio-codec=${this.codec}`)
    const samplingFrequencyIndex = getBitAllignedNumber$1(buf, off + 2, 2, 4)
    this.samplingRate = MPEG4.SamplingFrequencies[samplingFrequencyIndex]
    debug$k(`sampling-rate=${this.samplingRate}`)
    const channelIndex = getBitAllignedNumber$1(buf, off + 2, 7, 3)
    this.mp4ChannelConfig = MPEG4_ChannelConfigurations[channelIndex]
    debug$k(
      `channel-config=${this.mp4ChannelConfig ? this.mp4ChannelConfig.join("+") : "?"}`,
    )
    this.frameLength = getBitAllignedNumber$1(buf, off + 3, 6, 2) << 11
  }
  calcBitrate() {
    if (
      this.bitrateIndex === 0x00 || // free
      this.bitrateIndex === 0x0f
    ) {
      // reserved
      return null
    }
    if (this.version && this.bitrateIndex) {
      const codecIndex = 10 * Math.floor(this.version) + this.layer
      return MpegFrameHeader.bitrate_index[this.bitrateIndex][codecIndex]
    }
    return null
  }
  calcSamplingRate() {
    if (
      this.sampRateFreqIndex === 0x03 ||
      this.version === null ||
      this.sampRateFreqIndex == null
    )
      return null // 'reserved'
    return MpegFrameHeader.sampling_rate_freq_index[this.version][
      this.sampRateFreqIndex
    ]
  }
}
MpegFrameHeader.SyncByte1 = 0xff
MpegFrameHeader.SyncByte2 = 0xe0
MpegFrameHeader.VersionID = [2.5, null, 2, 1]
MpegFrameHeader.LayerDescription = [0, 3, 2, 1]
MpegFrameHeader.ChannelMode = ["stereo", "joint_stereo", "dual_channel", "mono"]
MpegFrameHeader.bitrate_index = {
  1: { 11: 32, 12: 32, 13: 32, 21: 32, 22: 8, 23: 8 },
  2: { 11: 64, 12: 48, 13: 40, 21: 48, 22: 16, 23: 16 },
  3: { 11: 96, 12: 56, 13: 48, 21: 56, 22: 24, 23: 24 },
  4: { 11: 128, 12: 64, 13: 56, 21: 64, 22: 32, 23: 32 },
  5: { 11: 160, 12: 80, 13: 64, 21: 80, 22: 40, 23: 40 },
  6: { 11: 192, 12: 96, 13: 80, 21: 96, 22: 48, 23: 48 },
  7: { 11: 224, 12: 112, 13: 96, 21: 112, 22: 56, 23: 56 },
  8: { 11: 256, 12: 128, 13: 112, 21: 128, 22: 64, 23: 64 },
  9: { 11: 288, 12: 160, 13: 128, 21: 144, 22: 80, 23: 80 },
  10: { 11: 320, 12: 192, 13: 160, 21: 160, 22: 96, 23: 96 },
  11: { 11: 352, 12: 224, 13: 192, 21: 176, 22: 112, 23: 112 },
  12: { 11: 384, 12: 256, 13: 224, 21: 192, 22: 128, 23: 128 },
  13: { 11: 416, 12: 320, 13: 256, 21: 224, 22: 144, 23: 144 },
  14: { 11: 448, 12: 384, 13: 320, 21: 256, 22: 160, 23: 160 },
}
MpegFrameHeader.sampling_rate_freq_index = {
  1: { 0: 44100, 1: 48000, 2: 32000 },
  2: { 0: 22050, 1: 24000, 2: 16000 },
  2.5: { 0: 11025, 1: 12000, 2: 8000 },
}
MpegFrameHeader.samplesInFrameTable = [
  /* Layer   I    II   III */
  [0, 384, 1152, 1152], // MPEG-1
  [0, 384, 1152, 576], // MPEG-2(.5
]
/**
 * MPEG Audio Layer I/II/III
 */
const FrameHeader = {
  len: 4,
  get: (buf, off) => {
    return new MpegFrameHeader(buf, off)
  },
}
function getVbrCodecProfile(vbrScale) {
  return `V${Math.floor((100 - vbrScale) / 10)}`
}
class MpegParser extends AbstractID3Parser {
  constructor() {
    super(...arguments)
    this.frameCount = 0
    this.syncFrameCount = -1
    this.countSkipFrameData = 0
    this.totalDataLength = 0
    this.bitrates = []
    this.offset = 0
    this.frame_size = 0
    this.crc = null
    this.calculateEofDuration = false
    this.samplesPerFrame = null
    this.buf_frame_header = new Uint8Array(4)
    /**
     * Number of bytes already parsed since beginning of stream / file
     */
    this.mpegOffset = null
    this.syncPeek = {
      buf: new Uint8Array(maxPeekLen),
      len: 0,
    }
  }
  /**
   * Called after ID3 headers have been parsed
   */
  async postId3v2Parse() {
    this.metadata.setFormat("lossless", false)
    try {
      let quit = false
      while (!quit) {
        await this.sync()
        quit = await this.parseCommonMpegHeader()
      }
    } catch (err) {
      if (err instanceof EndOfStreamError$1) {
        debug$k("End-of-stream")
        if (this.calculateEofDuration) {
          if (this.samplesPerFrame !== null) {
            const numberOfSamples = this.frameCount * this.samplesPerFrame
            this.metadata.setFormat("numberOfSamples", numberOfSamples)
            if (this.metadata.format.sampleRate) {
              const duration = numberOfSamples / this.metadata.format.sampleRate
              debug$k(`Calculate duration at EOF: ${duration} sec.`, duration)
              this.metadata.setFormat("duration", duration)
            }
          }
        }
      } else {
        throw err
      }
    }
  }
  /**
   * Called after file has been fully parsed, this allows, if present, to exclude the ID3v1.1 header length
   */
  finalize() {
    const format = this.metadata.format
    const hasID3v1 = !!this.metadata.native.ID3v1
    if (this.mpegOffset !== null) {
      if (format.duration && this.tokenizer.fileInfo.size) {
        const mpegSize =
          this.tokenizer.fileInfo.size - this.mpegOffset - (hasID3v1 ? 128 : 0)
        if (format.codecProfile && format.codecProfile[0] === "V") {
          this.metadata.setFormat("bitrate", (mpegSize * 8) / format.duration)
        }
      }
      if (this.tokenizer.fileInfo.size && format.codecProfile === "CBR") {
        const mpegSize =
          this.tokenizer.fileInfo.size - this.mpegOffset - (hasID3v1 ? 128 : 0)
        if (this.frame_size !== null && this.samplesPerFrame !== null) {
          const numberOfSamples =
            Math.round(mpegSize / this.frame_size) * this.samplesPerFrame
          this.metadata.setFormat("numberOfSamples", numberOfSamples)
          if (format.sampleRate && !format.duration) {
            const duration = numberOfSamples / format.sampleRate
            debug$k("Calculate CBR duration based on file size: %s", duration)
            this.metadata.setFormat("duration", duration)
          }
        }
      }
    }
  }
  async sync() {
    let gotFirstSync = false
    while (true) {
      let bo = 0
      this.syncPeek.len = await this.tokenizer.peekBuffer(this.syncPeek.buf, {
        length: maxPeekLen,
        mayBeLess: true,
      })
      if (this.syncPeek.len <= 163) {
        throw new EndOfStreamError$1()
      }
      while (true) {
        if (gotFirstSync && (this.syncPeek.buf[bo] & 0xe0) === 0xe0) {
          this.buf_frame_header[0] = MpegFrameHeader.SyncByte1
          this.buf_frame_header[1] = this.syncPeek.buf[bo]
          await this.tokenizer.ignore(bo)
          debug$k(
            `Sync at offset=${this.tokenizer.position - 1}, frameCount=${this.frameCount}`,
          )
          if (this.syncFrameCount === this.frameCount) {
            debug$k(`Re-synced MPEG stream, frameCount=${this.frameCount}`)
            this.frameCount = 0
            this.frame_size = 0
          }
          this.syncFrameCount = this.frameCount
          return // sync
        }
        gotFirstSync = false
        bo = this.syncPeek.buf.indexOf(MpegFrameHeader.SyncByte1, bo)
        if (bo === -1) {
          if (this.syncPeek.len < this.syncPeek.buf.length) {
            throw new EndOfStreamError$1()
          }
          await this.tokenizer.ignore(this.syncPeek.len)
          break // continue with next buffer
        }
        ++bo
        gotFirstSync = true
      }
    }
  }
  /**
   * Combined ADTS & MPEG (MP2 & MP3) header handling
   * @return {Promise<boolean>} true if parser should quit
   */
  async parseCommonMpegHeader() {
    if (this.frameCount === 0) {
      this.mpegOffset = this.tokenizer.position - 1
    }
    await this.tokenizer.peekBuffer(this.buf_frame_header.subarray(1), {
      length: 3,
    })
    let header
    try {
      header = FrameHeader.get(this.buf_frame_header, 0)
    } catch (err) {
      await this.tokenizer.ignore(1)
      if (err instanceof Error) {
        this.metadata.addWarning(`Parse error: ${err.message}`)
        return false // sync
      }
      throw err
    }
    await this.tokenizer.ignore(3)
    this.metadata.setFormat("container", header.container)
    this.metadata.setFormat("codec", header.codec)
    this.metadata.setFormat("lossless", false)
    this.metadata.setFormat("sampleRate", header.samplingRate)
    this.frameCount++
    return header.version !== null && header.version >= 2 && header.layer === 0
      ? this.parseAdts(header)
      : this.parseAudioFrameHeader(header)
  }
  /**
   * @return {Promise<boolean>} true if parser should quit
   */
  async parseAudioFrameHeader(header) {
    this.metadata.setFormat(
      "numberOfChannels",
      header.channelMode === "mono" ? 1 : 2,
    )
    this.metadata.setFormat("bitrate", header.bitrate)
    if (this.frameCount < 20 * 10000) {
      debug$k(
        "offset=%s MP%s bitrate=%s sample-rate=%s",
        this.tokenizer.position - 4,
        header.layer,
        header.bitrate,
        header.samplingRate,
      )
    }
    const slot_size = header.calcSlotSize()
    if (slot_size === null) {
      throw new MpegContentError("invalid slot_size")
    }
    const samples_per_frame = header.calcSamplesPerFrame()
    debug$k(`samples_per_frame=${samples_per_frame}`)
    const bps = samples_per_frame / 8.0
    if (header.bitrate !== null && header.samplingRate != null) {
      const fsize =
        (bps * header.bitrate) / header.samplingRate +
        (header.padding ? slot_size : 0)
      this.frame_size = Math.floor(fsize)
    }
    this.audioFrameHeader = header
    if (header.bitrate !== null) {
      this.bitrates.push(header.bitrate)
    }
    // xtra header only exists in first frame
    if (this.frameCount === 1) {
      this.offset = FrameHeader.len
      await this.skipSideInformation()
      return false
    }
    if (this.frameCount === 3) {
      // the stream is CBR if the first 3 frame bitrates are the same
      if (this.areAllSame(this.bitrates)) {
        // Actual calculation will be done in finalize
        this.samplesPerFrame = samples_per_frame
        this.metadata.setFormat("codecProfile", "CBR")
        if (this.tokenizer.fileInfo.size) return true // Will calculate duration based on the file size
      } else if (this.metadata.format.duration) {
        return true // We already got the duration, stop processing MPEG stream any further
      }
      if (!this.options.duration) {
        return true // Enforce duration not enabled, stop processing entire stream
      }
    }
    // once we know the file is VBR attach listener to end of
    // stream so we can do the duration calculation when we
    // have counted all the frames
    if (this.options.duration && this.frameCount === 4) {
      this.samplesPerFrame = samples_per_frame
      this.calculateEofDuration = true
    }
    this.offset = 4
    if (header.isProtectedByCRC) {
      await this.parseCrc()
      return false
    }
    await this.skipSideInformation()
    return false
  }
  async parseAdts(header) {
    const buf = new Uint8Array(3)
    await this.tokenizer.readBuffer(buf)
    header.frameLength += getBitAllignedNumber$1(buf, 0, 0, 11)
    this.totalDataLength += header.frameLength
    this.samplesPerFrame = 1024
    if (header.samplingRate !== null) {
      const framesPerSec = header.samplingRate / this.samplesPerFrame
      const bytesPerFrame =
        this.frameCount === 0 ? 0 : this.totalDataLength / this.frameCount
      const bitrate = 8 * bytesPerFrame * framesPerSec + 0.5
      this.metadata.setFormat("bitrate", bitrate)
      debug$k(
        `frame-count=${this.frameCount}, size=${header.frameLength} bytes, bit-rate=${bitrate}`,
      )
    }
    await this.tokenizer.ignore(
      header.frameLength > 7 ? header.frameLength - 7 : 1,
    )
    // Consume remaining header and frame data
    if (this.frameCount === 3) {
      this.metadata.setFormat("codecProfile", header.codecProfile)
      if (header.mp4ChannelConfig) {
        this.metadata.setFormat(
          "numberOfChannels",
          header.mp4ChannelConfig.length,
        )
      }
      if (this.options.duration) {
        this.calculateEofDuration = true
      } else {
        return true // Stop parsing after the third frame
      }
    }
    return false
  }
  async parseCrc() {
    this.crc = await this.tokenizer.readNumber(INT16_BE)
    this.offset += 2
    return this.skipSideInformation()
  }
  async skipSideInformation() {
    if (this.audioFrameHeader) {
      const sideinfo_length = this.audioFrameHeader.calculateSideInfoLength()
      if (sideinfo_length !== null) {
        await this.tokenizer.readToken(new Uint8ArrayType(sideinfo_length))
        // side information
        this.offset += sideinfo_length
        await this.readXtraInfoHeader()
        return
      }
    }
  }
  async readXtraInfoHeader() {
    const headerTag = await this.tokenizer.readToken(InfoTagHeaderTag)
    this.offset += InfoTagHeaderTag.len // 12
    switch (headerTag) {
      case "Info":
        this.metadata.setFormat("codecProfile", "CBR")
        return this.readXingInfoHeader()
      case "Xing": {
        const infoTag = await this.readXingInfoHeader()
        if (infoTag.vbrScale !== null) {
          const codecProfile = getVbrCodecProfile(infoTag.vbrScale)
          this.metadata.setFormat("codecProfile", codecProfile)
        }
        return null
      }
      case "Xtra":
        // ToDo: ???
        break
      case "LAME": {
        const version = await this.tokenizer.readToken(LameEncoderVersion)
        if (
          this.frame_size !== null &&
          this.frame_size >= this.offset + LameEncoderVersion.len
        ) {
          this.offset += LameEncoderVersion.len
          this.metadata.setFormat("tool", `LAME ${version}`)
          await this.skipFrameData(this.frame_size - this.offset)
          return null
        }
        this.metadata.addWarning("Corrupt LAME header")
        break
      }
      // ToDo: ???
    }
    // ToDo: promise duration???
    const frameDataLeft = this.frame_size - this.offset
    if (frameDataLeft < 0) {
      this.metadata.addWarning(
        `Frame ${this.frameCount}corrupt: negative frameDataLeft`,
      )
    } else {
      await this.skipFrameData(frameDataLeft)
    }
    return null
  }
  /**
   * Ref: http://gabriel.mp3-tech.org/mp3infotag.html
   * @returns {Promise<string>}
   */
  async readXingInfoHeader() {
    const offset = this.tokenizer.position
    const infoTag = await readXingHeader(this.tokenizer)
    this.offset += this.tokenizer.position - offset
    if (infoTag.lame) {
      this.metadata.setFormat(
        "tool",
        `LAME ${stripNulls(infoTag.lame.version)}`,
      )
      if (infoTag.lame.extended) {
        // this.metadata.setFormat('trackGain', infoTag.lame.extended.track_gain);
        this.metadata.setFormat(
          "trackPeakLevel",
          infoTag.lame.extended.track_peak,
        )
        if (infoTag.lame.extended.track_gain) {
          this.metadata.setFormat(
            "trackGain",
            infoTag.lame.extended.track_gain.adjustment,
          )
        }
        if (infoTag.lame.extended.album_gain) {
          this.metadata.setFormat(
            "albumGain",
            infoTag.lame.extended.album_gain.adjustment,
          )
        }
        this.metadata.setFormat(
          "duration",
          infoTag.lame.extended.music_length / 1000,
        )
      }
    }
    if (
      infoTag.streamSize &&
      this.audioFrameHeader &&
      infoTag.numFrames !== null
    ) {
      const duration = this.audioFrameHeader.calcDuration(infoTag.numFrames)
      this.metadata.setFormat("duration", duration)
      debug$k(
        "Get duration from Xing header: %s",
        this.metadata.format.duration,
      )
      return infoTag
    }
    // frames field is not present
    const frameDataLeft = this.frame_size - this.offset
    await this.skipFrameData(frameDataLeft)
    return infoTag
  }
  async skipFrameData(frameDataLeft) {
    if (frameDataLeft < 0)
      throw new MpegContentError("frame-data-left cannot be negative")
    await this.tokenizer.ignore(frameDataLeft)
    this.countSkipFrameData += frameDataLeft
  }
  areAllSame(array) {
    const first = array[0]
    return array.every((element) => {
      return element === first
    })
  }
}

var MpegParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  MpegContentError: MpegContentError,
  MpegParser: MpegParser,
})

/**
 * Ref:
 * - https://tools.ietf.org/html/draft-fleischman-asf-01, Appendix A: ASF GUIDs
 * - http://drang.s4.xrea.com/program/tips/id3tag/wmp/10_asf_guids.html
 * - http://drang.s4.xrea.com/program/tips/id3tag/wmp/index.html
 * - http://drang.s4.xrea.com/program/tips/id3tag/wmp/10_asf_guids.html
 *
 * ASF File Structure:
 * - https://msdn.microsoft.com/en-us/library/windows/desktop/ee663575(v=vs.85).aspx
 *
 * ASF GUIDs:
 * - http://drang.s4.xrea.com/program/tips/id3tag/wmp/10_asf_guids.html
 * - https://github.com/dji-sdk/FFmpeg/blob/master/libavformat/asf.c
 */
class GUID {
  static fromBin(bin, offset = 0) {
    return new GUID(GUID.decode(bin, offset))
  }
  /**
   * Decode GUID in format like "B503BF5F-2EA9-CF11-8EE3-00C00C205365"
   * @param objectId Binary GUID
   * @param offset Read offset in bytes, default 0
   * @returns GUID as dashed hexadecimal representation
   */
  static decode(objectId, offset = 0) {
    const view = new DataView(objectId.buffer, offset)
    const guid = `${view.getUint32(0, true).toString(16)}-${view.getUint16(4, true).toString(16)}-${view.getUint16(6, true).toString(16)}-${view.getUint16(8).toString(16)}-${uint8ArrayToHex(objectId.slice(offset + 10, offset + 16))}`
    return guid.toUpperCase()
  }
  /**
   * Decode stream type
   * @param mediaType Media type GUID
   * @returns Media type
   */
  static decodeMediaType(mediaType) {
    switch (mediaType.str) {
      case GUID.AudioMedia.str:
        return "audio"
      case GUID.VideoMedia.str:
        return "video"
      case GUID.CommandMedia.str:
        return "command"
      case GUID.Degradable_JPEG_Media.str:
        return "degradable-jpeg"
      case GUID.FileTransferMedia.str:
        return "file-transfer"
      case GUID.BinaryMedia.str:
        return "binary"
    }
  }
  /**
   * Encode GUID
   * @param guid GUID like: "B503BF5F-2EA9-CF11-8EE3-00C00C205365"
   * @returns Encoded Binary GUID
   */
  static encode(str) {
    const bin = new Uint8Array(16)
    const view = new DataView(bin.buffer)
    view.setUint32(0, Number.parseInt(str.slice(0, 8), 16), true)
    view.setUint16(4, Number.parseInt(str.slice(9, 13), 16), true)
    view.setUint16(6, Number.parseInt(str.slice(14, 18), 16), true)
    bin.set(hexToUint8Array(str.slice(19, 23)), 8)
    bin.set(hexToUint8Array(str.slice(24)), 10)
    return bin
  }
  constructor(str) {
    this.str = str
  }
  equals(guid) {
    return this.str === guid.str
  }
  toBin() {
    return GUID.encode(this.str)
  }
}
// 10.1 Top-level ASF object GUIDs
GUID.HeaderObject = new GUID("75B22630-668E-11CF-A6D9-00AA0062CE6C")
GUID.DataObject = new GUID("75B22636-668E-11CF-A6D9-00AA0062CE6C")
GUID.SimpleIndexObject = new GUID("33000890-E5B1-11CF-89F4-00A0C90349CB")
GUID.IndexObject = new GUID("D6E229D3-35DA-11D1-9034-00A0C90349BE")
GUID.MediaObjectIndexObject = new GUID("FEB103F8-12AD-4C64-840F-2A1D2F7AD48C")
GUID.TimecodeIndexObject = new GUID("3CB73FD0-0C4A-4803-953D-EDF7B6228F0C")
// 10.2 Header Object GUIDs
GUID.FilePropertiesObject = new GUID("8CABDCA1-A947-11CF-8EE4-00C00C205365")
GUID.StreamPropertiesObject = new GUID("B7DC0791-A9B7-11CF-8EE6-00C00C205365")
GUID.HeaderExtensionObject = new GUID("5FBF03B5-A92E-11CF-8EE3-00C00C205365")
GUID.CodecListObject = new GUID("86D15240-311D-11D0-A3A4-00A0C90348F6")
GUID.ScriptCommandObject = new GUID("1EFB1A30-0B62-11D0-A39B-00A0C90348F6")
GUID.MarkerObject = new GUID("F487CD01-A951-11CF-8EE6-00C00C205365")
GUID.BitrateMutualExclusionObject = new GUID(
  "D6E229DC-35DA-11D1-9034-00A0C90349BE",
)
GUID.ErrorCorrectionObject = new GUID("75B22635-668E-11CF-A6D9-00AA0062CE6C")
GUID.ContentDescriptionObject = new GUID("75B22633-668E-11CF-A6D9-00AA0062CE6C")
GUID.ExtendedContentDescriptionObject = new GUID(
  "D2D0A440-E307-11D2-97F0-00A0C95EA850",
)
GUID.ContentBrandingObject = new GUID("2211B3FA-BD23-11D2-B4B7-00A0C955FC6E")
GUID.StreamBitratePropertiesObject = new GUID(
  "7BF875CE-468D-11D1-8D82-006097C9A2B2",
)
GUID.ContentEncryptionObject = new GUID("2211B3FB-BD23-11D2-B4B7-00A0C955FC6E")
GUID.ExtendedContentEncryptionObject = new GUID(
  "298AE614-2622-4C17-B935-DAE07EE9289C",
)
GUID.DigitalSignatureObject = new GUID("2211B3FC-BD23-11D2-B4B7-00A0C955FC6E")
GUID.PaddingObject = new GUID("1806D474-CADF-4509-A4BA-9AABCB96AAE8")
// 10.3 Header Extension Object GUIDs
GUID.ExtendedStreamPropertiesObject = new GUID(
  "14E6A5CB-C672-4332-8399-A96952065B5A",
)
GUID.AdvancedMutualExclusionObject = new GUID(
  "A08649CF-4775-4670-8A16-6E35357566CD",
)
GUID.GroupMutualExclusionObject = new GUID(
  "D1465A40-5A79-4338-B71B-E36B8FD6C249",
)
GUID.StreamPrioritizationObject = new GUID(
  "D4FED15B-88D3-454F-81F0-ED5C45999E24",
)
GUID.BandwidthSharingObject = new GUID("A69609E6-517B-11D2-B6AF-00C04FD908E9")
GUID.LanguageListObject = new GUID("7C4346A9-EFE0-4BFC-B229-393EDE415C85")
GUID.MetadataObject = new GUID("C5F8CBEA-5BAF-4877-8467-AA8C44FA4CCA")
GUID.MetadataLibraryObject = new GUID("44231C94-9498-49D1-A141-1D134E457054")
GUID.IndexParametersObject = new GUID("D6E229DF-35DA-11D1-9034-00A0C90349BE")
GUID.MediaObjectIndexParametersObject = new GUID(
  "6B203BAD-3F11-48E4-ACA8-D7613DE2CFA7",
)
GUID.TimecodeIndexParametersObject = new GUID(
  "F55E496D-9797-4B5D-8C8B-604DFE9BFB24",
)
GUID.CompatibilityObject = new GUID("26F18B5D-4584-47EC-9F5F-0E651F0452C9")
GUID.AdvancedContentEncryptionObject = new GUID(
  "43058533-6981-49E6-9B74-AD12CB86D58C",
)
// 10.4 Stream Properties Object Stream Type GUIDs
GUID.AudioMedia = new GUID("F8699E40-5B4D-11CF-A8FD-00805F5C442B")
GUID.VideoMedia = new GUID("BC19EFC0-5B4D-11CF-A8FD-00805F5C442B")
GUID.CommandMedia = new GUID("59DACFC0-59E6-11D0-A3AC-00A0C90348F6")
GUID.JFIF_Media = new GUID("B61BE100-5B4E-11CF-A8FD-00805F5C442B")
GUID.Degradable_JPEG_Media = new GUID("35907DE0-E415-11CF-A917-00805F5C442B")
GUID.FileTransferMedia = new GUID("91BD222C-F21C-497A-8B6D-5AA86BFC0185")
GUID.BinaryMedia = new GUID("3AFB65E2-47EF-40F2-AC2C-70A90D71D343")
GUID.ASF_Index_Placeholder_Object = new GUID(
  "D9AADE20-7C17-4F9C-BC28-8555DD98E2A2",
)

function getParserForAttr(i) {
  return attributeParsers[i]
}
function parseUnicodeAttr(uint8Array) {
  return stripNulls(decodeString(uint8Array, "utf-16le"))
}
const attributeParsers = [
  parseUnicodeAttr,
  parseByteArrayAttr,
  parseBoolAttr,
  parseDWordAttr,
  parseQWordAttr,
  parseWordAttr,
  parseByteArrayAttr,
]
function parseByteArrayAttr(buf) {
  return new Uint8Array(buf)
}
function parseBoolAttr(buf, offset = 0) {
  return parseWordAttr(buf, offset) === 1
}
function parseDWordAttr(buf, offset = 0) {
  return UINT32_LE.get(buf, offset)
}
function parseQWordAttr(buf, offset = 0) {
  return UINT64_LE.get(buf, offset)
}
function parseWordAttr(buf, offset = 0) {
  return UINT16_LE.get(buf, offset)
}

// ASF Objects
class AsfContentParseError extends makeUnexpectedFileContentError("ASF") {}
/**
 * Data Type: Specifies the type of information being stored. The following values are recognized.
 */
var DataType$1
;(function (DataType) {
  /**
   * Unicode string. The data consists of a sequence of Unicode characters.
   */
  DataType[(DataType["UnicodeString"] = 0)] = "UnicodeString"
  /**
   * BYTE array. The type of data is implementation-specific.
   */
  DataType[(DataType["ByteArray"] = 1)] = "ByteArray"
  /**
   * BOOL. The data is 2 bytes long and should be interpreted as a 16-bit unsigned integer. Only 0x0000 or 0x0001 are permitted values.
   */
  DataType[(DataType["Bool"] = 2)] = "Bool"
  /**
   * DWORD. The data is 4 bytes long and should be interpreted as a 32-bit unsigned integer.
   */
  DataType[(DataType["DWord"] = 3)] = "DWord"
  /**
   * QWORD. The data is 8 bytes long and should be interpreted as a 64-bit unsigned integer.
   */
  DataType[(DataType["QWord"] = 4)] = "QWord"
  /**
   * WORD. The data is 2 bytes long and should be interpreted as a 16-bit unsigned integer.
   */
  DataType[(DataType["Word"] = 5)] = "Word"
})(DataType$1 || (DataType$1 = {}))
/**
 * Token for: 3. ASF top-level Header Object
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3
 */
const TopLevelHeaderObjectToken = {
  len: 30,
  get: (buf, off) => {
    return {
      objectId: GUID.fromBin(buf, off),
      objectSize: Number(UINT64_LE.get(buf, off + 16)),
      numberOfHeaderObjects: UINT32_LE.get(buf, off + 24),
      // Reserved: 2 bytes
    }
  },
}
/**
 * Token for: 3.1 Header Object (mandatory, one only)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_1
 */
const HeaderObjectToken = {
  len: 24,
  get: (buf, off) => {
    return {
      objectId: GUID.fromBin(buf, off),
      objectSize: Number(UINT64_LE.get(buf, off + 16)),
    }
  },
}
class State {
  constructor(header) {
    this.len = Number(header.objectSize) - HeaderObjectToken.len
  }
  postProcessTag(tags, name, valueType, data) {
    if (name === "WM/Picture") {
      tags.push({ id: name, value: WmPictureToken.fromBuffer(data) })
    } else {
      const parseAttr = getParserForAttr(valueType)
      if (!parseAttr) {
        throw new AsfContentParseError(
          `unexpected value headerType: ${valueType}`,
        )
      }
      tags.push({ id: name, value: parseAttr(data) })
    }
  }
}
// ToDo: use ignore type
class IgnoreObjectState extends State {
  get(buf, off) {
    return null
  }
}
/**
 * Token for: 3.2: File Properties Object (mandatory, one only)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_2
 */
class FilePropertiesObject extends State {
  get(buf, off) {
    return {
      fileId: GUID.fromBin(buf, off),
      fileSize: UINT64_LE.get(buf, off + 16),
      creationDate: UINT64_LE.get(buf, off + 24),
      dataPacketsCount: UINT64_LE.get(buf, off + 32),
      playDuration: UINT64_LE.get(buf, off + 40),
      sendDuration: UINT64_LE.get(buf, off + 48),
      preroll: UINT64_LE.get(buf, off + 56),
      flags: {
        broadcast: getBit(buf, off + 64, 24),
        seekable: getBit(buf, off + 64, 25),
      },
      // flagsNumeric: Token.UINT32_LE.get(buf, off + 64),
      minimumDataPacketSize: UINT32_LE.get(buf, off + 68),
      maximumDataPacketSize: UINT32_LE.get(buf, off + 72),
      maximumBitrate: UINT32_LE.get(buf, off + 76),
    }
  }
}
FilePropertiesObject.guid = GUID.FilePropertiesObject
/**
 * Token for: 3.3 Stream Properties Object (mandatory, one per stream)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_3
 */
class StreamPropertiesObject extends State {
  get(buf, off) {
    return {
      streamType: GUID.decodeMediaType(GUID.fromBin(buf, off)),
      errorCorrectionType: GUID.fromBin(buf, off + 8),
      // ToDo
    }
  }
}
StreamPropertiesObject.guid = GUID.StreamPropertiesObject
/**
 * 3.4: Header Extension Object (mandatory, one only)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_4
 */
class HeaderExtensionObject {
  constructor() {
    this.len = 22
  }
  get(buf, off) {
    const view = new DataView(buf.buffer, off)
    return {
      reserved1: GUID.fromBin(buf, off),
      reserved2: view.getUint16(16, true),
      extensionDataSize: view.getUint16(18, true),
    }
  }
}
HeaderExtensionObject.guid = GUID.HeaderExtensionObject
/**
 * 3.5: The Codec List Object provides user-friendly information about the codecs and formats used to encode the content found in the ASF file.
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_5
 */
const CodecListObjectHeader = {
  len: 20,
  get: (buf, off) => {
    const view = new DataView(buf.buffer, off)
    return {
      entryCount: view.getUint16(16, true),
    }
  },
}
async function readString(tokenizer) {
  const length = await tokenizer.readNumber(UINT16_LE)
  return (
    await tokenizer.readToken(new StringType(length * 2, "utf-16le"))
  ).replace("\0", "")
}
/**
 * 3.5: Read the Codec-List-Object, which provides user-friendly information about the codecs and formats used to encode the content found in the ASF file.
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_5
 */
async function readCodecEntries(tokenizer) {
  const codecHeader = await tokenizer.readToken(CodecListObjectHeader)
  const entries = []
  for (let i = 0; i < codecHeader.entryCount; ++i) {
    entries.push(await readCodecEntry(tokenizer))
  }
  return entries
}
async function readInformation(tokenizer) {
  const length = await tokenizer.readNumber(UINT16_LE)
  const buf = new Uint8Array(length)
  await tokenizer.readBuffer(buf)
  return buf
}
/**
 * Read Codec-Entries
 * @param tokenizer
 */
async function readCodecEntry(tokenizer) {
  const type = await tokenizer.readNumber(UINT16_LE)
  return {
    type: {
      videoCodec: (type & 0x0001) === 0x0001,
      audioCodec: (type & 0x0002) === 0x0002,
    },
    codecName: await readString(tokenizer),
    description: await readString(tokenizer),
    information: await readInformation(tokenizer),
  }
}
/**
 * 3.10 Content Description Object (optional, one only)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_10
 */
class ContentDescriptionObjectState extends State {
  get(buf, off) {
    const tags = []
    const view = new DataView(buf.buffer, off)
    let pos = 10
    for (
      let i = 0;
      i < ContentDescriptionObjectState.contentDescTags.length;
      ++i
    ) {
      const length = view.getUint16(i * 2, true)
      if (length > 0) {
        const tagName = ContentDescriptionObjectState.contentDescTags[i]
        const end = pos + length
        tags.push({
          id: tagName,
          value: parseUnicodeAttr(buf.slice(off + pos, off + end)),
        })
        pos = end
      }
    }
    return tags
  }
}
ContentDescriptionObjectState.guid = GUID.ContentDescriptionObject
ContentDescriptionObjectState.contentDescTags = [
  "Title",
  "Author",
  "Copyright",
  "Description",
  "Rating",
]
/**
 * 3.11 Extended Content Description Object (optional, one only)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/03_asf_top_level_header_object.html#3_11
 */
class ExtendedContentDescriptionObjectState extends State {
  get(buf, off) {
    const tags = []
    const view = new DataView(buf.buffer, off)
    const attrCount = view.getUint16(0, true)
    let pos = 2
    for (let i = 0; i < attrCount; i += 1) {
      const nameLen = view.getUint16(pos, true)
      pos += 2
      const name = parseUnicodeAttr(buf.slice(off + pos, off + pos + nameLen))
      pos += nameLen
      const valueType = view.getUint16(pos, true)
      pos += 2
      const valueLen = view.getUint16(pos, true)
      pos += 2
      const value = buf.slice(off + pos, off + pos + valueLen)
      pos += valueLen
      this.postProcessTag(tags, name, valueType, value)
    }
    return tags
  }
}
ExtendedContentDescriptionObjectState.guid =
  GUID.ExtendedContentDescriptionObject
/**
 * 4.1 Extended Stream Properties Object (optional, 1 per media stream)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/04_objects_in_the_asf_header_extension_object.html#4_1
 */
class ExtendedStreamPropertiesObjectState extends State {
  get(buf, off) {
    const view = new DataView(buf.buffer, off)
    return {
      startTime: UINT64_LE.get(buf, off),
      endTime: UINT64_LE.get(buf, off + 8),
      dataBitrate: view.getInt32(12, true),
      bufferSize: view.getInt32(16, true),
      initialBufferFullness: view.getInt32(20, true),
      alternateDataBitrate: view.getInt32(24, true),
      alternateBufferSize: view.getInt32(28, true),
      alternateInitialBufferFullness: view.getInt32(32, true),
      maximumObjectSize: view.getInt32(36, true),
      flags: {
        reliableFlag: getBit(buf, off + 40, 0),
        seekableFlag: getBit(buf, off + 40, 1),
        resendLiveCleanpointsFlag: getBit(buf, off + 40, 2),
      },
      // flagsNumeric: Token.UINT32_LE.get(buf, off + 64),
      streamNumber: view.getInt16(42, true),
      streamLanguageId: view.getInt16(44, true),
      averageTimePerFrame: view.getInt32(52, true),
      streamNameCount: view.getInt32(54, true),
      payloadExtensionSystems: view.getInt32(56, true),
      streamNames: [], // ToDo
      streamPropertiesObject: null,
    }
  }
}
ExtendedStreamPropertiesObjectState.guid = GUID.ExtendedStreamPropertiesObject
/**
 * 4.7  Metadata Object (optional, 0 or 1)
 * Ref: http://drang.s4.xrea.com/program/tips/id3tag/wmp/04_objects_in_the_asf_header_extension_object.html#4_7
 */
class MetadataObjectState extends State {
  get(uint8Array, off) {
    const tags = []
    const view = new DataView(uint8Array.buffer, off)
    const descriptionRecordsCount = view.getUint16(0, true)
    let pos = 2
    for (let i = 0; i < descriptionRecordsCount; i += 1) {
      pos += 4
      const nameLen = view.getUint16(pos, true)
      pos += 2
      const dataType = view.getUint16(pos, true)
      pos += 2
      const dataLen = view.getUint32(pos, true)
      pos += 4
      const name = parseUnicodeAttr(
        uint8Array.slice(off + pos, off + pos + nameLen),
      )
      pos += nameLen
      const data = uint8Array.slice(off + pos, off + pos + dataLen)
      pos += dataLen
      this.postProcessTag(tags, name, dataType, data)
    }
    return tags
  }
}
MetadataObjectState.guid = GUID.MetadataObject
// 4.8	Metadata Library Object (optional, 0 or 1)
class MetadataLibraryObjectState extends MetadataObjectState {}
MetadataLibraryObjectState.guid = GUID.MetadataLibraryObject
/**
 * Ref: https://msdn.microsoft.com/en-us/library/windows/desktop/dd757977(v=vs.85).aspx
 */
class WmPictureToken {
  static fromBuffer(buffer) {
    const pic = new WmPictureToken(buffer.length)
    return pic.get(buffer, 0)
  }
  constructor(len) {
    this.len = len
  }
  get(buffer, offset) {
    const view = new DataView(buffer.buffer, offset)
    const typeId = view.getUint8(0)
    const size = view.getInt32(1, true)
    let index = 5
    while (view.getUint16(index) !== 0) {
      index += 2
    }
    const format = new StringType(index - 5, "utf-16le").get(buffer, 5)
    while (view.getUint16(index) !== 0) {
      index += 2
    }
    const description = new StringType(index - 5, "utf-16le").get(buffer, 5)
    return {
      type: AttachedPictureType[typeId],
      format,
      description,
      size,
      data: buffer.slice(index + 4),
    }
  }
}

const debug$j = initDebug("music-metadata:parser:ASF")
const headerType = "asf"
/**
 * Windows Media Metadata Usage Guidelines
 * - Ref: https://msdn.microsoft.com/en-us/library/ms867702.aspx
 *
 * Ref:
 * - https://tools.ietf.org/html/draft-fleischman-asf-01
 * - https://hwiegman.home.xs4all.nl/fileformats/asf/ASF_Specification.pdf
 * - http://drang.s4.xrea.com/program/tips/id3tag/wmp/index.html
 * - https://msdn.microsoft.com/en-us/library/windows/desktop/ee663575(v=vs.85).aspx
 */
class AsfParser extends BasicParser {
  async parse() {
    const header = await this.tokenizer.readToken(TopLevelHeaderObjectToken)
    if (!header.objectId.equals(GUID.HeaderObject)) {
      throw new AsfContentParseError(
        `expected asf header; but was not found; got: ${header.objectId.str}`,
      )
    }
    try {
      await this.parseObjectHeader(header.numberOfHeaderObjects)
    } catch (err) {
      debug$j("Error while parsing ASF: %s", err)
    }
  }
  async parseObjectHeader(numberOfObjectHeaders) {
    let tags
    do {
      // Parse common header of the ASF Object (3.1)
      const header = await this.tokenizer.readToken(HeaderObjectToken)
      // Parse data part of the ASF Object
      debug$j("header GUID=%s", header.objectId.str)
      switch (header.objectId.str) {
        case FilePropertiesObject.guid.str: {
          // 3.2
          const fpo = await this.tokenizer.readToken(
            new FilePropertiesObject(header),
          )
          this.metadata.setFormat(
            "duration",
            Number(fpo.playDuration / BigInt(1000)) / 10000 -
              Number(fpo.preroll) / 1000,
          )
          this.metadata.setFormat("bitrate", fpo.maximumBitrate)
          break
        }
        case StreamPropertiesObject.guid.str: {
          // 3.3
          const spo = await this.tokenizer.readToken(
            new StreamPropertiesObject(header),
          )
          this.metadata.setFormat("container", `ASF/${spo.streamType}`)
          break
        }
        case HeaderExtensionObject.guid.str: {
          // 3.4
          const extHeader = await this.tokenizer.readToken(
            new HeaderExtensionObject(),
          )
          await this.parseExtensionObject(extHeader.extensionDataSize)
          break
        }
        case ContentDescriptionObjectState.guid.str: // 3.10
          tags = await this.tokenizer.readToken(
            new ContentDescriptionObjectState(header),
          )
          await this.addTags(tags)
          break
        case ExtendedContentDescriptionObjectState.guid.str: // 3.11
          tags = await this.tokenizer.readToken(
            new ExtendedContentDescriptionObjectState(header),
          )
          await this.addTags(tags)
          break
        case GUID.CodecListObject.str: {
          const codecs = await readCodecEntries(this.tokenizer)
          codecs.forEach((codec) => {
            this.metadata.addStreamInfo({
              type: codec.type.videoCodec ? TrackType.video : TrackType.audio,
              codecName: codec.codecName,
            })
          })
          const audioCodecs = codecs
            .filter((codec) => codec.type.audioCodec)
            .map((codec) => codec.codecName)
            .join("/")
          this.metadata.setFormat("codec", audioCodecs)
          break
        }
        case GUID.StreamBitratePropertiesObject.str:
          // ToDo?
          await this.tokenizer.ignore(header.objectSize - HeaderObjectToken.len)
          break
        case GUID.PaddingObject.str:
          // ToDo: register bytes pad
          debug$j(
            "Padding: %s bytes",
            header.objectSize - HeaderObjectToken.len,
          )
          await this.tokenizer.ignore(header.objectSize - HeaderObjectToken.len)
          break
        default:
          this.metadata.addWarning(
            `Ignore ASF-Object-GUID: ${header.objectId.str}`,
          )
          debug$j("Ignore ASF-Object-GUID: %s", header.objectId.str)
          await this.tokenizer.readToken(new IgnoreObjectState(header))
      }
    } while (--numberOfObjectHeaders)
    // done
  }
  async addTags(tags) {
    await Promise.all(
      tags.map(({ id, value }) => this.metadata.addTag(headerType, id, value)),
    )
  }
  async parseExtensionObject(extensionSize) {
    do {
      // Parse common header of the ASF Object (3.1)
      const header = await this.tokenizer.readToken(HeaderObjectToken)
      const remaining = header.objectSize - HeaderObjectToken.len
      // Parse data part of the ASF Object
      switch (header.objectId.str) {
        case ExtendedStreamPropertiesObjectState.guid.str: // 4.1
          // ToDo: extended stream header properties are ignored
          await this.tokenizer.readToken(
            new ExtendedStreamPropertiesObjectState(header),
          )
          break
        case MetadataObjectState.guid.str: {
          // 4.7
          const moTags = await this.tokenizer.readToken(
            new MetadataObjectState(header),
          )
          await this.addTags(moTags)
          break
        }
        case MetadataLibraryObjectState.guid.str: {
          // 4.8
          const mlTags = await this.tokenizer.readToken(
            new MetadataLibraryObjectState(header),
          )
          await this.addTags(mlTags)
          break
        }
        case GUID.PaddingObject.str:
          // ToDo: register bytes pad
          await this.tokenizer.ignore(remaining)
          break
        case GUID.CompatibilityObject.str:
          await this.tokenizer.ignore(remaining)
          break
        case GUID.ASF_Index_Placeholder_Object.str:
          await this.tokenizer.ignore(remaining)
          break
        default:
          this.metadata.addWarning(
            `Ignore ASF-Object-GUID: ${header.objectId.str}`,
          )
          // console.log("Ignore ASF-Object-GUID: %s", header.objectId.str);
          await this.tokenizer.readToken(new IgnoreObjectState(header))
          break
      }
      extensionSize -= header.objectSize
    } while (extensionSize > 0)
  }
}

var AsfParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  AsfParser: AsfParser,
})

/**
 * DSDIFF chunk header
 * The data-size encoding is deviating from EA-IFF 85
 * Ref: http://www.sonicstudio.com/pdf/dsd/DSDIFF_1.5_Spec.pdf
 */
const ChunkHeader64 = {
  len: 12,
  get: (buf, off) => {
    return {
      // Group-ID
      chunkID: FourCcToken.get(buf, off),
      // Size
      chunkSize: INT64_BE.get(buf, off + 4),
    }
  },
}

const debug$i = initDebug("music-metadata:parser:aiff")
class DsdiffContentParseError extends makeUnexpectedFileContentError(
  "DSDIFF",
) {}
/**
 * DSDIFF - Direct Stream Digital Interchange File Format (Phillips)
 *
 * Ref:
 * - http://www.sonicstudio.com/pdf/dsd/DSDIFF_1.5_Spec.pdf
 */
class DsdiffParser extends BasicParser {
  async parse() {
    const header = await this.tokenizer.readToken(ChunkHeader64)
    if (header.chunkID !== "FRM8")
      throw new DsdiffContentParseError("Unexpected chunk-ID")
    const type = (await this.tokenizer.readToken(FourCcToken)).trim()
    switch (type) {
      case "DSD":
        this.metadata.setFormat("container", `DSDIFF/${type}`)
        this.metadata.setFormat("lossless", true)
        return this.readFmt8Chunks(header.chunkSize - BigInt(FourCcToken.len))
      default:
        throw new DsdiffContentParseError(`Unsupported DSDIFF type: ${type}`)
    }
  }
  async readFmt8Chunks(remainingSize) {
    while (remainingSize >= ChunkHeader64.len) {
      const chunkHeader = await this.tokenizer.readToken(ChunkHeader64)
      //  If the data is an odd number of bytes in length, a pad byte must be added at the end
      debug$i(`Chunk id=${chunkHeader.chunkID}`)
      await this.readData(chunkHeader)
      remainingSize -= BigInt(ChunkHeader64.len) + chunkHeader.chunkSize
    }
  }
  async readData(header) {
    debug$i(
      `Reading data of chunk[ID=${header.chunkID}, size=${header.chunkSize}]`,
    )
    const p0 = this.tokenizer.position
    switch (header.chunkID.trim()) {
      case "FVER": {
        // 3.1 FORMAT VERSION CHUNK
        const version = await this.tokenizer.readToken(UINT32_LE)
        debug$i(`DSDIFF version=${version}`)
        break
      }
      case "PROP": {
        // 3.2 PROPERTY CHUNK
        const propType = await this.tokenizer.readToken(FourCcToken)
        if (propType !== "SND ")
          throw new DsdiffContentParseError("Unexpected PROP-chunk ID")
        await this.handleSoundPropertyChunks(
          header.chunkSize - BigInt(FourCcToken.len),
        )
        break
      }
      case "ID3": {
        // Unofficial ID3 tag support
        const id3_data = await this.tokenizer.readToken(
          new Uint8ArrayType(Number(header.chunkSize)),
        )
        const rst = fromBuffer$1(id3_data)
        await new ID3v2Parser().parse(this.metadata, rst, this.options)
        break
      }
      case "DSD":
        if (this.metadata.format.numberOfChannels) {
          this.metadata.setFormat(
            "numberOfSamples",
            Number(
              (header.chunkSize * BigInt(8)) /
                BigInt(this.metadata.format.numberOfChannels),
            ),
          )
        }
        if (
          this.metadata.format.numberOfSamples &&
          this.metadata.format.sampleRate
        ) {
          this.metadata.setFormat(
            "duration",
            this.metadata.format.numberOfSamples /
              this.metadata.format.sampleRate,
          )
        }
        break
      default:
        debug$i(`Ignore chunk[ID=${header.chunkID}, size=${header.chunkSize}]`)
        break
    }
    const remaining = header.chunkSize - BigInt(this.tokenizer.position - p0)
    if (remaining > 0) {
      debug$i(`After Parsing chunk, remaining ${remaining} bytes`)
      await this.tokenizer.ignore(Number(remaining))
    }
  }
  async handleSoundPropertyChunks(remainingSize) {
    debug$i(`Parsing sound-property-chunks, remainingSize=${remainingSize}`)
    while (remainingSize > 0) {
      const sndPropHeader = await this.tokenizer.readToken(ChunkHeader64)
      debug$i(
        `Sound-property-chunk[ID=${sndPropHeader.chunkID}, size=${sndPropHeader.chunkSize}]`,
      )
      const p0 = this.tokenizer.position
      switch (sndPropHeader.chunkID.trim()) {
        case "FS": {
          // 3.2.1 Sample Rate Chunk
          const sampleRate = await this.tokenizer.readToken(UINT32_BE)
          this.metadata.setFormat("sampleRate", sampleRate)
          break
        }
        case "CHNL": {
          // 3.2.2 Channels Chunk
          const numChannels = await this.tokenizer.readToken(UINT16_BE)
          this.metadata.setFormat("numberOfChannels", numChannels)
          await this.handleChannelChunks(
            sndPropHeader.chunkSize - BigInt(UINT16_BE.len),
          )
          break
        }
        case "CMPR": {
          // 3.2.3 Compression Type Chunk
          const compressionIdCode = (
            await this.tokenizer.readToken(FourCcToken)
          ).trim()
          const count = await this.tokenizer.readToken(UINT8)
          const compressionName = await this.tokenizer.readToken(
            new StringType(count, "ascii"),
          )
          if (compressionIdCode === "DSD") {
            this.metadata.setFormat("lossless", true)
            this.metadata.setFormat("bitsPerSample", 1)
          }
          this.metadata.setFormat(
            "codec",
            `${compressionIdCode} (${compressionName})`,
          )
          break
        }
        case "ABSS": {
          // 3.2.4 Absolute Start Time Chunk
          const hours = await this.tokenizer.readToken(UINT16_BE)
          const minutes = await this.tokenizer.readToken(UINT8)
          const seconds = await this.tokenizer.readToken(UINT8)
          const samples = await this.tokenizer.readToken(UINT32_BE)
          debug$i(`ABSS ${hours}:${minutes}:${seconds}.${samples}`)
          break
        }
        case "LSCO": {
          // 3.2.5 Loudspeaker Configuration Chunk
          const lsConfig = await this.tokenizer.readToken(UINT16_BE)
          debug$i(`LSCO lsConfig=${lsConfig}`)
          break
        }
        default:
          debug$i(
            `Unknown sound-property-chunk[ID=${sndPropHeader.chunkID}, size=${sndPropHeader.chunkSize}]`,
          )
          await this.tokenizer.ignore(Number(sndPropHeader.chunkSize))
      }
      const remaining =
        sndPropHeader.chunkSize - BigInt(this.tokenizer.position - p0)
      if (remaining > 0) {
        debug$i(
          `After Parsing sound-property-chunk ${sndPropHeader.chunkSize}, remaining ${remaining} bytes`,
        )
        await this.tokenizer.ignore(Number(remaining))
      }
      remainingSize -= BigInt(ChunkHeader64.len) + sndPropHeader.chunkSize
      debug$i(`Parsing sound-property-chunks, remainingSize=${remainingSize}`)
    }
    if (
      this.metadata.format.lossless &&
      this.metadata.format.sampleRate &&
      this.metadata.format.numberOfChannels &&
      this.metadata.format.bitsPerSample
    ) {
      const bitrate =
        this.metadata.format.sampleRate *
        this.metadata.format.numberOfChannels *
        this.metadata.format.bitsPerSample
      this.metadata.setFormat("bitrate", bitrate)
    }
  }
  async handleChannelChunks(remainingSize) {
    debug$i(`Parsing channel-chunks, remainingSize=${remainingSize}`)
    const channels = []
    while (remainingSize >= FourCcToken.len) {
      const channelId = await this.tokenizer.readToken(FourCcToken)
      debug$i(`Channel[ID=${channelId}]`)
      channels.push(channelId)
      remainingSize -= BigInt(FourCcToken.len)
    }
    debug$i(`Channels: ${channels.join(", ")}`)
    return channels
  }
}

var DsdiffParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  DsdiffContentParseError: DsdiffContentParseError,
  DsdiffParser: DsdiffParser,
})

const compressionTypes = {
  NONE: "not compressed	PCM	Apple Computer",
  sowt: "PCM (byte swapped)",
  fl32: "32-bit floating point IEEE 32-bit float",
  fl64: "64-bit floating point IEEE 64-bit float	Apple Computer",
  alaw: "ALaw 2:1	8-bit ITU-T G.711 A-law",
  ulaw: "µLaw 2:1	8-bit ITU-T G.711 µ-law	Apple Computer",
  ULAW: "CCITT G.711 u-law 8-bit ITU-T G.711 µ-law",
  ALAW: "CCITT G.711 A-law 8-bit ITU-T G.711 A-law",
  FL32: "Float 32	IEEE 32-bit float ",
}
class AiffContentError extends makeUnexpectedFileContentError("AIFF") {}
class Common {
  constructor(header, isAifc) {
    this.isAifc = isAifc
    const minimumChunkSize = isAifc ? 22 : 18
    if (header.chunkSize < minimumChunkSize)
      throw new AiffContentError(
        `COMMON CHUNK size should always be at least ${minimumChunkSize}`,
      )
    this.len = header.chunkSize
  }
  get(buf, off) {
    // see: https://cycling74.com/forums/aiffs-80-bit-sample-rate-value
    const shift = UINT16_BE.get(buf, off + 8) - 16398
    const baseSampleRate = UINT16_BE.get(buf, off + 8 + 2)
    const res = {
      numChannels: UINT16_BE.get(buf, off),
      numSampleFrames: UINT32_BE.get(buf, off + 2),
      sampleSize: UINT16_BE.get(buf, off + 6),
      sampleRate:
        shift < 0 ? baseSampleRate >> Math.abs(shift) : baseSampleRate << shift,
    }
    if (this.isAifc) {
      res.compressionType = FourCcToken.get(buf, off + 18)
      if (this.len > 22) {
        const strLen = UINT8.get(buf, off + 22)
        if (strLen > 0) {
          const padding = (strLen + 1) % 2
          if (23 + strLen + padding === this.len) {
            res.compressionName = new StringType(strLen, "latin1").get(
              buf,
              off + 23,
            )
          } else {
            throw new AiffContentError("Illegal pstring length")
          }
        } else {
          res.compressionName = undefined
        }
      }
    } else {
      res.compressionName = "PCM"
    }
    return res
  }
}

/**
 * Common AIFF chunk header
 */
const Header$4 = {
  len: 8,
  get: (buf, off) => {
    return {
      // Chunk type ID
      chunkID: FourCcToken.get(buf, off),
      // Chunk size
      chunkSize: Number(BigInt(UINT32_BE.get(buf, off + 4))),
    }
  },
}

const debug$h = initDebug("music-metadata:parser:aiff")
/**
 * AIFF - Audio Interchange File Format
 *
 * Ref:
 * - http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html
 * - http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-1.3.pdf
 */
class AIFFParser extends BasicParser {
  constructor() {
    super(...arguments)
    this.isCompressed = null
  }
  async parse() {
    const header = await this.tokenizer.readToken(Header$4)
    if (header.chunkID !== "FORM")
      throw new AiffContentError("Invalid Chunk-ID, expected 'FORM'") // Not AIFF format
    const type = await this.tokenizer.readToken(FourCcToken)
    switch (type) {
      case "AIFF":
        this.metadata.setFormat("container", type)
        this.isCompressed = false
        break
      case "AIFC":
        this.metadata.setFormat("container", "AIFF-C")
        this.isCompressed = true
        break
      default:
        throw new AiffContentError(`Unsupported AIFF type: ${type}`)
    }
    this.metadata.setFormat("lossless", !this.isCompressed)
    try {
      while (
        !this.tokenizer.fileInfo.size ||
        this.tokenizer.fileInfo.size - this.tokenizer.position >= Header$4.len
      ) {
        debug$h(`Reading AIFF chunk at offset=${this.tokenizer.position}`)
        const chunkHeader = await this.tokenizer.readToken(Header$4)
        const nextChunk = 2 * Math.round(chunkHeader.chunkSize / 2)
        const bytesRead = await this.readData(chunkHeader)
        await this.tokenizer.ignore(nextChunk - bytesRead)
      }
    } catch (err) {
      if (err instanceof EndOfStreamError$1) {
        debug$h("End-of-stream")
      } else {
        throw err
      }
    }
  }
  async readData(header) {
    switch (header.chunkID) {
      case "COMM": {
        // The Common Chunk
        if (this.isCompressed === null) {
          throw new AiffContentError(
            "Failed to parse AIFF.COMM chunk when compression type is unknown",
          )
        }
        const common = await this.tokenizer.readToken(
          new Common(header, this.isCompressed),
        )
        this.metadata.setFormat("bitsPerSample", common.sampleSize)
        this.metadata.setFormat("sampleRate", common.sampleRate)
        this.metadata.setFormat("numberOfChannels", common.numChannels)
        this.metadata.setFormat("numberOfSamples", common.numSampleFrames)
        this.metadata.setFormat(
          "duration",
          common.numSampleFrames / common.sampleRate,
        )
        if (common.compressionName || common.compressionType) {
          this.metadata.setFormat(
            "codec",
            common.compressionName ?? compressionTypes[common.compressionType],
          )
        }
        return header.chunkSize
      }
      case "ID3 ": {
        // ID3-meta-data
        const id3_data = await this.tokenizer.readToken(
          new Uint8ArrayType(header.chunkSize),
        )
        const rst = fromBuffer$1(id3_data)
        await new ID3v2Parser().parse(this.metadata, rst, this.options)
        return header.chunkSize
      }
      case "SSND": // Sound Data Chunk
        if (this.metadata.format.duration) {
          this.metadata.setFormat(
            "bitrate",
            (8 * header.chunkSize) / this.metadata.format.duration,
          )
        }
        return 0
      case "NAME": // Sample name chunk
      case "AUTH": // Author chunk
      case "(c) ": // Copyright chunk
      case "ANNO": // Annotation chunk
        return this.readTextChunk(header)
      default:
        debug$h(`Ignore chunk id=${header.chunkID}, size=${header.chunkSize}`)
        return 0
    }
  }
  async readTextChunk(header) {
    const value = await this.tokenizer.readToken(
      new StringType(header.chunkSize, "ascii"),
    )
    const values = value
      .split("\0")
      .map((v) => v.trim())
      .filter((v) => v?.length)
    await Promise.all(
      values.map((v) => this.metadata.addTag("AIFF", header.chunkID, v)),
    )
    return header.chunkSize
  }
}

var AiffParser = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  AIFFParser: AIFFParser,
})

/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
const ChunkHeader = {
  len: 12,
  get: (buf, off) => {
    return { id: FourCcToken.get(buf, off), size: UINT64_LE.get(buf, off + 4) }
  },
}
/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
const DsdChunk = {
  len: 16,
  get: (buf, off) => {
    return {
      fileSize: INT64_LE.get(buf, off),
      metadataPointer: INT64_LE.get(buf, off + 8),
    }
  },
}
var ChannelType
;(function (ChannelType) {
  ChannelType[(ChannelType["mono"] = 1)] = "mono"
  ChannelType[(ChannelType["stereo"] = 2)] = "stereo"
  ChannelType[(ChannelType["channels"] = 3)] = "channels"
  ChannelType[(ChannelType["quad"] = 4)] = "quad"
  ChannelType[(ChannelType["4 channels"] = 5)] = "4 channels"
  ChannelType[(ChannelType["5 channels"] = 6)] = "5 channels"
  ChannelType[(ChannelType["5.1 channels"] = 7)] = "5.1 channels"
})(ChannelType || (ChannelType = {}))
/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
const FormatChunk = {
  len: 40,
  get: (buf, off) => {
    return {
      formatVersion: INT32_LE.get(buf, off),
      formatID: INT32_LE.get(buf, off + 4),
      channelType: INT32_LE.get(buf, off + 8),
      channelNum: INT32_LE.get(buf, off + 12),
      samplingFrequency: INT32_LE.get(buf, off + 16),
      bitsPerSample: INT32_LE.get(buf, off + 20),
      sampleCount: INT64_LE.get(buf, off + 24),
      blockSizePerChannel: INT32_LE.get(buf, off + 32),
    }
  },
}

const debug$g = initDebug("music-metadata:parser:DSF")
class DsdContentParseError extends makeUnexpectedFileContentError("DSD") {}
/**
 * DSF (dsd stream file) File Parser
 * Ref: https://dsd-guide.com/sites/default/files/white-papers/DSFFileFormatSpec_E.pdf
 */
class DsfParser extends AbstractID3Parser {
  async postId3v2Parse() {
    const p0 = this.tokenizer.position // mark start position, normally 0
    const chunkHeader = await this.tokenizer.readToken(ChunkHeader)
    if (chunkHeader.id !== "DSD ")
      throw new DsdContentParseError("Invalid chunk signature")
    this.metadata.setFormat("container", "DSF")
    this.metadata.setFormat("lossless", true)
    const dsdChunk = await this.tokenizer.readToken(DsdChunk)
    if (dsdChunk.metadataPointer === BigInt(0)) {
      debug$g("No ID3v2 tag present")
    } else {
      debug$g(`expect ID3v2 at offset=${dsdChunk.metadataPointer}`)
      await this.parseChunks(dsdChunk.fileSize - chunkHeader.size)
      // Jump to ID3 header
      await this.tokenizer.ignore(
        Number(dsdChunk.metadataPointer) - this.tokenizer.position - p0,
      )
      return new ID3v2Parser().parse(
        this.metadata,
        this.tokenizer,
        this.options,
      )
    }
  }
  async parseChunks(bytesRemaining) {
    while (bytesRemaining >= ChunkHeader.len) {
      const chunkHeader = await this.tokenizer.readToken(ChunkHeader)
      debug$g(`Parsing chunk name=${chunkHeader.id} size=${chunkHeader.size}`)
      switch (chunkHeader.id) {
        case "fmt ": {
          const formatChunk = await this.tokenizer.readToken(FormatChunk)
          this.metadata.setFormat("numberOfChannels", formatChunk.channelNum)
          this.metadata.setFormat("sampleRate", formatChunk.samplingFrequency)
          this.metadata.setFormat("bitsPerSample", formatChunk.bitsPerSample)
          this.metadata.setFormat("numberOfSamples", formatChunk.sampleCount)
          this.metadata.setFormat(
            "duration",
            Number(formatChunk.sampleCount) / formatChunk.samplingFrequency,
          )
          const bitrate =
            formatChunk.bitsPerSample *
            formatChunk.samplingFrequency *
            formatChunk.channelNum
          this.metadata.setFormat("bitrate", bitrate)
          return // We got what we want, stop further processing of chunks
        }
        default:
          this.tokenizer.ignore(Number(chunkHeader.size) - ChunkHeader.len)
          break
      }
      bytesRemaining -= chunkHeader.size
    }
  }
}

var DsfParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  DsdContentParseError: DsdContentParseError,
  DsfParser: DsfParser,
})

/**
 * Parse the METADATA_BLOCK_PICTURE
 * Ref: https://wiki.xiph.org/VorbisComment#METADATA_BLOCK_PICTURE
 * Ref: https://xiph.org/flac/format.html#metadata_block_picture
 * // ToDo: move to ID3 / APIC?
 */
class VorbisPictureToken {
  static fromBase64(base64str) {
    return VorbisPictureToken.fromBuffer(
      Uint8Array.from(atob(base64str), (c) => c.charCodeAt(0)),
    )
  }
  static fromBuffer(buffer) {
    const pic = new VorbisPictureToken(buffer.length)
    return pic.get(buffer, 0)
  }
  constructor(len) {
    this.len = len
  }
  get(buffer, offset) {
    const type = AttachedPictureType[UINT32_BE.get(buffer, offset)]
    offset += 4
    const mimeLen = UINT32_BE.get(buffer, offset)
    offset += 4
    const format = new StringType(mimeLen, "utf-8").get(buffer, offset)
    offset += mimeLen
    const descLen = UINT32_BE.get(buffer, offset)
    offset += 4
    const description = new StringType(descLen, "utf-8").get(buffer, offset)
    offset += descLen
    const width = UINT32_BE.get(buffer, offset)
    offset += 4
    const height = UINT32_BE.get(buffer, offset)
    offset += 4
    const colour_depth = UINT32_BE.get(buffer, offset)
    offset += 4
    const indexed_color = UINT32_BE.get(buffer, offset)
    offset += 4
    const picDataLen = UINT32_BE.get(buffer, offset)
    offset += 4
    const data = Uint8Array.from(buffer.slice(offset, offset + picDataLen))
    return {
      type,
      format,
      description,
      width,
      height,
      colour_depth,
      indexed_color,
      data,
    }
  }
}
/**
 * Comment header decoder
 * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-620004.2.1
 */
const CommonHeader = {
  len: 7,
  get: (buf, off) => {
    return {
      packetType: UINT8.get(buf, off),
      vorbis: new StringType(6, "ascii").get(buf, off + 1),
    }
  },
}
/**
 * Identification header decoder
 * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-630004.2.2
 */
const IdentificationHeader$1 = {
  len: 23,
  get: (uint8Array, off) => {
    return {
      version: UINT32_LE.get(uint8Array, off + 0),
      channelMode: UINT8.get(uint8Array, off + 4),
      sampleRate: UINT32_LE.get(uint8Array, off + 5),
      bitrateMax: UINT32_LE.get(uint8Array, off + 9),
      bitrateNominal: UINT32_LE.get(uint8Array, off + 13),
      bitrateMin: UINT32_LE.get(uint8Array, off + 17),
    }
  },
}

class VorbisDecoder {
  constructor(data, offset) {
    this.data = data
    this.offset = offset
  }
  readInt32() {
    const value = UINT32_LE.get(this.data, this.offset)
    this.offset += 4
    return value
  }
  readStringUtf8() {
    const len = this.readInt32()
    const value = new TextDecoder("utf-8").decode(
      this.data.subarray(this.offset, this.offset + len),
    )
    this.offset += len
    return value
  }
  parseUserComment() {
    const offset0 = this.offset
    const v = this.readStringUtf8()
    const idx = v.indexOf("=")
    return {
      key: v.slice(0, idx).toUpperCase(),
      value: v.slice(idx + 1),
      len: this.offset - offset0,
    }
  }
}

const debug$f = initDebug("music-metadata:parser:ogg:vorbis1")
class VorbisContentError extends makeUnexpectedFileContentError("Vorbis") {}
/**
 * Vorbis 1 Parser.
 * Used by OggParser
 */
class VorbisParser {
  constructor(metadata, options) {
    this.metadata = metadata
    this.options = options
    this.pageSegments = []
  }
  /**
   * Vorbis 1 parser
   * @param header Ogg Page Header
   * @param pageData Page data
   */
  async parsePage(header, pageData) {
    if (header.headerType.firstPage) {
      this.parseFirstPage(header, pageData)
    } else {
      if (header.headerType.continued) {
        if (this.pageSegments.length === 0) {
          throw new VorbisContentError("Cannot continue on previous page")
        }
        this.pageSegments.push(pageData)
      }
      if (header.headerType.lastPage || !header.headerType.continued) {
        // Flush page segments
        if (this.pageSegments.length > 0) {
          const fullPage = VorbisParser.mergeUint8Arrays(this.pageSegments)
          await this.parseFullPage(fullPage)
        }
        // Reset page segments
        this.pageSegments = header.headerType.lastPage ? [] : [pageData]
      }
    }
    if (header.headerType.lastPage) {
      this.calculateDuration(header)
    }
  }
  static mergeUint8Arrays(arrays) {
    const totalSize = arrays.reduce((acc, e) => acc + e.length, 0)
    const merged = new Uint8Array(totalSize)
    arrays.forEach((array, i, _arrays) => {
      const offset = _arrays.slice(0, i).reduce((acc, e) => acc + e.length, 0)
      merged.set(array, offset)
    })
    return merged
  }
  async flush() {
    await this.parseFullPage(VorbisParser.mergeUint8Arrays(this.pageSegments))
  }
  async parseUserComment(pageData, offset) {
    const decoder = new VorbisDecoder(pageData, offset)
    const tag = decoder.parseUserComment()
    await this.addTag(tag.key, tag.value)
    return tag.len
  }
  async addTag(id, value) {
    if (id === "METADATA_BLOCK_PICTURE" && typeof value === "string") {
      if (this.options.skipCovers) {
        debug$f("Ignore picture")
        return
      }
      value = VorbisPictureToken.fromBase64(value)
      debug$f(`Push picture: id=${id}, format=${value.format}`)
    } else {
      debug$f(`Push tag: id=${id}, value=${value}`)
    }
    await this.metadata.addTag("vorbis", id, value)
  }
  calculateDuration(header) {
    if (
      this.metadata.format.sampleRate &&
      header.absoluteGranulePosition >= 0
    ) {
      // Calculate duration
      this.metadata.setFormat("numberOfSamples", header.absoluteGranulePosition)
      this.metadata.setFormat(
        "duration",
        header.absoluteGranulePosition / this.metadata.format.sampleRate,
      )
    }
  }
  /**
   * Parse first Ogg/Vorbis page
   * @param header
   * @param pageData
   */
  parseFirstPage(header, pageData) {
    this.metadata.setFormat("codec", "Vorbis I")
    debug$f("Parse first page")
    // Parse  Vorbis common header
    const commonHeader = CommonHeader.get(pageData, 0)
    if (commonHeader.vorbis !== "vorbis")
      throw new VorbisContentError("Metadata does not look like Vorbis")
    if (commonHeader.packetType === 1) {
      const idHeader = IdentificationHeader$1.get(pageData, CommonHeader.len)
      this.metadata.setFormat("sampleRate", idHeader.sampleRate)
      this.metadata.setFormat("bitrate", idHeader.bitrateNominal)
      this.metadata.setFormat("numberOfChannels", idHeader.channelMode)
      debug$f(
        "sample-rate=%s[hz], bitrate=%s[b/s], channel-mode=%s",
        idHeader.sampleRate,
        idHeader.bitrateNominal,
        idHeader.channelMode,
      )
    } else
      throw new VorbisContentError(
        "First Ogg page should be type 1: the identification header",
      )
  }
  async parseFullPage(pageData) {
    // New page
    const commonHeader = CommonHeader.get(pageData, 0)
    debug$f(
      "Parse full page: type=%s, byteLength=%s",
      commonHeader.packetType,
      pageData.byteLength,
    )
    switch (commonHeader.packetType) {
      case 3: //  type 3: comment header
        return this.parseUserCommentList(pageData, CommonHeader.len)
    }
  }
  /**
   * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-840005.2
   */
  async parseUserCommentList(pageData, offset) {
    const strLen = UINT32_LE.get(pageData, offset)
    offset += 4
    // const vendorString = new Token.StringType(strLen, 'utf-8').get(pageData, offset);
    offset += strLen
    let userCommentListLength = UINT32_LE.get(pageData, offset)
    offset += 4
    while (userCommentListLength-- > 0) {
      offset += await this.parseUserComment(pageData, offset)
    }
  }
}

const debug$e = initDebug("music-metadata:parser:FLAC")
class FlacContentError extends makeUnexpectedFileContentError("FLAC") {}
/**
 * FLAC supports up to 128 kinds of metadata blocks; currently the following are defined:
 * ref: https://xiph.org/flac/format.html#metadata_block
 */
var BlockType
;(function (BlockType) {
  BlockType[(BlockType["STREAMINFO"] = 0)] = "STREAMINFO"
  BlockType[(BlockType["PADDING"] = 1)] = "PADDING"
  BlockType[(BlockType["APPLICATION"] = 2)] = "APPLICATION"
  BlockType[(BlockType["SEEKTABLE"] = 3)] = "SEEKTABLE"
  BlockType[(BlockType["VORBIS_COMMENT"] = 4)] = "VORBIS_COMMENT"
  BlockType[(BlockType["CUESHEET"] = 5)] = "CUESHEET"
  BlockType[(BlockType["PICTURE"] = 6)] = "PICTURE"
})(BlockType || (BlockType = {}))
class FlacParser extends AbstractID3Parser {
  constructor() {
    super(...arguments)
    this.vorbisParser = new VorbisParser(this.metadata, this.options)
    this.padding = 0
  }
  async postId3v2Parse() {
    const fourCC = await this.tokenizer.readToken(FourCcToken)
    if (fourCC.toString() !== "fLaC") {
      throw new FlacContentError("Invalid FLAC preamble")
    }
    let blockHeader
    do {
      // Read block header
      blockHeader = await this.tokenizer.readToken(BlockHeader)
      // Parse block data
      await this.parseDataBlock(blockHeader)
    } while (!blockHeader.lastBlock)
    if (this.tokenizer.fileInfo.size && this.metadata.format.duration) {
      const dataSize = this.tokenizer.fileInfo.size - this.tokenizer.position
      this.metadata.setFormat(
        "bitrate",
        (8 * dataSize) / this.metadata.format.duration,
      )
    }
  }
  async parseDataBlock(blockHeader) {
    debug$e(
      `blockHeader type=${blockHeader.type}, length=${blockHeader.length}`,
    )
    switch (blockHeader.type) {
      case BlockType.STREAMINFO:
        return this.parseBlockStreamInfo(blockHeader.length)
      case BlockType.PADDING:
        this.padding += blockHeader.length
        break
      case BlockType.APPLICATION:
        break
      case BlockType.SEEKTABLE:
        break
      case BlockType.VORBIS_COMMENT:
        return this.parseComment(blockHeader.length)
      case BlockType.CUESHEET:
        break
      case BlockType.PICTURE:
        await this.parsePicture(blockHeader.length)
        return
      default:
        this.metadata.addWarning(`Unknown block type: ${blockHeader.type}`)
    }
    // Ignore data block
    return this.tokenizer.ignore(blockHeader.length).then()
  }
  /**
   * Parse STREAMINFO
   */
  async parseBlockStreamInfo(dataLen) {
    if (dataLen !== BlockStreamInfo.len)
      throw new FlacContentError("Unexpected block-stream-info length")
    const streamInfo = await this.tokenizer.readToken(BlockStreamInfo)
    this.metadata.setFormat("container", "FLAC")
    this.metadata.setFormat("codec", "FLAC")
    this.metadata.setFormat("lossless", true)
    this.metadata.setFormat("numberOfChannels", streamInfo.channels)
    this.metadata.setFormat("bitsPerSample", streamInfo.bitsPerSample)
    this.metadata.setFormat("sampleRate", streamInfo.sampleRate)
    if (streamInfo.totalSamples > 0) {
      this.metadata.setFormat(
        "duration",
        streamInfo.totalSamples / streamInfo.sampleRate,
      )
    }
  }
  /**
   * Parse VORBIS_COMMENT
   * Ref: https://www.xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-640004.2.3
   */
  async parseComment(dataLen) {
    const data = await this.tokenizer.readToken(new Uint8ArrayType(dataLen))
    const decoder = new VorbisDecoder(data, 0)
    decoder.readStringUtf8() // vendor (skip)
    const commentListLength = decoder.readInt32()
    const tags = new Array(commentListLength)
    for (let i = 0; i < commentListLength; i++) {
      tags[i] = decoder.parseUserComment()
    }
    await Promise.all(
      tags.map((tag) => this.vorbisParser.addTag(tag.key, tag.value)),
    )
  }
  async parsePicture(dataLen) {
    if (this.options.skipCovers) {
      return this.tokenizer.ignore(dataLen)
    }
    const picture = await this.tokenizer.readToken(
      new VorbisPictureToken(dataLen),
    )
    this.vorbisParser.addTag("METADATA_BLOCK_PICTURE", picture)
  }
}
const BlockHeader = {
  len: 4,
  get: (buf, off) => {
    return {
      lastBlock: getBit(buf, off, 7),
      type: getBitAllignedNumber$1(buf, off, 1, 7),
      length: UINT24_BE.get(buf, off + 1),
    }
  },
}
/**
 * METADATA_BLOCK_DATA
 * Ref: https://xiph.org/flac/format.html#metadata_block_streaminfo
 */
const BlockStreamInfo = {
  len: 34,
  get: (buf, off) => {
    return {
      // The minimum block size (in samples) used in the stream.
      minimumBlockSize: UINT16_BE.get(buf, off),
      // The maximum block size (in samples) used in the stream.
      // (Minimum blocksize == maximum blocksize) implies a fixed-blocksize stream.
      maximumBlockSize: UINT16_BE.get(buf, off + 2) / 1000,
      // The minimum frame size (in bytes) used in the stream.
      // May be 0 to imply the value is not known.
      minimumFrameSize: UINT24_BE.get(buf, off + 4),
      // The maximum frame size (in bytes) used in the stream.
      // May be 0 to imply the value is not known.
      maximumFrameSize: UINT24_BE.get(buf, off + 7),
      // Sample rate in Hz. Though 20 bits are available,
      // the maximum sample rate is limited by the structure of frame headers to 655350Hz.
      // Also, a value of 0 is invalid.
      sampleRate: UINT24_BE.get(buf, off + 10) >> 4,
      // probably slower: sampleRate: common.getBitAllignedNumber(buf, off + 10, 0, 20),
      // (number of channels)-1. FLAC supports from 1 to 8 channels
      channels: getBitAllignedNumber$1(buf, off + 12, 4, 3) + 1,
      // bits per sample)-1.
      // FLAC supports from 4 to 32 bits per sample. Currently the reference encoder and decoders only support up to 24 bits per sample.
      bitsPerSample: getBitAllignedNumber$1(buf, off + 12, 7, 5) + 1,
      // Total samples in stream.
      // 'Samples' means inter-channel sample, i.e. one second of 44.1Khz audio will have 44100 samples regardless of the number of channels.
      // A value of zero here means the number of total samples is unknown.
      totalSamples: getBitAllignedNumber$1(buf, off + 13, 4, 36),
      // the MD5 hash of the file (see notes for usage... it's a littly tricky)
      fileMD5: new Uint8ArrayType(16).get(buf, off + 18),
    }
  },
}

var FlacParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  FlacParser: FlacParser,
})

var DataType
;(function (DataType) {
  DataType[(DataType["string"] = 0)] = "string"
  DataType[(DataType["uint"] = 1)] = "uint"
  DataType[(DataType["uid"] = 2)] = "uid"
  DataType[(DataType["bool"] = 3)] = "bool"
  DataType[(DataType["binary"] = 4)] = "binary"
  DataType[(DataType["float"] = 5)] = "float"
})(DataType || (DataType = {}))

/**
 * Elements of document type description
 * Derived from https://github.com/tungol/EBML/blob/master/doctypes/matroska.dtd
 * Extended with:
 * - https://www.matroska.org/technical/specs/index.html
 */
const matroskaDtd = {
  name: "dtd",
  container: {
    0x1a45dfa3: {
      name: "ebml",
      container: {
        0x4286: { name: "ebmlVersion", value: DataType.uint }, // 5.1.1
        0x42f7: { name: "ebmlReadVersion", value: DataType.uint }, // 5.1.2
        0x42f2: { name: "ebmlMaxIDWidth", value: DataType.uint }, // 5.1.3
        0x42f3: { name: "ebmlMaxSizeWidth", value: DataType.uint }, // 5.1.4
        0x4282: { name: "docType", value: DataType.string }, // 5.1.5
        0x4287: { name: "docTypeVersion", value: DataType.uint }, // 5.1.6
        0x4285: { name: "docTypeReadVersion", value: DataType.uint }, // 5.1.7
      },
    },
    // Matroska segments
    0x18538067: {
      name: "segment",
      container: {
        // Meta Seek Information (also known as MetaSeek)
        0x114d9b74: {
          name: "seekHead",
          container: {
            0x4dbb: {
              name: "seek",
              multiple: true,
              container: {
                0x53ab: { name: "id", value: DataType.binary },
                0x53ac: { name: "position", value: DataType.uint },
              },
            },
          },
        },
        // Segment Information
        0x1549a966: {
          name: "info",
          container: {
            0x73a4: { name: "uid", value: DataType.uid },
            0x7384: { name: "filename", value: DataType.string },
            0x3cb923: { name: "prevUID", value: DataType.uid },
            0x3c83ab: { name: "prevFilename", value: DataType.string },
            0x3eb923: { name: "nextUID", value: DataType.uid },
            0x3e83bb: { name: "nextFilename", value: DataType.string },
            0x2ad7b1: { name: "timecodeScale", value: DataType.uint },
            0x4489: { name: "duration", value: DataType.float },
            0x4461: { name: "dateUTC", value: DataType.uint },
            0x7ba9: { name: "title", value: DataType.string },
            0x4d80: { name: "muxingApp", value: DataType.string },
            0x5741: { name: "writingApp", value: DataType.string },
          },
        },
        // Cluster
        0x1f43b675: {
          name: "cluster",
          multiple: true,
          container: {
            0xe7: { name: "timecode", value: DataType.uid },
            0x58d7: { name: "silentTracks ", multiple: true },
            0xa7: { name: "position", value: DataType.uid },
            0xab: { name: "prevSize", value: DataType.uid },
            0xa0: { name: "blockGroup" },
            0xa3: { name: "simpleBlock" },
          },
        },
        // Track
        0x1654ae6b: {
          name: "tracks",
          container: {
            0xae: {
              name: "entries",
              multiple: true,
              container: {
                0xd7: { name: "trackNumber", value: DataType.uint },
                0x73c5: { name: "uid", value: DataType.uid },
                0x83: { name: "trackType", value: DataType.uint },
                0xb9: { name: "flagEnabled", value: DataType.bool },
                0x88: { name: "flagDefault", value: DataType.bool },
                0x55aa: { name: "flagForced", value: DataType.bool }, // extended
                0x9c: { name: "flagLacing", value: DataType.bool },
                0x6de7: { name: "minCache", value: DataType.uint },
                0x6de8: { name: "maxCache", value: DataType.uint },
                0x23e383: { name: "defaultDuration", value: DataType.uint },
                0x23314f: { name: "timecodeScale", value: DataType.float },
                0x536e: { name: "name", value: DataType.string },
                0x22b59c: { name: "language", value: DataType.string },
                0x86: { name: "codecID", value: DataType.string },
                0x63a2: { name: "codecPrivate", value: DataType.binary },
                0x258688: { name: "codecName", value: DataType.string },
                0x3a9697: { name: "codecSettings", value: DataType.string },
                0x3b4040: { name: "codecInfoUrl", value: DataType.string },
                0x26b240: { name: "codecDownloadUrl", value: DataType.string },
                0xaa: { name: "codecDecodeAll", value: DataType.bool },
                0x6fab: { name: "trackOverlay", value: DataType.uint },
                // Video
                0xe0: {
                  name: "video",
                  container: {
                    0x9a: { name: "flagInterlaced", value: DataType.bool },
                    0x53b8: { name: "stereoMode", value: DataType.uint },
                    0xb0: { name: "pixelWidth", value: DataType.uint },
                    0xba: { name: "pixelHeight", value: DataType.uint },
                    0x54b0: { name: "displayWidth", value: DataType.uint },
                    0x54ba: { name: "displayHeight", value: DataType.uint },
                    0x54b3: { name: "aspectRatioType", value: DataType.uint },
                    0x2eb524: { name: "colourSpace", value: DataType.uint },
                    0x2fb523: { name: "gammaValue", value: DataType.float },
                  },
                },
                // Audio
                0xe1: {
                  name: "audio",
                  container: {
                    0xb5: { name: "samplingFrequency", value: DataType.float },
                    0x78b5: {
                      name: "outputSamplingFrequency",
                      value: DataType.float,
                    },
                    0x9f: { name: "channels", value: DataType.uint }, // https://www.matroska.org/technical/specs/index.html
                    0x94: { name: "channels", value: DataType.uint },
                    0x7d7b: {
                      name: "channelPositions",
                      value: DataType.binary,
                    },
                    0x6264: { name: "bitDepth", value: DataType.uint },
                  },
                },
                // Content Encoding
                0x6d80: {
                  name: "contentEncodings",
                  container: {
                    0x6240: {
                      name: "contentEncoding",
                      container: {
                        0x5031: { name: "order", value: DataType.uint },
                        0x5032: { name: "scope", value: DataType.bool },
                        0x5033: { name: "type", value: DataType.uint },
                        0x5034: {
                          name: "contentEncoding",
                          container: {
                            0x4254: {
                              name: "contentCompAlgo",
                              value: DataType.uint,
                            },
                            0x4255: {
                              name: "contentCompSettings",
                              value: DataType.binary,
                            },
                          },
                        },
                        0x5035: {
                          name: "contentEncoding",
                          container: {
                            0x47e1: {
                              name: "contentEncAlgo",
                              value: DataType.uint,
                            },
                            0x47e2: {
                              name: "contentEncKeyID",
                              value: DataType.binary,
                            },
                            0x47e3: {
                              name: "contentSignature ",
                              value: DataType.binary,
                            },
                            0x47e4: {
                              name: "ContentSigKeyID  ",
                              value: DataType.binary,
                            },
                            0x47e5: {
                              name: "contentSigAlgo ",
                              value: DataType.uint,
                            },
                            0x47e6: {
                              name: "contentSigHashAlgo ",
                              value: DataType.uint,
                            },
                          },
                        },
                        0x6264: { name: "bitDepth", value: DataType.uint },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // Cueing Data
        0x1c53bb6b: {
          name: "cues",
          container: {
            0xbb: {
              name: "cuePoint",
              container: {
                0xb3: { name: "cueTime", value: DataType.uid },
                0xb7: {
                  name: "positions",
                  container: {
                    0xf7: { name: "track", value: DataType.uint },
                    0xf1: { name: "clusterPosition", value: DataType.uint },
                    0x5378: { name: "blockNumber", value: DataType.uint },
                    0xea: { name: "codecState", value: DataType.uint },
                    0xdb: {
                      name: "reference",
                      container: {
                        0x96: { name: "time", value: DataType.uint },
                        0x97: { name: "cluster", value: DataType.uint },
                        0x535f: { name: "number", value: DataType.uint },
                        0xeb: { name: "codecState", value: DataType.uint },
                      },
                    },
                    0xf0: { name: "relativePosition", value: DataType.uint }, // extended
                  },
                },
              },
            },
          },
        },
        // Attachment
        0x1941a469: {
          name: "attachments",
          container: {
            0x61a7: {
              name: "attachedFiles",
              multiple: true,
              container: {
                0x467e: { name: "description", value: DataType.string },
                0x466e: { name: "name", value: DataType.string },
                0x4660: { name: "mimeType", value: DataType.string },
                0x465c: { name: "data", value: DataType.binary },
                0x46ae: { name: "uid", value: DataType.uid },
              },
            },
          },
        },
        // Chapters
        0x1043a770: {
          name: "chapters",
          container: {
            0x45b9: {
              name: "editionEntry",
              container: {
                0xb6: {
                  name: "chapterAtom",
                  container: {
                    0x73c4: { name: "uid", value: DataType.uid },
                    0x91: { name: "timeStart", value: DataType.uint },
                    0x92: { name: "timeEnd", value: DataType.uid },
                    0x98: { name: "hidden", value: DataType.bool },
                    0x4598: { name: "enabled", value: DataType.uid },
                    0x8f: {
                      name: "track",
                      container: {
                        0x89: { name: "trackNumber", value: DataType.uid },
                        0x80: {
                          name: "display",
                          container: {
                            0x85: { name: "string", value: DataType.string },
                            0x437c: {
                              name: "language ",
                              value: DataType.string,
                            },
                            0x437e: {
                              name: "country ",
                              value: DataType.string,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // Tagging
        0x1254c367: {
          name: "tags",
          container: {
            0x7373: {
              name: "tag",
              multiple: true,
              container: {
                0x63c0: {
                  name: "target",
                  container: {
                    0x63c5: { name: "tagTrackUID", value: DataType.uid },
                    0x63c4: { name: "tagChapterUID", value: DataType.uint },
                    0x63c6: { name: "tagAttachmentUID", value: DataType.uid },
                    0x63ca: { name: "targetType", value: DataType.string }, // extended
                    0x68ca: { name: "targetTypeValue", value: DataType.uint }, // extended
                    0x63c9: { name: "tagEditionUID", value: DataType.uid }, // extended
                  },
                },
                0x67c8: {
                  name: "simpleTags",
                  multiple: true,
                  container: {
                    0x45a3: { name: "name", value: DataType.string },
                    0x4487: { name: "string", value: DataType.string },
                    0x4485: { name: "binary", value: DataType.binary },
                    0x447a: { name: "language", value: DataType.string }, // extended
                    0x447b: { name: "languageIETF", value: DataType.string }, // extended
                    0x4484: { name: "default", value: DataType.bool }, // extended
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

const debug$d = initDebug("music-metadata:parser:ebml")
class EbmlContentError extends makeUnexpectedFileContentError("EBML") {}
var ParseAction
;(function (ParseAction) {
  ParseAction[(ParseAction["ReadNext"] = 0)] = "ReadNext"
  ParseAction[(ParseAction["IgnoreElement"] = 2)] = "IgnoreElement"
  ParseAction[(ParseAction["SkipSiblings"] = 3)] = "SkipSiblings"
  ParseAction[(ParseAction["TerminateParsing"] = 4)] = "TerminateParsing"
  ParseAction[(ParseAction["SkipElement"] = 5)] = "SkipElement" // Consider the element has read, assume position is at the next element
})(ParseAction || (ParseAction = {}))
/**
 * Extensible Binary Meta Language (EBML) iterator
 * https://en.wikipedia.org/wiki/Extensible_Binary_Meta_Language
 * http://matroska.sourceforge.net/technical/specs/rfc/index.html
 *
 * WEBM VP8 AUDIO FILE
 */
class EbmlIterator {
  /**
   * @param {ITokenizer} tokenizer Input
   * @param tokenizer
   */
  constructor(tokenizer) {
    this.tokenizer = tokenizer
    this.padding = 0
    this.parserMap = new Map()
    this.ebmlMaxIDLength = 4
    this.ebmlMaxSizeLength = 8
    this.parserMap.set(DataType.uint, (e) => this.readUint(e))
    this.parserMap.set(DataType.string, (e) => this.readString(e))
    this.parserMap.set(DataType.binary, (e) => this.readBuffer(e))
    this.parserMap.set(DataType.uid, async (e) => this.readBuffer(e))
    this.parserMap.set(DataType.bool, (e) => this.readFlag(e))
    this.parserMap.set(DataType.float, (e) => this.readFloat(e))
  }
  async iterate(dtdElement, posDone, listener) {
    return this.parseContainer(linkParents(dtdElement), posDone, listener)
  }
  async parseContainer(dtdElement, posDone, listener) {
    const tree = {}
    while (this.tokenizer.position < posDone) {
      let element
      const elementPosition = this.tokenizer.position
      try {
        element = await this.readElement()
      } catch (error) {
        if (error instanceof EndOfStreamError$1) {
          break
        }
        throw error
      }
      const child = dtdElement.container[element.id]
      if (child) {
        const action = listener.startNext(child)
        switch (action) {
          case ParseAction.ReadNext:
            {
              if (element.id === 0x1f43b675);
              debug$d(
                `Read element: name=${getElementPath(child)}{id=0x${element.id.toString(16)}, container=${!!child.container}} at position=${elementPosition}`,
              )
              if (child.container) {
                const res = await this.parseContainer(
                  child,
                  element.len >= 0 ? this.tokenizer.position + element.len : -1,
                  listener,
                )
                if (child.multiple) {
                  if (!tree[child.name]) {
                    tree[child.name] = []
                  }
                  tree[child.name].push(res)
                } else {
                  tree[child.name] = res
                }
                await listener.elementValue(child, res, elementPosition)
              } else {
                const parser = this.parserMap.get(child.value)
                if (typeof parser === "function") {
                  const value = await parser(element)
                  tree[child.name] = value
                  await listener.elementValue(child, value, elementPosition)
                }
              }
            }
            break
          case ParseAction.SkipElement:
            debug$d(
              `Go to next element: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`,
            )
            break
          case ParseAction.IgnoreElement:
            debug$d(
              `Ignore element: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`,
            )
            await this.tokenizer.ignore(element.len)
            break
          case ParseAction.SkipSiblings:
            debug$d(
              `Ignore remaining container, at: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`,
            )
            await this.tokenizer.ignore(posDone - this.tokenizer.position)
            break
          case ParseAction.TerminateParsing:
            debug$d(
              `Terminate parsing at element: name=${getElementPath(child)}, element.id=0x${element.id}, container=${!!child.container} at position=${elementPosition}`,
            )
            return tree
        }
      } else {
        switch (element.id) {
          case 0xec: // void
            this.padding += element.len
            await this.tokenizer.ignore(element.len)
            break
          default:
            debug$d(
              `parseEbml: parent=${getElementPath(dtdElement)}, unknown child: id=${element.id.toString(16)} at position=${elementPosition}`,
            )
            this.padding += element.len
            await this.tokenizer.ignore(element.len)
        }
      }
    }
    return tree
  }
  async readVintData(maxLength) {
    const msb = await this.tokenizer.peekNumber(UINT8)
    let mask = 0x80
    let oc = 1
    // Calculate VINT_WIDTH
    while ((msb & mask) === 0) {
      if (oc > maxLength) {
        throw new EbmlContentError("VINT value exceeding maximum size")
      }
      ++oc
      mask >>= 1
    }
    const id = new Uint8Array(oc)
    await this.tokenizer.readBuffer(id)
    return id
  }
  async readElement() {
    const id = await this.readVintData(this.ebmlMaxIDLength)
    const lenField = await this.readVintData(this.ebmlMaxSizeLength)
    lenField[0] ^= 0x80 >> (lenField.length - 1)
    return {
      id: readUIntBE(id, id.length),
      len: readUIntBE(lenField, lenField.length),
    }
  }
  async readFloat(e) {
    switch (e.len) {
      case 0:
        return 0.0
      case 4:
        return this.tokenizer.readNumber(Float32_BE)
      case 8:
        return this.tokenizer.readNumber(Float64_BE)
      case 10:
        return this.tokenizer.readNumber(Float64_BE)
      default:
        throw new EbmlContentError(`Invalid IEEE-754 float length: ${e.len}`)
    }
  }
  async readFlag(e) {
    return (await this.readUint(e)) === 1
  }
  async readUint(e) {
    const buf = await this.readBuffer(e)
    return readUIntBE(buf, e.len)
  }
  async readString(e) {
    const rawString = await this.tokenizer.readToken(
      new StringType(e.len, "utf-8"),
    )
    return rawString.replace(/\x00.*$/g, "")
  }
  async readBuffer(e) {
    const buf = new Uint8Array(e.len)
    await this.tokenizer.readBuffer(buf)
    return buf
  }
}
function readUIntBE(buf, len) {
  return Number(readUIntBeAsBigInt(buf, len))
}
/**
 * Reeds an unsigned integer from a big endian buffer of length `len`
 * @param buf Buffer to decode from
 * @param len Number of bytes
 * @private
 */
function readUIntBeAsBigInt(buf, len) {
  const normalizedNumber = new Uint8Array(8)
  const cleanNumber = buf.subarray(0, len)
  try {
    normalizedNumber.set(cleanNumber, 8 - len)
    return UINT64_BE.get(normalizedNumber, 0)
  } catch (error) {
    return BigInt(-1)
  }
}
function linkParents(element) {
  if (element.container) {
    Object.keys(element.container)
      .map((id) => {
        const child = element.container[id]
        child.id = Number.parseInt(id)
        return child
      })
      .forEach((child) => {
        child.parent = element
        linkParents(child)
      })
  }
  return element
}
function getElementPath(element) {
  let path = ""
  if (element.parent && element.parent.name !== "dtd") {
    path += `${getElementPath(element.parent)}/`
  }
  return path + element.name
}

const debug$c = initDebug("music-metadata:parser:matroska")
/**
 * Extensible Binary Meta Language (EBML) parser
 * https://en.wikipedia.org/wiki/Extensible_Binary_Meta_Language
 * http://matroska.sourceforge.net/technical/specs/rfc/index.html
 *
 * WEBM VP8 AUDIO FILE
 */
class MatroskaParser extends BasicParser {
  constructor() {
    super(...arguments)
    this.seekHeadOffset = 0
    /**
     * Use index to skip multiple segment/cluster elements at once.
     * Significant performance impact
     */
    this.flagUseIndexToSkipClusters = this.options.mkvUseIndex ?? false
  }
  async parse() {
    const containerSize =
      this.tokenizer.fileInfo.size ?? Number.MAX_SAFE_INTEGER
    const matroskaIterator = new EbmlIterator(this.tokenizer)
    debug$c("Initializing DTD end MatroskaIterator")
    await matroskaIterator.iterate(matroskaDtd, containerSize, {
      startNext: (element) => {
        switch (element.id) {
          // case 0x1f43b675: // cluster
          case 0x1c53bb6b: // Cueing Data
            debug$c(
              `Skip element: name=${element.name}, id=0x${element.id.toString(16)}`,
            )
            return ParseAction.IgnoreElement
          case 0x1f43b675: // cluster
            if (this.flagUseIndexToSkipClusters && this.seekHead) {
              const index = this.seekHead.seek.find(
                (index) =>
                  index.position + this.seekHeadOffset >
                  this.tokenizer.position,
              )
              if (index) {
                // Go to next index position
                const ignoreSize =
                  index.position + this.seekHeadOffset - this.tokenizer.position
                debug$c(
                  `Use index to go to next position, ignoring ${ignoreSize} bytes`,
                )
                this.tokenizer.ignore(ignoreSize)
                return ParseAction.SkipElement
              }
            }
            return ParseAction.IgnoreElement
          default:
            return ParseAction.ReadNext
        }
      },
      elementValue: async (element, value, offset) => {
        debug$c(`Received: name=${element.name}, value=${value}`)
        switch (element.id) {
          case 0x4282: // docType
            this.metadata.setFormat("container", `EBML/${value}`)
            break
          case 0x114d9b74:
            this.seekHead = value
            this.seekHeadOffset = offset
            break
          case 0x1549a966:
            {
              // Info (Segment Information)
              const info = value
              const timecodeScale = info.timecodeScale
                ? info.timecodeScale
                : 1000000
              if (typeof info.duration === "number") {
                const duration = (info.duration * timecodeScale) / 1000000000
                await this.addTag("segment:title", info.title)
                this.metadata.setFormat("duration", Number(duration))
              }
            }
            break
          case 0x1654ae6b:
            {
              // tracks
              const audioTracks = value
              if (audioTracks?.entries) {
                audioTracks.entries.forEach((entry) => {
                  const stream = {
                    codecName: entry.codecID
                      .replace("A_", "")
                      .replace("V_", ""),
                    codecSettings: entry.codecSettings,
                    flagDefault: entry.flagDefault,
                    flagLacing: entry.flagLacing,
                    flagEnabled: entry.flagEnabled,
                    language: entry.language,
                    name: entry.name,
                    type: entry.trackType,
                    audio: entry.audio,
                    video: entry.video,
                  }
                  this.metadata.addStreamInfo(stream)
                })
                const audioTrack = audioTracks.entries
                  .filter((entry) => entry.trackType === TrackType.audio)
                  .reduce((acc, cur) => {
                    if (!acc) return cur
                    if (cur.flagDefault && !acc.flagDefault) return cur
                    if (cur.trackNumber < acc.trackNumber) return cur
                    return acc
                  }, null)
                if (audioTrack) {
                  this.metadata.setFormat(
                    "codec",
                    audioTrack.codecID.replace("A_", ""),
                  )
                  this.metadata.setFormat(
                    "sampleRate",
                    audioTrack.audio.samplingFrequency,
                  )
                  this.metadata.setFormat(
                    "numberOfChannels",
                    audioTrack.audio.channels,
                  )
                }
              }
            }
            break
          case 0x1254c367:
            {
              // tags
              const tags = value
              await Promise.all(
                tags.tag.map(async (tag) => {
                  const target = tag.target
                  const targetType = target?.targetTypeValue
                    ? TargetType[target.targetTypeValue]
                    : target?.targetType
                      ? target.targetType
                      : "track"
                  await Promise.all(
                    tag.simpleTags.map(async (simpleTag) => {
                      const value = simpleTag.string
                        ? simpleTag.string
                        : simpleTag.binary
                      await this.addTag(
                        `${targetType}:${simpleTag.name}`,
                        value,
                      )
                    }),
                  )
                }),
              )
            }
            break
          case 0x1941a469:
            {
              // attachments
              const attachments = value
              await Promise.all(
                attachments.attachedFiles
                  .filter((file) => file.mimeType.startsWith("image/"))
                  .map((file) =>
                    this.addTag("picture", {
                      data: file.data,
                      format: file.mimeType,
                      description: file.description,
                      name: file.name,
                    }),
                  ),
              )
            }
            break
        }
      },
    })
  }
  async addTag(tagId, value) {
    await this.metadata.addTag("matroska", tagId, value)
  }
}

var MatroskaParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  MatroskaParser: MatroskaParser,
})

const debug$b = initDebug("music-metadata:parser:MP4:atom")
class Mp4ContentError extends makeUnexpectedFileContentError("MP4") {}
const Header$3 = {
  len: 8,
  get: (buf, off) => {
    const length = UINT32_BE.get(buf, off)
    if (length < 0) throw new Mp4ContentError("Invalid atom header length")
    return {
      length: BigInt(length),
      name: new StringType(4, "latin1").get(buf, off + 4),
    }
  },
  put: (buf, off, hdr) => {
    UINT32_BE.put(buf, off, Number(hdr.length))
    return FourCcToken.put(buf, off + 4, hdr.name)
  },
}
/**
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap1/qtff1.html#//apple_ref/doc/uid/TP40000939-CH203-38190
 */
const ExtendedSize = UINT64_BE
const ftyp = {
  len: 4,
  get: (buf, off) => {
    return {
      type: new StringType(4, "ascii").get(buf, off),
    }
  },
}
/**
 * Base class for 'fixed' length atoms.
 * In some cases these atoms are longer then the sum of the described fields.
 * Issue: https://github.com/Borewit/music-metadata/issues/120
 */
class FixedLengthAtom {
  /**
   *
   * @param {number} len Length as specified in the size field
   * @param {number} expLen Total length of sum of specified fields in the standard
   * @param atomId Atom ID
   */
  constructor(len, expLen, atomId) {
    this.len = len
    if (len < expLen) {
      throw new Mp4ContentError(
        `Atom ${atomId} expected to be ${expLen}, but specifies ${len} bytes long.`,
      )
    }
    if (len > expLen) {
      debug$b(
        `Warning: atom ${atomId} expected to be ${expLen}, but was actually ${len} bytes long.`,
      )
    }
  }
}
/**
 * Timestamp stored in seconds since Mac Epoch (1 January 1904)
 */
const SecondsSinceMacEpoch = {
  len: 4,
  get: (buf, off) => {
    const secondsSinceUnixEpoch = UINT32_BE.get(buf, off) - 2082844800
    return new Date(secondsSinceUnixEpoch * 1000)
  },
}
/**
 * Token: Media Header Atom
 * Ref:
 * - https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-SW34
 * - https://wiki.multimedia.cx/index.php/QuickTime_container#mdhd
 */
class MdhdAtom extends FixedLengthAtom {
  constructor(len) {
    super(len, 24, "mdhd")
    this.len = len
  }
  get(buf, off) {
    return {
      version: UINT8.get(buf, off + 0),
      flags: UINT24_BE.get(buf, off + 1),
      creationTime: SecondsSinceMacEpoch.get(buf, off + 4),
      modificationTime: SecondsSinceMacEpoch.get(buf, off + 8),
      timeScale: UINT32_BE.get(buf, off + 12),
      duration: UINT32_BE.get(buf, off + 16),
      language: UINT16_BE.get(buf, off + 20),
      quality: UINT16_BE.get(buf, off + 22),
    }
  }
}
/**
 * Token: Movie Header Atom
 */
class MvhdAtom extends FixedLengthAtom {
  constructor(len) {
    super(len, 100, "mvhd")
    this.len = len
  }
  get(buf, off) {
    return {
      version: UINT8.get(buf, off),
      flags: UINT24_BE.get(buf, off + 1),
      creationTime: SecondsSinceMacEpoch.get(buf, off + 4),
      modificationTime: SecondsSinceMacEpoch.get(buf, off + 8),
      timeScale: UINT32_BE.get(buf, off + 12),
      duration: UINT32_BE.get(buf, off + 16),
      preferredRate: UINT32_BE.get(buf, off + 20),
      preferredVolume: UINT16_BE.get(buf, off + 24),
      // ignore reserver: 10 bytes
      // ignore matrix structure: 36 bytes
      previewTime: UINT32_BE.get(buf, off + 72),
      previewDuration: UINT32_BE.get(buf, off + 76),
      posterTime: UINT32_BE.get(buf, off + 80),
      selectionTime: UINT32_BE.get(buf, off + 84),
      selectionDuration: UINT32_BE.get(buf, off + 88),
      currentTime: UINT32_BE.get(buf, off + 92),
      nextTrackID: UINT32_BE.get(buf, off + 96),
    }
  }
}
/**
 * Data Atom Structure
 */
class DataAtom {
  constructor(len) {
    this.len = len
  }
  get(buf, off) {
    return {
      type: {
        set: UINT8.get(buf, off + 0),
        type: UINT24_BE.get(buf, off + 1),
      },
      locale: UINT24_BE.get(buf, off + 4),
      value: new Uint8ArrayType(this.len - 8).get(buf, off + 8),
    }
  }
}
/**
 * Data Atom Structure
 * Ref: https://developer.apple.com/library/content/documentation/QuickTime/QTFF/Metadata/Metadata.html#//apple_ref/doc/uid/TP40000939-CH1-SW31
 */
class NameAtom {
  constructor(len) {
    this.len = len
  }
  get(buf, off) {
    return {
      version: UINT8.get(buf, off),
      flags: UINT24_BE.get(buf, off + 1),
      name: new StringType(this.len - 4, "utf-8").get(buf, off + 4),
    }
  }
}
/**
 * Track Header Atoms structure
 * Ref: https://developer.apple.com/library/content/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25550
 */
class TrackHeaderAtom {
  constructor(len) {
    this.len = len
  }
  get(buf, off) {
    return {
      version: UINT8.get(buf, off),
      flags: UINT24_BE.get(buf, off + 1),
      creationTime: SecondsSinceMacEpoch.get(buf, off + 4),
      modificationTime: SecondsSinceMacEpoch.get(buf, off + 8),
      trackId: UINT32_BE.get(buf, off + 12),
      // reserved 4 bytes
      duration: UINT32_BE.get(buf, off + 20),
      layer: UINT16_BE.get(buf, off + 24),
      alternateGroup: UINT16_BE.get(buf, off + 26),
      volume: UINT16_BE.get(buf, off + 28), // ToDo: fixed point
      // ToDo: add remaining fields
    }
  }
}
/**
 * Atom: Sample Description Atom ('stsd')
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25691
 */
const stsdHeader = {
  len: 8,
  get: (buf, off) => {
    return {
      version: UINT8.get(buf, off),
      flags: UINT24_BE.get(buf, off + 1),
      numberOfEntries: UINT32_BE.get(buf, off + 4),
    }
  },
}
/**
 * Atom: Sample Description Atom ('stsd')
 * Ref: https://developer.apple.com/documentation/quicktime-file-format/sample_description_atom
 */
class SampleDescriptionTable {
  constructor(len) {
    this.len = len
  }
  get(buf, off) {
    const descrLen = this.len - 12
    return {
      dataFormat: FourCcToken.get(buf, off),
      dataReferenceIndex: UINT16_BE.get(buf, off + 10),
      description:
        descrLen > 0
          ? new Uint8ArrayType(descrLen).get(buf, off + 12)
          : undefined,
    }
  }
}
/**
 * Atom: Sample-description Atom ('stsd')
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25691
 */
class StsdAtom {
  constructor(len) {
    this.len = len
  }
  get(buf, off) {
    const header = stsdHeader.get(buf, off)
    off += stsdHeader.len
    const table = []
    for (let n = 0; n < header.numberOfEntries; ++n) {
      const size = UINT32_BE.get(buf, off) // Sample description size
      off += UINT32_BE.len
      table.push(new SampleDescriptionTable(size - UINT32_BE.len).get(buf, off))
      off += size
    }
    return {
      header,
      table,
    }
  }
}
/**
 * Common Sound Sample Description (version & revision)
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap3/qtff3.html#//apple_ref/doc/uid/TP40000939-CH205-57317
 */
const SoundSampleDescriptionVersion = {
  len: 8,
  get(buf, off) {
    return {
      version: INT16_BE.get(buf, off),
      revision: INT16_BE.get(buf, off + 2),
      vendor: INT32_BE.get(buf, off + 4),
    }
  },
}
/**
 * Sound Sample Description (Version 0)
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap3/qtff3.html#//apple_ref/doc/uid/TP40000939-CH205-130736
 */
const SoundSampleDescriptionV0 = {
  len: 12,
  get(buf, off) {
    return {
      numAudioChannels: INT16_BE.get(buf, off + 0),
      sampleSize: INT16_BE.get(buf, off + 2),
      compressionId: INT16_BE.get(buf, off + 4),
      packetSize: INT16_BE.get(buf, off + 6),
      sampleRate:
        UINT16_BE.get(buf, off + 8) + UINT16_BE.get(buf, off + 10) / 10000,
    }
  },
}
class SimpleTableAtom {
  constructor(len, token) {
    this.len = len
    this.token = token
  }
  get(buf, off) {
    const nrOfEntries = INT32_BE.get(buf, off + 4)
    return {
      version: INT8.get(buf, off + 0),
      flags: INT24_BE.get(buf, off + 1),
      numberOfEntries: nrOfEntries,
      entries: readTokenTable(
        buf,
        this.token,
        off + 8,
        this.len - 8,
        nrOfEntries,
      ),
    }
  }
}
const TimeToSampleToken = {
  len: 8,
  get(buf, off) {
    return {
      count: INT32_BE.get(buf, off + 0),
      duration: INT32_BE.get(buf, off + 4),
    }
  },
}
/**
 * Time-to-sample('stts') atom.
 * Store duration information for a media’s samples.
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25696
 */
class SttsAtom extends SimpleTableAtom {
  constructor(len) {
    super(len, TimeToSampleToken)
    this.len = len
  }
}
const SampleToChunkToken = {
  len: 12,
  get(buf, off) {
    return {
      firstChunk: INT32_BE.get(buf, off),
      samplesPerChunk: INT32_BE.get(buf, off + 4),
      sampleDescriptionId: INT32_BE.get(buf, off + 8),
    }
  },
}
/**
 * Sample-to-Chunk ('stsc') atom interface
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25706
 */
class StscAtom extends SimpleTableAtom {
  constructor(len) {
    super(len, SampleToChunkToken)
    this.len = len
  }
}
/**
 * Sample-size ('stsz') atom
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25710
 */
class StszAtom {
  constructor(len) {
    this.len = len
  }
  get(buf, off) {
    const nrOfEntries = INT32_BE.get(buf, off + 8)
    return {
      version: INT8.get(buf, off),
      flags: INT24_BE.get(buf, off + 1),
      sampleSize: INT32_BE.get(buf, off + 4),
      numberOfEntries: nrOfEntries,
      entries: readTokenTable(
        buf,
        INT32_BE,
        off + 12,
        this.len - 12,
        nrOfEntries,
      ),
    }
  }
}
/**
 * Chunk offset atom, 'stco'
 * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25715
 */
class StcoAtom extends SimpleTableAtom {
  constructor(len) {
    super(len, INT32_BE)
    this.len = len
  }
}
/**
 * Token used to decode text-track from 'mdat' atom (raw data stream)
 */
class ChapterText {
  constructor(len) {
    this.len = len
  }
  get(buf, off) {
    const titleLen = INT16_BE.get(buf, off + 0)
    const str = new StringType(titleLen, "utf-8")
    return str.get(buf, off + 2)
  }
}
function readTokenTable(buf, token, off, remainingLen, numberOfEntries) {
  debug$b(
    `remainingLen=${remainingLen}, numberOfEntries=${numberOfEntries} * token-len=${token.len}`,
  )
  if (remainingLen === 0) return []
  if (remainingLen !== numberOfEntries * token.len)
    throw new Mp4ContentError(
      "mismatch number-of-entries with remaining atom-length",
    )
  const entries = []
  // parse offset-table
  for (let n = 0; n < numberOfEntries; ++n) {
    entries.push(token.get(buf, off))
    off += token.len
  }
  return entries
}

const debug$a = initDebug("music-metadata:parser:MP4:Atom")
class Atom {
  static async readAtom(tokenizer, dataHandler, parent, remaining) {
    // Parse atom header
    const offset = tokenizer.position
    debug$a(`Reading next token on offset=${offset}...`) //  buf.toString('ascii')
    const header = await tokenizer.readToken(Header$3)
    const extended = header.length === 1n
    if (extended) {
      header.length = await tokenizer.readToken(ExtendedSize)
    }
    const atomBean = new Atom(header, extended, parent)
    const payloadLength = atomBean.getPayloadLength(remaining)
    debug$a(
      `parse atom name=${atomBean.atomPath}, extended=${atomBean.extended}, offset=${offset}, len=${atomBean.header.length}`,
    ) //  buf.toString('ascii')
    await atomBean.readData(tokenizer, dataHandler, payloadLength)
    return atomBean
  }
  constructor(header, extended, parent) {
    this.header = header
    this.extended = extended
    this.parent = parent
    this.children = []
    this.atomPath =
      (this.parent ? `${this.parent.atomPath}.` : "") + this.header.name
  }
  getHeaderLength() {
    return this.extended ? 16 : 8
  }
  getPayloadLength(remaining) {
    return (
      (this.header.length === 0n ? remaining : Number(this.header.length)) -
      this.getHeaderLength()
    )
  }
  async readAtoms(tokenizer, dataHandler, size) {
    while (size > 0) {
      const atomBean = await Atom.readAtom(tokenizer, dataHandler, this, size)
      this.children.push(atomBean)
      size -=
        atomBean.header.length === 0n ? size : Number(atomBean.header.length)
    }
  }
  async readData(tokenizer, dataHandler, remaining) {
    switch (this.header.name) {
      // "Container" atoms, contains nested atoms
      case "moov": // The Movie Atom: contains other atoms
      case "udta": // User defined atom
      case "trak":
      case "mdia": // Media atom
      case "minf": // Media Information Atom
      case "stbl": // The Sample Table Atom
      case "<id>":
      case "ilst":
      case "tref":
        return this.readAtoms(
          tokenizer,
          dataHandler,
          this.getPayloadLength(remaining),
        )
      case "meta": {
        // Metadata Atom, ref: https://developer.apple.com/library/content/documentation/QuickTime/QTFF/Metadata/Metadata.html#//apple_ref/doc/uid/TP40000939-CH1-SW8
        // meta has 4 bytes of padding, ignore
        const peekHeader = await tokenizer.peekToken(Header$3)
        const paddingLength = peekHeader.name === "hdlr" ? 0 : 4
        await tokenizer.ignore(paddingLength)
        return this.readAtoms(
          tokenizer,
          dataHandler,
          this.getPayloadLength(remaining) - paddingLength,
        )
      }
      default:
        return dataHandler(this, remaining)
    }
  }
}

const debug$9 = initDebug("music-metadata:parser:MP4")
const tagFormat = "iTunes"
const encoderDict = {
  "raw": {
    lossy: false,
    format: "raw",
  },
  "MAC3": {
    lossy: true,
    format: "MACE 3:1",
  },
  "MAC6": {
    lossy: true,
    format: "MACE 6:1",
  },
  "ima4": {
    lossy: true,
    format: "IMA 4:1",
  },
  "ulaw": {
    lossy: true,
    format: "uLaw 2:1",
  },
  "alaw": {
    lossy: true,
    format: "uLaw 2:1",
  },
  "Qclp": {
    lossy: true,
    format: "QUALCOMM PureVoice",
  },
  ".mp3": {
    lossy: true,
    format: "MPEG-1 layer 3",
  },
  "alac": {
    lossy: false,
    format: "ALAC",
  },
  "ac-3": {
    lossy: true,
    format: "AC-3",
  },
  "mp4a": {
    lossy: true,
    format: "MPEG-4/AAC",
  },
  "mp4s": {
    lossy: true,
    format: "MP4S",
  },
  // Closed Captioning Media, https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap3/qtff3.html#//apple_ref/doc/uid/TP40000939-CH205-SW87
  "c608": {
    lossy: true,
    format: "CEA-608",
  },
  "c708": {
    lossy: true,
    format: "CEA-708",
  },
}
function distinct(value, index, self) {
  return self.indexOf(value) === index
}
/*
 * Parser for the MP4 (MPEG-4 Part 14) container format
 * Standard: ISO/IEC 14496-14
 * supporting:
 * - QuickTime container
 * - MP4 File Format
 * - 3GPP file format
 * - 3GPP2 file format
 *
 * MPEG-4 Audio / Part 3 (.m4a)& MPEG 4 Video (m4v, mp4) extension.
 * Support for Apple iTunes tags as found in a M4A/M4V files.
 * Ref:
 *   https://en.wikipedia.org/wiki/ISO_base_media_file_format
 *   https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/Metadata/Metadata.html
 *   http://atomicparsley.sourceforge.net/mpeg-4files.html
 *   https://github.com/sergiomb2/libmp4v2/wiki/iTunesMetadata
 *   https://wiki.multimedia.cx/index.php/QuickTime_container
 */
class MP4Parser extends BasicParser {
  constructor() {
    super(...arguments)
    this.tracks = []
    this.atomParsers = {
      /**
       * Parse movie header (mvhd) atom
       * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-56313
       */
      mvhd: async (len) => {
        const mvhd = await this.tokenizer.readToken(new MvhdAtom(len))
        this.metadata.setFormat("creationTime", mvhd.creationTime)
        this.metadata.setFormat("modificationTime", mvhd.modificationTime)
      },
      /**
       * Parse media header (mdhd) atom
       * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-25615
       */
      mdhd: async (len) => {
        const mdhd_data = await this.tokenizer.readToken(new MdhdAtom(len))
        // this.parse_mxhd(mdhd_data, this.currentTrack);
        const td = this.getTrackDescription()
        td.creationTime = mdhd_data.creationTime
        td.modificationTime = mdhd_data.modificationTime
        td.timeScale = mdhd_data.timeScale
        td.duration = mdhd_data.duration
      },
      chap: async (len) => {
        const td = this.getTrackDescription()
        const trackIds = []
        while (len >= UINT32_BE.len) {
          trackIds.push(await this.tokenizer.readNumber(UINT32_BE))
          len -= UINT32_BE.len
        }
        td.chapterList = trackIds
      },
      tkhd: async (len) => {
        const track = await this.tokenizer.readToken(new TrackHeaderAtom(len))
        this.tracks.push(track)
      },
      /**
       * Parse mdat atom.
       * Will scan for chapters
       */
      mdat: async (len) => {
        this.audioLengthInBytes = len
        this.calculateBitRate()
        if (this.options.includeChapters) {
          const trackWithChapters = this.tracks.filter(
            (track) => track.chapterList,
          )
          if (trackWithChapters.length === 1) {
            const chapterTrackIds = trackWithChapters[0].chapterList
            const chapterTracks = this.tracks.filter(
              (track) => chapterTrackIds.indexOf(track.trackId) !== -1,
            )
            if (chapterTracks.length === 1) {
              return this.parseChapterTrack(
                chapterTracks[0],
                trackWithChapters[0],
                len,
              )
            }
          }
        }
        await this.tokenizer.ignore(len)
      },
      ftyp: async (len) => {
        const types = []
        while (len > 0) {
          const ftype = await this.tokenizer.readToken(ftyp)
          len -= ftyp.len
          const value = ftype.type.replace(/\W/g, "")
          if (value.length > 0) {
            types.push(value) // unshift for backward compatibility
          }
        }
        debug$9(`ftyp: ${types.join("/")}`)
        const x = types.filter(distinct).join("/")
        this.metadata.setFormat("container", x)
      },
      /**
       * Parse sample description atom
       */
      stsd: async (len) => {
        const stsd = await this.tokenizer.readToken(new StsdAtom(len))
        const trackDescription = this.getTrackDescription()
        trackDescription.soundSampleDescription = stsd.table.map((dfEntry) =>
          this.parseSoundSampleDescription(dfEntry),
        )
      },
      /**
       * sample-to-Chunk Atoms
       */
      stsc: async (len) => {
        const stsc = await this.tokenizer.readToken(new StscAtom(len))
        this.getTrackDescription().sampleToChunkTable = stsc.entries
      },
      /**
       * time-to-sample table
       */
      stts: async (len) => {
        const stts = await this.tokenizer.readToken(new SttsAtom(len))
        this.getTrackDescription().timeToSampleTable = stts.entries
      },
      /**
       * Parse sample-sizes atom ('stsz')
       */
      stsz: async (len) => {
        const stsz = await this.tokenizer.readToken(new StszAtom(len))
        const td = this.getTrackDescription()
        td.sampleSize = stsz.sampleSize
        td.sampleSizeTable = stsz.entries
      },
      /**
       * Parse chunk-offset atom ('stco')
       */
      stco: async (len) => {
        const stco = await this.tokenizer.readToken(new StcoAtom(len))
        this.getTrackDescription().chunkOffsetTable = stco.entries // remember chunk offsets
      },
      date: async (len) => {
        const date = await this.tokenizer.readToken(
          new StringType(len, "utf-8"),
        )
        await this.addTag("date", date)
      },
    }
  }
  static read_BE_Integer(array, signed) {
    const integerType =
      (signed ? "INT" : "UINT") +
      array.length * 8 +
      (array.length > 1 ? "_BE" : "")
    const token = Token[integerType]
    if (!token) {
      throw new Mp4ContentError(
        `Token for integer type not found: "${integerType}"`,
      )
    }
    return Number(token.get(array, 0))
  }
  async parse() {
    this.tracks = []
    let remainingFileSize = this.tokenizer.fileInfo.size || 0
    while (!this.tokenizer.fileInfo.size || remainingFileSize > 0) {
      try {
        const token = await this.tokenizer.peekToken(Header$3)
        if (token.name === "\0\0\0\0") {
          const errMsg = `Error at offset=${this.tokenizer.position}: box.id=0`
          debug$9(errMsg)
          this.addWarning(errMsg)
          break
        }
      } catch (error) {
        if (error instanceof Error) {
          const errMsg = `Error at offset=${this.tokenizer.position}: ${error.message}`
          debug$9(errMsg)
          this.addWarning(errMsg)
        } else throw error
        break
      }
      const rootAtom = await Atom.readAtom(
        this.tokenizer,
        (atom, remaining) => this.handleAtom(atom, remaining),
        null,
        remainingFileSize,
      )
      remainingFileSize -=
        rootAtom.header.length === BigInt(0)
          ? remainingFileSize
          : Number(rootAtom.header.length)
    }
    // Post process metadata
    const formatList = []
    this.tracks.forEach((track) => {
      const trackFormats = []
      track.soundSampleDescription.forEach((ssd) => {
        const streamInfo = {}
        const encoderInfo = encoderDict[ssd.dataFormat]
        if (encoderInfo) {
          trackFormats.push(encoderInfo.format)
          streamInfo.codecName = encoderInfo.format
        } else {
          streamInfo.codecName = `<${ssd.dataFormat}>`
        }
        if (ssd.description) {
          const { description } = ssd
          if (description.sampleRate > 0) {
            streamInfo.type = TrackType.audio
            streamInfo.audio = {
              samplingFrequency: description.sampleRate,
              bitDepth: description.sampleSize,
              channels: description.numAudioChannels,
            }
          }
        }
        this.metadata.addStreamInfo(streamInfo)
      })
      if (trackFormats.length >= 1) {
        formatList.push(trackFormats.join("/"))
      }
    })
    if (formatList.length > 0) {
      this.metadata.setFormat("codec", formatList.filter(distinct).join("+"))
    }
    const audioTracks = this.tracks.filter((track) => {
      return (
        track.soundSampleDescription.length >= 1 &&
        track.soundSampleDescription[0].description &&
        track.soundSampleDescription[0].description.numAudioChannels > 0
      )
    })
    if (audioTracks.length >= 1) {
      const audioTrack = audioTracks[0]
      if (audioTrack.timeScale > 0) {
        const duration = audioTrack.duration / audioTrack.timeScale // calculate duration in seconds
        this.metadata.setFormat("duration", duration)
      }
      const ssd = audioTrack.soundSampleDescription[0]
      if (ssd.description) {
        this.metadata.setFormat("sampleRate", ssd.description.sampleRate)
        this.metadata.setFormat("bitsPerSample", ssd.description.sampleSize)
        this.metadata.setFormat(
          "numberOfChannels",
          ssd.description.numAudioChannels,
        )
        if (
          audioTrack.timeScale === 0 &&
          audioTrack.timeToSampleTable.length > 0
        ) {
          const totalSampleSize = audioTrack.timeToSampleTable
            .map((ttstEntry) => ttstEntry.count * ttstEntry.duration)
            .reduce((total, sampleSize) => total + sampleSize)
          const duration = totalSampleSize / ssd.description.sampleRate
          this.metadata.setFormat("duration", duration)
        }
      }
      const encoderInfo = encoderDict[ssd.dataFormat]
      if (encoderInfo) {
        this.metadata.setFormat("lossless", !encoderInfo.lossy)
      }
      this.calculateBitRate()
    }
  }
  async handleAtom(atom, remaining) {
    if (atom.parent) {
      switch (atom.parent.header.name) {
        case "ilst":
        case "<id>":
          return this.parseMetadataItemData(atom)
      }
    }
    // const payloadLength = atom.getPayloadLength(remaining);
    if (this.atomParsers[atom.header.name]) {
      return this.atomParsers[atom.header.name](remaining)
    }
    debug$9(
      `No parser for atom path=${atom.atomPath}, payload-len=${remaining}, ignoring atom`,
    )
    await this.tokenizer.ignore(remaining)
  }
  getTrackDescription() {
    return this.tracks[this.tracks.length - 1]
  }
  calculateBitRate() {
    if (this.audioLengthInBytes && this.metadata.format.duration) {
      this.metadata.setFormat(
        "bitrate",
        (8 * this.audioLengthInBytes) / this.metadata.format.duration,
      )
    }
  }
  async addTag(id, value) {
    await this.metadata.addTag(tagFormat, id, value)
  }
  addWarning(message) {
    debug$9(`Warning: ${message}`)
    this.metadata.addWarning(message)
  }
  /**
   * Parse data of Meta-item-list-atom (item of 'ilst' atom)
   * @param metaAtom
   * Ref: https://developer.apple.com/library/content/documentation/QuickTime/QTFF/Metadata/Metadata.html#//apple_ref/doc/uid/TP40000939-CH1-SW8
   */
  parseMetadataItemData(metaAtom) {
    let tagKey = metaAtom.header.name
    return metaAtom.readAtoms(
      this.tokenizer,
      async (child, remaining) => {
        const payLoadLength = child.getPayloadLength(remaining)
        switch (child.header.name) {
          case "data": // value atom
            return this.parseValueAtom(tagKey, child)
          case "name": // name atom (optional)
          case "mean":
          case "rate": {
            const name = await this.tokenizer.readToken(
              new NameAtom(payLoadLength),
            )
            tagKey += `:${name.name}`
            break
          }
          default: {
            const uint8Array = await this.tokenizer.readToken(
              new Uint8ArrayType(payLoadLength),
            )
            this.addWarning(
              `Unsupported meta-item: ${tagKey}[${child.header.name}] => value=${uint8ArrayToHex(uint8Array)} ascii=${uint8ArrayToString(uint8Array, "ascii")}`,
            )
          }
        }
      },
      metaAtom.getPayloadLength(0),
    )
  }
  async parseValueAtom(tagKey, metaAtom) {
    const dataAtom = await this.tokenizer.readToken(
      new DataAtom(Number(metaAtom.header.length) - Header$3.len),
    )
    if (dataAtom.type.set !== 0) {
      throw new Mp4ContentError(
        `Unsupported type-set != 0: ${dataAtom.type.set}`,
      )
    }
    // Use well-known-type table
    // Ref: https://developer.apple.com/library/content/documentation/QuickTime/QTFF/Metadata/Metadata.html#//apple_ref/doc/uid/TP40000939-CH1-SW35
    switch (dataAtom.type.type) {
      case 0: // reserved: Reserved for use where no type needs to be indicated
        switch (tagKey) {
          case "trkn":
          case "disk": {
            const num = UINT8.get(dataAtom.value, 3)
            const of = UINT8.get(dataAtom.value, 5)
            // console.log("  %s[data] = %s/%s", tagKey, num, of);
            await this.addTag(tagKey, `${num}/${of}`)
            break
          }
          case "gnre": {
            const genreInt = UINT8.get(dataAtom.value, 1)
            const genreStr = Genres[genreInt - 1]
            // console.log("  %s[data] = %s", tagKey, genreStr);
            await this.addTag(tagKey, genreStr)
            break
          }
          case "rate": {
            const rate = new TextDecoder("ascii").decode(dataAtom.value)
            await this.addTag(tagKey, rate)
            break
          }
          default:
            debug$9(`unknown proprietary value type for: ${metaAtom.atomPath}`)
        }
        break
      case 1: // UTF-8: Without any count or NULL terminator
      case 18: // Unknown: Found in m4b in combination with a '©gen' tag
        await this.addTag(
          tagKey,
          new TextDecoder("utf-8").decode(dataAtom.value),
        )
        break
      case 13: // JPEG
        if (this.options.skipCovers) break
        await this.addTag(tagKey, {
          format: "image/jpeg",
          data: Uint8Array.from(dataAtom.value),
        })
        break
      case 14: // PNG
        if (this.options.skipCovers) break
        await this.addTag(tagKey, {
          format: "image/png",
          data: Uint8Array.from(dataAtom.value),
        })
        break
      case 21: // BE Signed Integer
        await this.addTag(
          tagKey,
          MP4Parser.read_BE_Integer(dataAtom.value, true),
        )
        break
      case 22: // BE Unsigned Integer
        await this.addTag(
          tagKey,
          MP4Parser.read_BE_Integer(dataAtom.value, false),
        )
        break
      case 65: // An 8-bit signed integer
        await this.addTag(tagKey, UINT8.get(dataAtom.value, 0))
        break
      case 66: // A big-endian 16-bit signed integer
        await this.addTag(tagKey, UINT16_BE.get(dataAtom.value, 0))
        break
      case 67: // A big-endian 32-bit signed integer
        await this.addTag(tagKey, UINT32_BE.get(dataAtom.value, 0))
        break
      default:
        this.addWarning(
          `atom key=${tagKey}, has unknown well-known-type (data-type): ${dataAtom.type.type}`,
        )
    }
  }
  /**
   * @param sampleDescription
   * Ref: https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap3/qtff3.html#//apple_ref/doc/uid/TP40000939-CH205-128916
   */
  parseSoundSampleDescription(sampleDescription) {
    const ssd = {
      dataFormat: sampleDescription.dataFormat,
      dataReferenceIndex: sampleDescription.dataReferenceIndex,
    }
    let offset = 0
    if (sampleDescription.description) {
      const version = SoundSampleDescriptionVersion.get(
        sampleDescription.description,
        offset,
      )
      offset += SoundSampleDescriptionVersion.len
      if (version.version === 0 || version.version === 1) {
        // Sound Sample Description (Version 0)
        ssd.description = SoundSampleDescriptionV0.get(
          sampleDescription.description,
          offset,
        )
      } else {
        debug$9(`Warning: sound-sample-description ${version} not implemented`)
      }
    }
    return ssd
  }
  async parseChapterTrack(chapterTrack, track, len) {
    if (!chapterTrack.sampleSize) {
      if (
        chapterTrack.chunkOffsetTable.length !==
        chapterTrack.sampleSizeTable.length
      )
        throw new Error(
          "Expected equal chunk-offset-table & sample-size-table length.",
        )
    }
    const chapters = []
    for (let i = 0; i < chapterTrack.chunkOffsetTable.length && len > 0; ++i) {
      const chunkOffset = chapterTrack.chunkOffsetTable[i]
      const nextChunkLen = chunkOffset - this.tokenizer.position
      const sampleSize =
        chapterTrack.sampleSize > 0
          ? chapterTrack.sampleSize
          : chapterTrack.sampleSizeTable[i]
      len -= nextChunkLen + sampleSize
      if (len < 0)
        throw new Mp4ContentError("Chapter chunk exceeding token length")
      await this.tokenizer.ignore(nextChunkLen)
      const title = await this.tokenizer.readToken(new ChapterText(sampleSize))
      debug$9(`Chapter ${i + 1}: ${title}`)
      const chapter = {
        title,
        sampleOffset: this.findSampleOffset(track, this.tokenizer.position),
      }
      debug$9(
        `Chapter title=${chapter.title}, offset=${chapter.sampleOffset}/${this.tracks[0].duration}`,
      )
      chapters.push(chapter)
    }
    this.metadata.setFormat("chapters", chapters)
    await this.tokenizer.ignore(len)
  }
  findSampleOffset(track, chapterOffset) {
    let totalDuration = 0
    track.timeToSampleTable.forEach((e) => {
      totalDuration += e.count * e.duration
    })
    debug$9(`Total duration=${totalDuration}`)
    let chunkIndex = 0
    while (
      chunkIndex < track.chunkOffsetTable.length &&
      track.chunkOffsetTable[chunkIndex] < chapterOffset
    ) {
      ++chunkIndex
    }
    return this.getChunkDuration(chunkIndex + 1, track)
  }
  getChunkDuration(chunkId, track) {
    let ttsi = 0
    let ttsc = track.timeToSampleTable[ttsi].count
    let ttsd = track.timeToSampleTable[ttsi].duration
    let curChunkId = 1
    let samplesPerChunk = this.getSamplesPerChunk(
      curChunkId,
      track.sampleToChunkTable,
    )
    let totalDuration = 0
    while (curChunkId < chunkId) {
      const nrOfSamples = Math.min(ttsc, samplesPerChunk)
      totalDuration += nrOfSamples * ttsd
      ttsc -= nrOfSamples
      samplesPerChunk -= nrOfSamples
      if (samplesPerChunk === 0) {
        ++curChunkId
        samplesPerChunk = this.getSamplesPerChunk(
          curChunkId,
          track.sampleToChunkTable,
        )
      } else {
        ++ttsi
        ttsc = track.timeToSampleTable[ttsi].count
        ttsd = track.timeToSampleTable[ttsi].duration
      }
    }
    return totalDuration
  }
  getSamplesPerChunk(chunkId, stcTable) {
    for (let i = 0; i < stcTable.length - 1; ++i) {
      if (
        chunkId >= stcTable[i].firstChunk &&
        chunkId < stcTable[i + 1].firstChunk
      ) {
        return stcTable[i].samplesPerChunk
      }
    }
    return stcTable[stcTable.length - 1].samplesPerChunk
  }
}

var MP4Parser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  MP4Parser: MP4Parser,
})

const debug$8 = initDebug("music-metadata:parser:musepack:sv8")
const PacketKey = new StringType(2, "latin1")
/**
 * Stream Header Packet part 1
 * Ref: http://trac.musepack.net/musepack/wiki/SV8Specification#StreamHeaderPacket
 */
const SH_part1 = {
  len: 5,
  get: (buf, off) => {
    return {
      crc: UINT32_LE.get(buf, off),
      streamVersion: UINT8.get(buf, off + 4),
    }
  },
}
/**
 * Stream Header Packet part 3
 * Ref: http://trac.musepack.net/musepack/wiki/SV8Specification#StreamHeaderPacket
 */
const SH_part3 = {
  len: 2,
  get: (buf, off) => {
    return {
      sampleFrequency: [44100, 48000, 37800, 32000][
        getBitAllignedNumber$1(buf, off, 0, 3)
      ],
      maxUsedBands: getBitAllignedNumber$1(buf, off, 3, 5),
      channelCount: getBitAllignedNumber$1(buf, off + 1, 0, 4) + 1,
      msUsed: isBitSet$2(buf, off + 1, 4),
      audioBlockFrames: getBitAllignedNumber$1(buf, off + 1, 5, 3),
    }
  },
}
class StreamReader {
  constructor(tokenizer) {
    this.tokenizer = tokenizer
  }
  async readPacketHeader() {
    const key = await this.tokenizer.readToken(PacketKey)
    const size = await this.readVariableSizeField()
    return {
      key,
      payloadLength: size.value - 2 - size.len,
    }
  }
  async readStreamHeader(size) {
    const streamHeader = {}
    debug$8(`Reading SH at offset=${this.tokenizer.position}`)
    const part1 = await this.tokenizer.readToken(SH_part1)
    size -= SH_part1.len
    Object.assign(streamHeader, part1)
    debug$8(`SH.streamVersion = ${part1.streamVersion}`)
    const sampleCount = await this.readVariableSizeField()
    size -= sampleCount.len
    streamHeader.sampleCount = sampleCount.value
    const bs = await this.readVariableSizeField()
    size -= bs.len
    streamHeader.beginningOfSilence = bs.value
    const part3 = await this.tokenizer.readToken(SH_part3)
    size -= SH_part3.len
    Object.assign(streamHeader, part3)
    // assert.equal(size, 0);
    await this.tokenizer.ignore(size)
    return streamHeader
  }
  async readVariableSizeField(len = 1, hb = 0) {
    let n = await this.tokenizer.readNumber(UINT8)
    if ((n & 0x80) === 0) {
      return { len, value: hb + n }
    }
    n &= 0x7f
    n += hb
    return this.readVariableSizeField(len + 1, n << 7)
  }
}

class MusepackContentError extends makeUnexpectedFileContentError("Musepack") {}

const debug$7 = initDebug("music-metadata:parser:musepack")
class MpcSv8Parser extends BasicParser {
  constructor() {
    super(...arguments)
    this.audioLength = 0
  }
  async parse() {
    const signature = await this.tokenizer.readToken(FourCcToken)
    if (signature !== "MPCK")
      throw new MusepackContentError("Invalid Magic number")
    this.metadata.setFormat("container", "Musepack, SV8")
    return this.parsePacket()
  }
  async parsePacket() {
    const sv8reader = new StreamReader(this.tokenizer)
    do {
      const header = await sv8reader.readPacketHeader()
      debug$7(
        `packet-header key=${header.key}, payloadLength=${header.payloadLength}`,
      )
      switch (header.key) {
        case "SH": {
          // Stream Header
          const sh = await sv8reader.readStreamHeader(header.payloadLength)
          this.metadata.setFormat("numberOfSamples", sh.sampleCount)
          this.metadata.setFormat("sampleRate", sh.sampleFrequency)
          this.metadata.setFormat(
            "duration",
            sh.sampleCount / sh.sampleFrequency,
          )
          this.metadata.setFormat("numberOfChannels", sh.channelCount)
          break
        }
        case "AP": // Audio Packet
          this.audioLength += header.payloadLength
          await this.tokenizer.ignore(header.payloadLength)
          break
        case "RG": // Replaygain
        case "EI": // Encoder Info
        case "SO": // Seek Table Offset
        case "ST": // Seek Table
        case "CT": // Chapter-Tag
          await this.tokenizer.ignore(header.payloadLength)
          break
        case "SE": // Stream End
          if (this.metadata.format.duration) {
            this.metadata.setFormat(
              "bitrate",
              (this.audioLength * 8) / this.metadata.format.duration,
            )
          }
          return APEv2Parser.tryParseApeHeader(
            this.metadata,
            this.tokenizer,
            this.options,
          )
        default:
          throw new MusepackContentError(`Unexpected header: ${header.key}`)
      }
    } while (true)
  }
}

class BitReader {
  constructor(tokenizer) {
    this.tokenizer = tokenizer
    this.pos = 0
    this.dword = null
  }
  /**
   *
   * @param bits 1..30 bits
   */
  async read(bits) {
    while (this.dword === null) {
      this.dword = await this.tokenizer.readToken(UINT32_LE)
    }
    let out = this.dword
    this.pos += bits
    if (this.pos < 32) {
      out >>>= 32 - this.pos
      return out & ((1 << bits) - 1)
    }
    this.pos -= 32
    if (this.pos === 0) {
      this.dword = null
      return out & ((1 << bits) - 1)
    }
    this.dword = await this.tokenizer.readToken(UINT32_LE)
    if (this.pos) {
      out <<= this.pos
      out |= this.dword >>> (32 - this.pos)
    }
    return out & ((1 << bits) - 1)
  }
  async ignore(bits) {
    if (this.pos > 0) {
      const remaining = 32 - this.pos
      this.dword = null
      bits -= remaining
      this.pos = 0
    }
    const remainder = bits % 32
    const numOfWords = (bits - remainder) / 32
    await this.tokenizer.ignore(numOfWords * 4)
    return this.read(remainder)
  }
}

/**
 * BASIC STRUCTURE
 */
const Header$2 = {
  len: 6 * 4,
  get: (buf, off) => {
    const header = {
      // word 0
      signature: new TextDecoder("latin1").decode(buf.subarray(off, off + 3)),
      // versionIndex number * 1000 (3.81 = 3810) (remember that 4-byte alignment causes this to take 4-bytes)
      streamMinorVersion: getBitAllignedNumber$1(buf, off + 3, 0, 4),
      streamMajorVersion: getBitAllignedNumber$1(buf, off + 3, 4, 4),
      // word 1
      frameCount: UINT32_LE.get(buf, off + 4),
      // word 2
      maxLevel: UINT16_LE.get(buf, off + 8),
      sampleFrequency: [44100, 48000, 37800, 32000][
        getBitAllignedNumber$1(buf, off + 10, 0, 2)
      ],
      link: getBitAllignedNumber$1(buf, off + 10, 2, 2),
      profile: getBitAllignedNumber$1(buf, off + 10, 4, 4),
      maxBand: getBitAllignedNumber$1(buf, off + 11, 0, 6),
      intensityStereo: isBitSet$2(buf, off + 11, 6),
      midSideStereo: isBitSet$2(buf, off + 11, 7),
      // word 3
      titlePeak: UINT16_LE.get(buf, off + 12),
      titleGain: UINT16_LE.get(buf, off + 14),
      // word 4
      albumPeak: UINT16_LE.get(buf, off + 16),
      albumGain: UINT16_LE.get(buf, off + 18),
      // word
      lastFrameLength: (UINT32_LE.get(buf, off + 20) >>> 20) & 0x7ff,
      trueGapless: isBitSet$2(buf, off + 23, 0),
    }
    header.lastFrameLength = header.trueGapless
      ? (UINT32_LE.get(buf, 20) >>> 20) & 0x7ff
      : 0
    return header
  },
}

const debug$6 = initDebug("music-metadata:parser:musepack")
class MpcSv7Parser extends BasicParser {
  constructor() {
    super(...arguments)
    this.bitreader = null
    this.audioLength = 0
    this.duration = null
  }
  async parse() {
    const header = await this.tokenizer.readToken(Header$2)
    if (header.signature !== "MP+")
      throw new MusepackContentError("Unexpected magic number")
    debug$6(
      `stream-version=${header.streamMajorVersion}.${header.streamMinorVersion}`,
    )
    this.metadata.setFormat("container", "Musepack, SV7")
    this.metadata.setFormat("sampleRate", header.sampleFrequency)
    const numberOfSamples =
      1152 * (header.frameCount - 1) + header.lastFrameLength
    this.metadata.setFormat("numberOfSamples", numberOfSamples)
    this.duration = numberOfSamples / header.sampleFrequency
    this.metadata.setFormat("duration", this.duration)
    this.bitreader = new BitReader(this.tokenizer)
    this.metadata.setFormat(
      "numberOfChannels",
      header.midSideStereo || header.intensityStereo ? 2 : 1,
    )
    const version = await this.bitreader.read(8)
    this.metadata.setFormat("codec", (version / 100).toFixed(2))
    await this.skipAudioData(header.frameCount)
    debug$6(
      `End of audio stream, switching to APEv2, offset=${this.tokenizer.position}`,
    )
    return APEv2Parser.tryParseApeHeader(
      this.metadata,
      this.tokenizer,
      this.options,
    )
  }
  async skipAudioData(frameCount) {
    while (frameCount-- > 0) {
      const frameLength = await this.bitreader.read(20)
      this.audioLength += 20 + frameLength
      await this.bitreader.ignore(frameLength)
    }
    // last frame
    const lastFrameLength = await this.bitreader.read(11)
    this.audioLength += lastFrameLength
    if (this.duration !== null) {
      this.metadata.setFormat("bitrate", this.audioLength / this.duration)
    }
  }
}

const debug$5 = initDebug("music-metadata:parser:musepack")
class MusepackParser extends AbstractID3Parser {
  async postId3v2Parse() {
    const signature = await this.tokenizer.peekToken(
      new StringType(3, "latin1"),
    )
    let mpcParser
    switch (signature) {
      case "MP+": {
        debug$5("Stream-version 7")
        mpcParser = new MpcSv7Parser(
          this.metadata,
          this.tokenizer,
          this.options,
        )
        break
      }
      case "MPC": {
        debug$5("Stream-version 8")
        mpcParser = new MpcSv8Parser(
          this.metadata,
          this.tokenizer,
          this.options,
        )
        break
      }
      default: {
        throw new MusepackContentError("Invalid signature prefix")
      }
    }
    return mpcParser.parse()
  }
}

var MusepackParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  MusepackParser: MusepackParser,
})

class OpusContentError extends makeUnexpectedFileContentError("Opus") {}
/**
 * Opus ID Header parser
 * Ref: https://wiki.xiph.org/OggOpus#ID_Header
 */
class IdHeader {
  constructor(len) {
    this.len = len
    if (len < 19) {
      throw new OpusContentError(
        "ID-header-page 0 should be at least 19 bytes long",
      )
    }
  }
  get(buf, off) {
    return {
      magicSignature: new StringType(8, "ascii").get(buf, off + 0),
      version: UINT8.get(buf, off + 8),
      channelCount: UINT8.get(buf, off + 9),
      preSkip: UINT16_LE.get(buf, off + 10),
      inputSampleRate: UINT32_LE.get(buf, off + 12),
      outputGain: UINT16_LE.get(buf, off + 16),
      channelMapping: UINT8.get(buf, off + 18),
    }
  }
}

/**
 * Opus parser
 * Internet Engineering Task Force (IETF) - RFC 6716
 * Used by OggParser
 */
class OpusParser extends VorbisParser {
  constructor(metadata, options, tokenizer) {
    super(metadata, options)
    this.tokenizer = tokenizer
    this.idHeader = null
    this.lastPos = -1
  }
  /**
   * Parse first Opus Ogg page
   * @param {IPageHeader} header
   * @param {Uint8Array} pageData
   */
  parseFirstPage(header, pageData) {
    this.metadata.setFormat("codec", "Opus")
    // Parse Opus ID Header
    this.idHeader = new IdHeader(pageData.length).get(pageData, 0)
    if (this.idHeader.magicSignature !== "OpusHead")
      throw new OpusContentError("Illegal ogg/Opus magic-signature")
    this.metadata.setFormat("sampleRate", this.idHeader.inputSampleRate)
    this.metadata.setFormat("numberOfChannels", this.idHeader.channelCount)
  }
  async parseFullPage(pageData) {
    const magicSignature = new StringType(8, "ascii").get(pageData, 0)
    switch (magicSignature) {
      case "OpusTags":
        await this.parseUserCommentList(pageData, 8)
        this.lastPos = this.tokenizer.position - pageData.length
        break
    }
  }
  calculateDuration(header) {
    if (
      this.metadata.format.sampleRate &&
      header.absoluteGranulePosition >= 0
    ) {
      // Calculate duration
      const pos_48bit = header.absoluteGranulePosition - this.idHeader.preSkip
      this.metadata.setFormat("numberOfSamples", pos_48bit)
      this.metadata.setFormat("duration", pos_48bit / 48000)
      if (
        this.lastPos !== -1 &&
        this.tokenizer.fileInfo.size &&
        this.metadata.format.duration
      ) {
        const dataSize = this.tokenizer.fileInfo.size - this.lastPos
        this.metadata.setFormat(
          "bitrate",
          (8 * dataSize) / this.metadata.format.duration,
        )
      }
    }
  }
}

/**
 * Speex Header Packet
 * Ref: https://www.speex.org/docs/manual/speex-manual/node8.html#SECTION00830000000000000000
 */
const Header$1 = {
  len: 80,
  get: (buf, off) => {
    return {
      speex: new StringType(8, "ascii").get(buf, off + 0),
      version: trimRightNull(new StringType(20, "ascii").get(buf, off + 8)),
      version_id: INT32_LE.get(buf, off + 28),
      header_size: INT32_LE.get(buf, off + 32),
      rate: INT32_LE.get(buf, off + 36),
      mode: INT32_LE.get(buf, off + 40),
      mode_bitstream_version: INT32_LE.get(buf, off + 44),
      nb_channels: INT32_LE.get(buf, off + 48),
      bitrate: INT32_LE.get(buf, off + 52),
      frame_size: INT32_LE.get(buf, off + 56),
      vbr: INT32_LE.get(buf, off + 60),
      frames_per_packet: INT32_LE.get(buf, off + 64),
      extra_headers: INT32_LE.get(buf, off + 68),
      reserved1: INT32_LE.get(buf, off + 72),
      reserved2: INT32_LE.get(buf, off + 76),
    }
  },
}

const debug$4 = initDebug("music-metadata:parser:ogg:speex")
/**
 * Speex, RFC 5574
 * Ref:
 * - https://www.speex.org/docs/manual/speex-manual/
 * - https://tools.ietf.org/html/rfc5574
 */
class SpeexParser extends VorbisParser {
  constructor(metadata, options, tokenizer) {
    super(metadata, options)
    this.tokenizer = tokenizer
  }
  /**
   * Parse first Speex Ogg page
   * @param {IPageHeader} header
   * @param {Uint8Array} pageData
   */
  parseFirstPage(header, pageData) {
    debug$4("First Ogg/Speex page")
    const speexHeader = Header$1.get(pageData, 0)
    this.metadata.setFormat("codec", `Speex ${speexHeader.version}`)
    this.metadata.setFormat("numberOfChannels", speexHeader.nb_channels)
    this.metadata.setFormat("sampleRate", speexHeader.rate)
    if (speexHeader.bitrate !== -1) {
      this.metadata.setFormat("bitrate", speexHeader.bitrate)
    }
  }
}

/**
 * 6.2 Identification Header
 * Ref: https://theora.org/doc/Theora.pdf: 6.2 Identification Header Decode
 */
const IdentificationHeader = {
  len: 42,
  get: (buf, off) => {
    return {
      id: new StringType(7, "ascii").get(buf, off),
      vmaj: UINT8.get(buf, off + 7),
      vmin: UINT8.get(buf, off + 8),
      vrev: UINT8.get(buf, off + 9),
      vmbw: UINT16_BE.get(buf, off + 10),
      vmbh: UINT16_BE.get(buf, off + 17),
      nombr: UINT24_BE.get(buf, off + 37),
      nqual: UINT8.get(buf, off + 40),
    }
  },
}

const debug$3 = initDebug("music-metadata:parser:ogg:theora")
/**
 * Ref:
 * - https://theora.org/doc/Theora.pdf
 */
class TheoraParser {
  constructor(metadata, options, tokenizer) {
    this.metadata = metadata
    this.tokenizer = tokenizer
  }
  /**
   * Vorbis 1 parser
   * @param header Ogg Page Header
   * @param pageData Page data
   */
  async parsePage(header, pageData) {
    if (header.headerType.firstPage) {
      await this.parseFirstPage(header, pageData)
    }
  }
  async flush() {
    debug$3("flush")
  }
  calculateDuration(header) {
    debug$3("duration calculation not implemented")
  }
  /**
   * Parse first Theora Ogg page. the initial identification header packet
   * @param {IPageHeader} header
   * @param {Buffer} pageData
   */
  async parseFirstPage(header, pageData) {
    debug$3("First Ogg/Theora page")
    this.metadata.setFormat("codec", "Theora")
    const idHeader = IdentificationHeader.get(pageData, 0)
    this.metadata.setFormat("bitrate", idHeader.nombr)
  }
}

class OggContentError extends makeUnexpectedFileContentError("Ogg") {}
const debug$2 = initDebug("music-metadata:parser:ogg")
class SegmentTable {
  static sum(buf, off, len) {
    const dv = new DataView(buf.buffer, 0)
    let s = 0
    for (let i = off; i < off + len; ++i) {
      s += dv.getUint8(i)
    }
    return s
  }
  constructor(header) {
    this.len = header.page_segments
  }
  get(buf, off) {
    return {
      totalPageSize: SegmentTable.sum(buf, off, this.len),
    }
  }
}
/**
 * Parser for Ogg logical bitstream framing
 */
class OggParser extends BasicParser {
  constructor() {
    super(...arguments)
    this.header = null
    this.pageNumber = 0
    this.pageConsumer = null
  }
  /**
   * Parse page
   * @returns {Promise<void>}
   */
  async parse() {
    debug$2("pos=%s, parsePage()", this.tokenizer.position)
    try {
      let header
      do {
        header = await this.tokenizer.readToken(OggParser.Header)
        if (header.capturePattern !== "OggS")
          throw new OggContentError("Invalid Ogg capture pattern")
        this.metadata.setFormat("container", "Ogg")
        this.header = header
        this.pageNumber = header.pageSequenceNo
        debug$2(
          "page#=%s, Ogg.id=%s",
          header.pageSequenceNo,
          header.capturePattern,
        )
        const segmentTable = await this.tokenizer.readToken(
          new SegmentTable(header),
        )
        debug$2("totalPageSize=%s", segmentTable.totalPageSize)
        const pageData = await this.tokenizer.readToken(
          new Uint8ArrayType(segmentTable.totalPageSize),
        )
        debug$2(
          "firstPage=%s, lastPage=%s, continued=%s",
          header.headerType.firstPage,
          header.headerType.lastPage,
          header.headerType.continued,
        )
        if (header.headerType.firstPage) {
          const id = new TextDecoder("ascii").decode(pageData.subarray(0, 7))
          switch (id) {
            case "\x01vorbis": // Ogg/Vorbis
              debug$2("Set page consumer to Ogg/Vorbis")
              this.pageConsumer = new VorbisParser(this.metadata, this.options)
              break
            case "OpusHea": // Ogg/Opus
              debug$2("Set page consumer to Ogg/Opus")
              this.pageConsumer = new OpusParser(
                this.metadata,
                this.options,
                this.tokenizer,
              )
              break
            case "Speex  ": // Ogg/Speex
              debug$2("Set page consumer to Ogg/Speex")
              this.pageConsumer = new SpeexParser(
                this.metadata,
                this.options,
                this.tokenizer,
              )
              break
            case "fishead":
            case "\x00theora": // Ogg/Theora
              debug$2("Set page consumer to Ogg/Theora")
              this.pageConsumer = new TheoraParser(
                this.metadata,
                this.options,
                this.tokenizer,
              )
              break
            default:
              throw new OggContentError(
                `gg audio-codec not recognized (id=${id})`,
              )
          }
        }
        await this.pageConsumer.parsePage(header, pageData)
      } while (!header.headerType.lastPage)
    } catch (err) {
      if (err instanceof Error) {
        if (err instanceof EndOfStreamError$1) {
          this.metadata.addWarning(
            "Last OGG-page is not marked with last-page flag",
          )
          debug$2("End-of-stream")
          this.metadata.addWarning(
            "Last OGG-page is not marked with last-page flag",
          )
          if (this.header) {
            this.pageConsumer.calculateDuration(this.header)
          }
        } else if (err.message.startsWith("FourCC")) {
          if (this.pageNumber > 0) {
            // ignore this error: work-around if last OGG-page is not marked with last-page flag
            this.metadata.addWarning(
              "Invalid FourCC ID, maybe last OGG-page is not marked with last-page flag",
            )
            await this.pageConsumer.flush()
          }
        }
      } else throw err
    }
  }
}
OggParser.Header = {
  len: 27,
  get: (buf, off) => {
    return {
      capturePattern: FourCcToken.get(buf, off),
      version: UINT8.get(buf, off + 4),
      headerType: {
        continued: getBit(buf, off + 5, 0),
        firstPage: getBit(buf, off + 5, 1),
        lastPage: getBit(buf, off + 5, 2),
      },
      // packet_flag: Token.UINT8.get(buf, off + 5),
      absoluteGranulePosition: Number(UINT64_LE.get(buf, off + 6)),
      streamSerialNumber: UINT32_LE.get(buf, off + 14),
      pageSequenceNo: UINT32_LE.get(buf, off + 18),
      pageChecksum: UINT32_LE.get(buf, off + 22),
      page_segments: UINT8.get(buf, off + 26),
    }
  },
}

var OggParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  OggContentError: OggContentError,
  OggParser: OggParser,
  SegmentTable: SegmentTable,
})

const SampleRates = [
  6000, 8000, 9600, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
  64000, 88200, 96000, 192000, -1,
]
/**
 * WavPack Block Header
 *
 * 32-byte little-endian header at the front of every WavPack block
 *
 * Ref: http://www.wavpack.com/WavPack5FileFormat.pdf (page 2/6: 2.0 "Block Header")
 */
const BlockHeaderToken = {
  len: 32,
  get: (buf, off) => {
    const flags = UINT32_LE.get(buf, off + 24)
    const res = {
      // should equal 'wvpk'
      BlockID: FourCcToken.get(buf, off),
      //  0x402 to 0x410 are valid for decode
      blockSize: UINT32_LE.get(buf, off + 4),
      //  0x402 (1026) to 0x410 are valid for decode
      version: UINT16_LE.get(buf, off + 8),
      //  40-bit total samples for entire file (if block_index == 0 and a value of -1 indicates an unknown length)
      totalSamples:
        /* replace with bigint? (Token.UINT8.get(buf, off + 11) << 32) + */ UINT32_LE.get(
          buf,
          off + 12,
        ),
      // 40-bit block_index
      blockIndex:
        /* replace with bigint? (Token.UINT8.get(buf, off + 10) << 32) + */ UINT32_LE.get(
          buf,
          off + 16,
        ),
      // 40-bit total samples for entire file (if block_index == 0 and a value of -1 indicates an unknown length)
      blockSamples: UINT32_LE.get(buf, off + 20),
      // various flags for id and decoding
      flags: {
        bitsPerSample: (1 + getBitAllignedNumber(flags, 0, 2)) * 8,
        isMono: isBitSet(flags, 2),
        isHybrid: isBitSet(flags, 3),
        isJointStereo: isBitSet(flags, 4),
        crossChannel: isBitSet(flags, 5),
        hybridNoiseShaping: isBitSet(flags, 6),
        floatingPoint: isBitSet(flags, 7),
        samplingRate: SampleRates[getBitAllignedNumber(flags, 23, 4)],
        isDSD: isBitSet(flags, 31),
      },
      // crc for actual decoded data
      crc: new Uint8ArrayType(4).get(buf, off + 28),
    }
    if (res.flags.isDSD) {
      res.totalSamples *= 8
    }
    return res
  },
}
/**
 * 3.0 Metadata Sub-Blocks
 * Ref: http://www.wavpack.com/WavPack5FileFormat.pdf (page 4/6: 3.0 "Metadata Sub-Block")
 */
const MetadataIdToken = {
  len: 1,
  get: (buf, off) => {
    return {
      functionId: getBitAllignedNumber(buf[off], 0, 6), // functionId overlaps with isOptional flag
      isOptional: isBitSet(buf[off], 5),
      isOddSize: isBitSet(buf[off], 6),
      largeBlock: isBitSet(buf[off], 7),
    }
  },
}
function isBitSet(flags, bitOffset) {
  return getBitAllignedNumber(flags, bitOffset, 1) === 1
}
function getBitAllignedNumber(flags, bitOffset, len) {
  return (flags >>> bitOffset) & (0xffffffff >>> (32 - len))
}

const debug$1 = initDebug("music-metadata:parser:WavPack")
class WavPackContentError extends makeUnexpectedFileContentError("WavPack") {}
/**
 * WavPack Parser
 */
class WavPackParser extends BasicParser {
  constructor() {
    super(...arguments)
    this.audioDataSize = 0
  }
  async parse() {
    this.audioDataSize = 0
    // First parse all WavPack blocks
    await this.parseWavPackBlocks()
    // try to parse APEv2 header
    return APEv2Parser.tryParseApeHeader(
      this.metadata,
      this.tokenizer,
      this.options,
    )
  }
  async parseWavPackBlocks() {
    do {
      const blockId = await this.tokenizer.peekToken(FourCcToken)
      if (blockId !== "wvpk") break
      const header = await this.tokenizer.readToken(BlockHeaderToken)
      if (header.BlockID !== "wvpk")
        throw new WavPackContentError("Invalid WavPack Block-ID")
      debug$1(
        `WavPack header blockIndex=${header.blockIndex}, len=${BlockHeaderToken.len}`,
      )
      if (header.blockIndex === 0 && !this.metadata.format.container) {
        this.metadata.setFormat("container", "WavPack")
        this.metadata.setFormat("lossless", !header.flags.isHybrid)
        // tagTypes: this.type,
        this.metadata.setFormat("bitsPerSample", header.flags.bitsPerSample)
        if (!header.flags.isDSD) {
          // In case isDSD, these values will ne set in ID_DSD_BLOCK
          this.metadata.setFormat("sampleRate", header.flags.samplingRate)
          this.metadata.setFormat(
            "duration",
            header.totalSamples / header.flags.samplingRate,
          )
        }
        this.metadata.setFormat("numberOfChannels", header.flags.isMono ? 1 : 2)
        this.metadata.setFormat("numberOfSamples", header.totalSamples)
        this.metadata.setFormat("codec", header.flags.isDSD ? "DSD" : "PCM")
      }
      const ignoreBytes = header.blockSize - (BlockHeaderToken.len - 8)
      await (header.blockIndex === 0
        ? this.parseMetadataSubBlock(header, ignoreBytes)
        : this.tokenizer.ignore(ignoreBytes))
      if (header.blockSamples > 0) {
        this.audioDataSize += header.blockSize // Count audio data for bit-rate calculation
      }
    } while (
      !this.tokenizer.fileInfo.size ||
      this.tokenizer.fileInfo.size - this.tokenizer.position >=
        BlockHeaderToken.len
    )
    if (this.metadata.format.duration) {
      this.metadata.setFormat(
        "bitrate",
        (this.audioDataSize * 8) / this.metadata.format.duration,
      )
    }
  }
  /**
   * Ref: http://www.wavpack.com/WavPack5FileFormat.pdf, 3.0 Metadata Sub-blocks
   * @param header Header
   * @param remainingLength Remaining length
   */
  async parseMetadataSubBlock(header, remainingLength) {
    let remaining = remainingLength
    while (remaining > MetadataIdToken.len) {
      const id = await this.tokenizer.readToken(MetadataIdToken)
      const dataSizeInWords = await this.tokenizer.readNumber(
        id.largeBlock ? UINT24_LE : UINT8,
      )
      const data = new Uint8Array(dataSizeInWords * 2 - (id.isOddSize ? 1 : 0))
      await this.tokenizer.readBuffer(data)
      debug$1(
        `Metadata Sub-Blocks functionId=0x${id.functionId.toString(16)}, id.largeBlock=${id.largeBlock},data-size=${data.length}`,
      )
      switch (id.functionId) {
        case 0x0: // ID_DUMMY: could be used to pad WavPack blocks
          break
        case 0xe: {
          // ID_DSD_BLOCK
          debug$1("ID_DSD_BLOCK")
          // https://github.com/dbry/WavPack/issues/71#issuecomment-483094813
          const mp = 1 << UINT8.get(data, 0)
          const samplingRate = header.flags.samplingRate * mp * 8 // ToDo: second factor should be read from DSD-metadata block https://github.com/dbry/WavPack/issues/71#issuecomment-483094813
          if (!header.flags.isDSD)
            throw new WavPackContentError(
              "Only expect DSD block if DSD-flag is set",
            )
          this.metadata.setFormat("sampleRate", samplingRate)
          this.metadata.setFormat(
            "duration",
            header.totalSamples / samplingRate,
          )
          break
        }
        case 0x24: // ID_ALT_TRAILER: maybe used to embed original ID3 tag header
          debug$1("ID_ALT_TRAILER: trailer for non-wav files")
          break
        case 0x26: // ID_MD5_CHECKSUM
          this.metadata.setFormat("audioMD5", data)
          break
        case 0x2f: // ID_BLOCK_CHECKSUM
          debug$1(`ID_BLOCK_CHECKSUM: checksum=${uint8ArrayToHex(data)}`)
          break
        default:
          debug$1(
            `Ignore unsupported meta-sub-block-id functionId=0x${id.functionId.toString(16)}`,
          )
          break
      }
      remaining -=
        MetadataIdToken.len +
        (id.largeBlock ? UINT24_LE.len : UINT8.len) +
        dataSizeInWords * 2
      debug$1(`remainingLength=${remaining}`)
      if (id.isOddSize) this.tokenizer.ignore(1)
    }
    if (remaining !== 0)
      throw new WavPackContentError(
        "metadata-sub-block should fit it remaining length",
      )
  }
}

var WavPackParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  WavPackContentError: WavPackContentError,
  WavPackParser: WavPackParser,
})

/**
 * Common RIFF chunk header
 */
const Header = {
  len: 8,
  get: (buf, off) => {
    return {
      // Group-ID
      chunkID: new StringType(4, "latin1").get(buf, off),
      // Size
      chunkSize: UINT32_LE.get(buf, off + 4),
    }
  },
}
/**
 * Token to parse RIFF-INFO tag value
 */
class ListInfoTagValue {
  constructor(tagHeader) {
    this.tagHeader = tagHeader
    this.len = tagHeader.chunkSize
    this.len += this.len & 1 // if it is an odd length, round up to even
  }
  get(buf, off) {
    return new StringType(this.tagHeader.chunkSize, "ascii").get(buf, off)
  }
}

class WaveContentError extends makeUnexpectedFileContentError("Wave") {}
/**
 * Ref: https://msdn.microsoft.com/en-us/library/windows/desktop/dd317599(v=vs.85).aspx
 */
var WaveFormat
;(function (WaveFormat) {
  WaveFormat[(WaveFormat["PCM"] = 1)] = "PCM"
  // MPEG-4 and AAC Audio Types
  WaveFormat[(WaveFormat["ADPCM"] = 2)] = "ADPCM"
  WaveFormat[(WaveFormat["IEEE_FLOAT"] = 3)] = "IEEE_FLOAT"
  WaveFormat[(WaveFormat["MPEG_ADTS_AAC"] = 5632)] = "MPEG_ADTS_AAC"
  WaveFormat[(WaveFormat["MPEG_LOAS"] = 5634)] = "MPEG_LOAS"
  WaveFormat[(WaveFormat["RAW_AAC1"] = 255)] = "RAW_AAC1"
  // Dolby Audio Types
  WaveFormat[(WaveFormat["DOLBY_AC3_SPDIF"] = 146)] = "DOLBY_AC3_SPDIF"
  WaveFormat[(WaveFormat["DVM"] = 8192)] = "DVM"
  WaveFormat[(WaveFormat["RAW_SPORT"] = 576)] = "RAW_SPORT"
  WaveFormat[(WaveFormat["ESST_AC3"] = 577)] = "ESST_AC3"
  WaveFormat[(WaveFormat["DRM"] = 9)] = "DRM"
  WaveFormat[(WaveFormat["DTS2"] = 8193)] = "DTS2"
  WaveFormat[(WaveFormat["MPEG"] = 80)] = "MPEG"
})(WaveFormat || (WaveFormat = {}))
/**
 * format chunk; chunk-id is "fmt "
 * http://soundfile.sapp.org/doc/WaveFormat/
 */
class Format {
  constructor(header) {
    if (header.chunkSize < 16) throw new WaveContentError("Invalid chunk size")
    this.len = header.chunkSize
  }
  get(buf, off) {
    return {
      wFormatTag: UINT16_LE.get(buf, off),
      nChannels: UINT16_LE.get(buf, off + 2),
      nSamplesPerSec: UINT32_LE.get(buf, off + 4),
      nAvgBytesPerSec: UINT32_LE.get(buf, off + 8),
      nBlockAlign: UINT16_LE.get(buf, off + 12),
      wBitsPerSample: UINT16_LE.get(buf, off + 14),
    }
  }
}
/**
 * Fact chunk; chunk-id is "fact"
 * http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html
 * http://www.recordingblogs.com/wiki/fact-chunk-of-a-wave-file
 */
class FactChunk {
  constructor(header) {
    if (header.chunkSize < 4) {
      throw new WaveContentError("Invalid fact chunk size.")
    }
    this.len = header.chunkSize
  }
  get(buf, off) {
    return {
      dwSampleLength: UINT32_LE.get(buf, off),
    }
  }
}

/**
 * Broadcast Audio Extension Chunk
 * Ref: https://tech.ebu.ch/docs/tech/tech3285.pdf
 */
const BroadcastAudioExtensionChunk = {
  len: 420,
  get: (uint8array, off) => {
    return {
      description: stripNulls(
        new StringType(256, "ascii").get(uint8array, off),
      ).trim(),
      originator: stripNulls(
        new StringType(32, "ascii").get(uint8array, off + 256),
      ).trim(),
      originatorReference: stripNulls(
        new StringType(32, "ascii").get(uint8array, off + 288),
      ).trim(),
      originationDate: stripNulls(
        new StringType(10, "ascii").get(uint8array, off + 320),
      ).trim(),
      originationTime: stripNulls(
        new StringType(8, "ascii").get(uint8array, off + 330),
      ).trim(),
      timeReferenceLow: UINT32_LE.get(uint8array, off + 338),
      timeReferenceHigh: UINT32_LE.get(uint8array, off + 342),
      version: UINT16_LE.get(uint8array, off + 346),
      umid: new Uint8ArrayType(64).get(uint8array, off + 348),
      loudnessValue: UINT16_LE.get(uint8array, off + 412),
      maxTruePeakLevel: UINT16_LE.get(uint8array, off + 414),
      maxMomentaryLoudness: UINT16_LE.get(uint8array, off + 416),
      maxShortTermLoudness: UINT16_LE.get(uint8array, off + 418),
    }
  },
}

const debug = initDebug("music-metadata:parser:RIFF")
/**
 * Resource Interchange File Format (RIFF) Parser
 *
 * WAVE PCM soundfile format
 *
 * Ref:
 * - http://www.johnloomis.org/cpe102/asgn/asgn1/riff.html
 * - http://soundfile.sapp.org/doc/WaveFormat
 *
 * ToDo: Split WAVE part from RIFF parser
 */
class WaveParser extends BasicParser {
  constructor() {
    super(...arguments)
    this.blockAlign = 0
  }
  async parse() {
    const riffHeader = await this.tokenizer.readToken(Header)
    debug(
      `pos=${this.tokenizer.position}, parse: chunkID=${riffHeader.chunkID}`,
    )
    if (riffHeader.chunkID !== "RIFF") return // Not RIFF format
    return this.parseRiffChunk(riffHeader.chunkSize).catch((err) => {
      if (!(err instanceof EndOfStreamError$1)) {
        throw err
      }
    })
  }
  async parseRiffChunk(chunkSize) {
    const type = await this.tokenizer.readToken(FourCcToken)
    this.metadata.setFormat("container", type)
    switch (type) {
      case "WAVE":
        return this.readWaveChunk(chunkSize - FourCcToken.len)
      default:
        throw new WaveContentError(`Unsupported RIFF format: RIFF/${type}`)
    }
  }
  async readWaveChunk(remaining) {
    while (remaining >= Header.len) {
      const header = await this.tokenizer.readToken(Header)
      remaining -= Header.len + header.chunkSize
      if (header.chunkSize > remaining) {
        this.metadata.addWarning("Data chunk size exceeds file size")
      }
      this.header = header
      debug(
        `pos=${this.tokenizer.position}, readChunk: chunkID=RIFF/WAVE/${header.chunkID}`,
      )
      switch (header.chunkID) {
        case "LIST":
          await this.parseListTag(header)
          break
        case "fact": // extended Format chunk,
          this.metadata.setFormat("lossless", false)
          this.fact = await this.tokenizer.readToken(new FactChunk(header))
          break
        case "fmt ": {
          // The Util Chunk, non-PCM Formats
          const fmt = await this.tokenizer.readToken(new Format(header))
          let subFormat = WaveFormat[fmt.wFormatTag]
          if (!subFormat) {
            debug(`WAVE/non-PCM format=${fmt.wFormatTag}`)
            subFormat = `non-PCM (${fmt.wFormatTag})`
          }
          this.metadata.setFormat("codec", subFormat)
          this.metadata.setFormat("bitsPerSample", fmt.wBitsPerSample)
          this.metadata.setFormat("sampleRate", fmt.nSamplesPerSec)
          this.metadata.setFormat("numberOfChannels", fmt.nChannels)
          this.metadata.setFormat(
            "bitrate",
            fmt.nBlockAlign * fmt.nSamplesPerSec * 8,
          )
          this.blockAlign = fmt.nBlockAlign
          break
        }
        case "id3 ": // The way Picard, FooBar currently stores, ID3 meta-data
        case "ID3 ": {
          // The way Mp3Tags stores ID3 meta-data
          const id3_data = await this.tokenizer.readToken(
            new Uint8ArrayType(header.chunkSize),
          )
          const rst = fromBuffer$1(id3_data)
          await new ID3v2Parser().parse(this.metadata, rst, this.options)
          break
        }
        case "data": {
          // PCM-data
          if (this.metadata.format.lossless !== false) {
            this.metadata.setFormat("lossless", true)
          }
          let chunkSize = header.chunkSize
          if (this.tokenizer.fileInfo.size) {
            const calcRemaining =
              this.tokenizer.fileInfo.size - this.tokenizer.position
            if (calcRemaining < chunkSize) {
              this.metadata.addWarning(
                "data chunk length exceeding file length",
              )
              chunkSize = calcRemaining
            }
          }
          const numberOfSamples = this.fact
            ? this.fact.dwSampleLength
            : chunkSize === 0xffffffff
              ? undefined
              : chunkSize / this.blockAlign
          if (numberOfSamples) {
            this.metadata.setFormat("numberOfSamples", numberOfSamples)
            if (this.metadata.format.sampleRate) {
              this.metadata.setFormat(
                "duration",
                numberOfSamples / this.metadata.format.sampleRate,
              )
            }
          }
          if (this.metadata.format.codec === "ADPCM") {
            // ADPCM is 4 bits lossy encoding resulting in 352kbps
            this.metadata.setFormat("bitrate", 352000)
          } else if (this.metadata.format.sampleRate) {
            this.metadata.setFormat(
              "bitrate",
              this.blockAlign * this.metadata.format.sampleRate * 8,
            )
          }
          await this.tokenizer.ignore(header.chunkSize)
          break
        }
        case "bext": {
          // Broadcast Audio Extension chunk	https://tech.ebu.ch/docs/tech/tech3285.pdf
          const bext = await this.tokenizer.readToken(
            BroadcastAudioExtensionChunk,
          )
          Object.keys(bext).forEach((key) => {
            this.metadata.addTag("exif", `bext.${key}`, bext[key])
          })
          const bextRemaining =
            header.chunkSize - BroadcastAudioExtensionChunk.len
          await this.tokenizer.ignore(bextRemaining)
          break
        }
        case "\x00\x00\x00\x00": // padding ??
          debug(
            `Ignore padding chunk: RIFF/${header.chunkID} of ${header.chunkSize} bytes`,
          )
          this.metadata.addWarning(`Ignore chunk: RIFF/${header.chunkID}`)
          await this.tokenizer.ignore(header.chunkSize)
          break
        default:
          debug(
            `Ignore chunk: RIFF/${header.chunkID} of ${header.chunkSize} bytes`,
          )
          this.metadata.addWarning(`Ignore chunk: RIFF/${header.chunkID}`)
          await this.tokenizer.ignore(header.chunkSize)
      }
      if (this.header.chunkSize % 2 === 1) {
        debug("Read odd padding byte") // https://wiki.multimedia.cx/index.php/RIFF
        await this.tokenizer.ignore(1)
      }
    }
  }
  async parseListTag(listHeader) {
    const listType = await this.tokenizer.readToken(new StringType(4, "latin1"))
    debug(
      "pos=%s, parseListTag: chunkID=RIFF/WAVE/LIST/%s",
      this.tokenizer.position,
      listType,
    )
    switch (listType) {
      case "INFO":
        return this.parseRiffInfoTags(listHeader.chunkSize - 4)
      default:
        this.metadata.addWarning(`Ignore chunk: RIFF/WAVE/LIST/${listType}`)
        debug(`Ignoring chunkID=RIFF/WAVE/LIST/${listType}`)
        return this.tokenizer.ignore(listHeader.chunkSize - 4).then()
    }
  }
  async parseRiffInfoTags(chunkSize) {
    while (chunkSize >= 8) {
      const header = await this.tokenizer.readToken(Header)
      const valueToken = new ListInfoTagValue(header)
      const value = await this.tokenizer.readToken(valueToken)
      this.addTag(header.chunkID, stripNulls(value))
      chunkSize -= 8 + valueToken.len
    }
    if (chunkSize !== 0) {
      throw new WaveContentError(`Illegal remaining size: ${chunkSize}`)
    }
  }
  addTag(id, value) {
    this.metadata.addTag("exif", id, value)
  }
}

var WaveParser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  WaveParser: WaveParser,
})

export {
  LyricsContentType,
  TimestampFormat,
  orderTags,
  parseBlob,
  parseBuffer,
  parseFromTokenizer,
  parseWebStream,
  ratingToStars,
  scanAppendingHeaders,
  selectCover,
}
