// @src https://github.com/chrisguttandin/limiter-audio-worklet-processor
//! Copyright (c) 2025 Christoph Guttandin. MIT License.

import { AudioProcessor } from "../../AudioProcessorNode.js"

// const RELEASE_TIME_SECONDS = 0.5
// const RELEASE_TIME_SECONDS = 0.1
const RELEASE_TIME_SECONDS = 0.0001
const RELEASE_GAIN = Math.exp(-1 / (sampleRate * RELEASE_TIME_SECONDS))
// const THRESHOLD = 10 ** -0.1
// const THRESHOLD = 1.5
const THRESHOLD = 3

export class ConstantMemoryDeque {
  /**
   * @param {Uint16Array} _buffer
   */
  constructor(_buffer) {
    this._buffer = _buffer
    this._firstIndex = 0
    this._isEmpty = true
    this._lastIndex = 0
    if (this._buffer.length === 0) {
      throw new Error("The given buffer is too small.")
    }
  }

  get size() {
    return this._isEmpty
      ? 0
      : this._lastIndex < this._firstIndex
        ? this._buffer.length - this._firstIndex + this._lastIndex + 1
        : this._lastIndex - this._firstIndex + 1
  }

  first() {
    this._throwIfEmpty()
    return this._buffer[this._firstIndex]
  }

  last() {
    this._throwIfEmpty()
    return this._buffer[this._lastIndex]
  }

  pop() {
    this._throwIfEmpty()
    if (this._firstIndex === this._lastIndex) {
      this._isEmpty = true
    } else {
      this._lastIndex = this._decrementIndex(this._lastIndex)
    }
  }

  shift() {
    this._throwIfEmpty()
    if (this._firstIndex === this._lastIndex) {
      this._isEmpty = true
    } else {
      this._firstIndex = this._incrementIndex(this._firstIndex)
    }
  }

  /**
   * @param {number} value
   */
  unshift(value) {
    if (this._isEmpty) {
      this._buffer[this._firstIndex] = value
      this._isEmpty = false
    } else {
      const nextIndex = this._decrementIndex(this._firstIndex)
      if (nextIndex === this._lastIndex) {
        throw new Error("Deque is full.")
      }

      this._buffer[nextIndex] = value
      this._firstIndex = nextIndex
    }
  }

  /**
   * @param {number} index
   */
  _decrementIndex(index) {
    return index === 0 ? this._buffer.length - 1 : index - 1
  }

  /**
   * @param {number} index
   */
  _incrementIndex(index) {
    return (index + 1) % this._buffer.length
  }

  _throwIfEmpty() {
    if (this._isEmpty) {
      throw new Error("Deque is empty.")
    }
  }
}

/**
 * @param {Float32Array} target
 * @param {Float32Array} source
 * @param {number} offset
 * @returns {number}
 */
const readFromRingBuffer = (target, source, offset) => {
  const theoreticalNextOffset = offset + source.length
  if (theoreticalNextOffset <= target.length) {
    source.set(
      new Float32Array(
        target.buffer,
        target.byteOffset + offset * source.BYTES_PER_ELEMENT,
        source.length,
      ),
    )
    return theoreticalNextOffset === target.length ? 0 : theoreticalNextOffset
  }

  const nextOffset = theoreticalNextOffset - target.length
  const lengthOfFirstChunk = target.length - offset
  source.set(
    new Float32Array(
      target.buffer,
      target.byteOffset + offset * source.BYTES_PER_ELEMENT,
      lengthOfFirstChunk,
    ),
  )
  source.set(
    new Float32Array(target.buffer, target.byteOffset, nextOffset),
    lengthOfFirstChunk,
  )
  return nextOffset
}

/**
 * @param {Float32Array} target
 * @param {Float32Array} source
 * @param {number} offset
 * @returns {number}
 */
const writeToRingBuffer = (target, source, offset) => {
  const theoreticalNextOffset = offset + source.length
  if (theoreticalNextOffset <= target.length) {
    target.set(source, offset)
    return theoreticalNextOffset === target.length ? 0 : theoreticalNextOffset
  }

  const nextOffset = theoreticalNextOffset - target.length
  const lengthOfFirstChunk = target.length - offset
  target.set(
    new Float32Array(source.buffer, source.byteOffset, lengthOfFirstChunk),
    offset,
  )
  target.set(
    new Float32Array(
      source.buffer,
      source.byteOffset + lengthOfFirstChunk * source.BYTES_PER_ELEMENT,
      nextOffset,
    ),
  )
  return nextOffset
}

/**
 * @param {Float32Array} envelopeBuffer
 * @param {Float32Array} delayBuffer
 * @param {number} offset
 * @param {null | ConstantMemoryDeque} constantMemoryDeque
 * @returns {void}
 */
