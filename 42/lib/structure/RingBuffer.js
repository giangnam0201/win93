import { noop } from "../type/function/noop.js"

/**
 * Helper function to check if a number is a power of two.
 * @param {number} n The number to check.
 * @returns {boolean}
 */
export function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0
}

/**
 * A RingBuffer for single-producer, single-consumer scenarios.
 */
export class RingBuffer {
  /**
   * @param {number} capacity The capacity of the buffer. Must be a power of two.
   * @param {number} [channelCount] The number of channels.
   */
  constructor(capacity, channelCount = 1) {
    if (!isPowerOfTwo(capacity)) {
      throw new Error("Capacity must be a power of two.")
    }

    this.capacity = capacity
    this.channelCount = channelCount

    this.writeIndex = 0
    this.readIndex = 0
    this.framesAvailable = 0

    // Pre-allocate the memory for the buffer.
    this.channels = []
    for (let i = 0; i < this.channelCount; i++) {
      this.channels.push(new Float32Array(this.capacity))
    }
  }

  reset() {
    this.writeIndex = 0
    this.readIndex = 0
    this.framesAvailable = 0
  }

  /**
   * Pushes a block of frames into the buffer.
   * @param {Float32Array[]} data An array of Float32Arrays, one for each channel.
   * @returns {boolean} True if the push was successful, false if the buffer was full.
   */
  push(data) {
    const channelCount = data.length
    if (channelCount !== this.channelCount) {
      throw new Error(
        "Input channel count does not match buffer channel count.",
      )
    }

    const frameCount = data[0].length
    if (frameCount > this.capacity - this.framesAvailable) {
      console.debug("RingBuffer overflow: not enough space to write frames.")
      return false
    }

    for (let i = 0; i < this.channelCount; i++) {
      const source = data[i]
      const target = this.channels[i]
      for (let j = 0; j < frameCount; j++) {
        // Use bitwise AND for efficient modulo wrapping with power-of-two capacity.
        target[(this.writeIndex + j) & (this.capacity - 1)] = source[j]
      }
    }

    this.writeIndex = (this.writeIndex + frameCount) & (this.capacity - 1)
    this.framesAvailable += frameCount
    return true
  }

  /**
   * Pulls a block of frames from the buffer.
   * @param {Float32Array[]} data An array of Float32Arrays to be filled.
   * @returns {boolean} True if the pull was successful, false if not enough data was available.
   */
  pull(data) {
    const channelCount = data.length
    if (channelCount !== this.channelCount) {
      throw new Error(
        "Output channel count does not match buffer channel count.",
      )
    }

    const frameCount = data[0].length
    if (frameCount > this.framesAvailable) {
      console.debug("RingBuffer underrun: not enough frames available to read.")
      return false
    }

    for (let i = 0; i < this.channelCount; i++) {
      const source = this.channels[i]
      const target = data[i]
      for (let j = 0; j < frameCount; j++) {
        // Use bitwise AND for efficient modulo wrapping with power-of-two capacity.
        target[j] = source[(this.readIndex + j) & (this.capacity - 1)]
      }
    }

    this.readIndex = (this.readIndex + frameCount) & (this.capacity - 1)
    this.framesAvailable -= frameCount
    return true
  }
}

/**
 * An adapter to use ScriptProcessorNode logic inside an audio Worklet.
 */
export class RingBufferProcessor {
  constructor(
    bufferSize,
    numberOfInputChannels = 0,
    numberOfOutputChannels = 2,
    onProcess = noop,
  ) {
    this.bufferSize = bufferSize

    this.inputBuffer = numberOfInputChannels
      ? new RingBuffer(bufferSize * 2, numberOfInputChannels)
      : undefined
    this.outputBuffer = numberOfOutputChannels
      ? new RingBuffer(bufferSize * 2, numberOfOutputChannels)
      : undefined

    this.inputs = Array.from(
      { length: numberOfInputChannels },
      () => new Float32Array(bufferSize),
    )
    this.outputs = Array.from(
      { length: numberOfOutputChannels },
      () => new Float32Array(bufferSize),
    )

    this.onProcess = onProcess
  }

  reset() {
    this.inputBuffer?.reset()
    this.outputBuffer?.reset()
  }

  processOutput(output) {
    // Generate new audio if the buffer is running low.
    // We generate a new block if the available frames are less than what
    // we need to fill the next output. This is a good time to refill.
    while (this.outputBuffer.framesAvailable < this.bufferSize) {
      this.onProcess(this.inputs, this.outputs)
      this.outputBuffer.push(this.outputs)
    }

    // Pull data from the ring buffer to the final output.
    if (this.outputBuffer.framesAvailable >= 128) {
      this.outputBuffer.pull(output)
    } else {
      // This is an underrun, which can happen at the very beginning or if the
      // main thread is too busy. Output silence to avoid garbage.
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0)
      }
      console.debug("Worklet generator underrun.")
    }
  }
}