const computeEnvelope = (
  envelopeBuffer,
  delayBuffer,
  offset,
  constantMemoryDeque,
) => {
  let previousEnvelopeValue = envelopeBuffer[127]
  for (let i = 0; i < 128; i += 1) {
    const readOffset = (offset + i) % delayBuffer.length
    const absoluteValue = Math.abs(delayBuffer[readOffset])
    let maximumValue
    let remainingSteps
    if (constantMemoryDeque === null) {
      maximumValue = absoluteValue
      remainingSteps = 1
    } else {
      while (
        constantMemoryDeque.size > 0 &&
        absoluteValue >= Math.abs(delayBuffer[constantMemoryDeque.first()])
      ) {
        constantMemoryDeque.shift()
      }

      if (
        constantMemoryDeque.size === 0 ||
        absoluteValue < Math.abs(delayBuffer[constantMemoryDeque.first()])
      ) {
        constantMemoryDeque.unshift(readOffset)
      }

      const dropOffset = (offset + i + 128) % delayBuffer.length
      if (constantMemoryDeque.last() === dropOffset) {
        constantMemoryDeque.pop()
      }

      const indexOfMaximum = constantMemoryDeque.last()
      maximumValue = Math.abs(delayBuffer[indexOfMaximum])
      remainingSteps =
        indexOfMaximum < readOffset
          ? readOffset - indexOfMaximum + 1
          : readOffset + delayBuffer.length - indexOfMaximum + 1
    }

    const difference = previousEnvelopeValue - maximumValue
    previousEnvelopeValue =
      previousEnvelopeValue < maximumValue
        ? previousEnvelopeValue - difference / remainingSteps
        : maximumValue + RELEASE_GAIN * difference
    envelopeBuffer[i] = previousEnvelopeValue
  }
}

export class LimiterProcessor extends AudioProcessor {
  static parameterDescriptors = []

  constructor({
    channelCount,
    channelCountMode,
    numberOfInputs,
    numberOfOutputs,
    outputChannelCount,
    processorOptions,
  }) {
    const attack =
      typeof processorOptions === "object" &&
      processorOptions !== null &&
      "attack" in processorOptions
        ? processorOptions.attack
        : 0

    if (typeof attack !== "number") {
      throw new TypeError('The attack needs to be of type "number".')
    }

    if (attack < 0) {
      throw new Error("The attack can't be negative.")
    }

    if (channelCountMode !== "explicit") {
      throw new Error('The channelCountMode needs to be "explicit".')
    }

    if (numberOfInputs !== 1) throw new Error("The numberOfInputs must be 1.")
    if (numberOfOutputs !== 1) throw new Error("The numberOfOutputs must be 1.")

    if (
      outputChannelCount === undefined ||
      channelCount !== outputChannelCount[0]
    ) {
      throw new Error(
        "The channelCount must be the same as the outputChannelCount of the first output.",
      )
    }

    super()

    const attackSamples = sampleRate * attack
    const delaySize = Math.round(attackSamples)
    const delayBufferSize = delaySize + 128

    this._constantMemoryDeques =
      delaySize === 0
        ? null
        : Array.from(
            { length: channelCount },
            () => new ConstantMemoryDeque(new Uint16Array(delaySize + 1)),
          )

    this._delayBuffers = Array.from(
      { length: channelCount },
      () => new Float32Array(delayBufferSize),
    )

    this._envelopeBuffers = Array.from(
      { length: channelCount },
      () => new Float32Array(128),
    )

    this._writeOffset = 0
  }

  /**
   * @param {Float32Array[][]} param0
   * @param {Float32Array[][]} param1
   * @returns {boolean}
   */
  process([input], [output]) {
    const numberOfChannels = input.length
    const writeOffset = this._writeOffset

    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const constantMemoryDeque =
        this._constantMemoryDeques === null
          ? null
          : this._constantMemoryDeques[channel]

      const delayBuffer = this._delayBuffers[channel]
      const envelopeBuffer = this._envelopeBuffers[channel]
      const inputChannelData = input[channel]
      const outputChannelData = output[channel]

      this._writeOffset = writeToRingBuffer(
        delayBuffer,
        inputChannelData,
        writeOffset,
      )

      computeEnvelope(
        envelopeBuffer,
        delayBuffer,
        writeOffset,
        constantMemoryDeque,
      )

      readFromRingBuffer(delayBuffer, outputChannelData, this._writeOffset)

      for (let i = 0; i < 128; i += 1) {
        const gain = Math.min(1, THRESHOLD / envelopeBuffer[i])
        outputChannelData[i] *= gain
      }
    }

    return this.running
  }
}

AudioProcessor.define("limiter", LimiterProcessor)
