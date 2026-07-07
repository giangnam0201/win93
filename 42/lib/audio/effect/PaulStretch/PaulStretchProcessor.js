import { AudioProcessor } from "../../AudioProcessorNode.js"
import { fft } from "../../../algo/fft.js"
import { prevPow2, log2 } from "../../../algo/bits.js"

function add(array1, array2) {
  for (let i = 0, l = array1.length; i < l; i++) array1[i] += array2[i]
}

function map(array, cb) {
  for (let i = 0, l = array.length; i < l; i++) array[i] = cb(array[i])
}

function newBlock(channelCount, windowSize) {
  const block = []

  for (let ch = 0; ch < channelCount; ch++) {
    block.push(new Float32Array(windowSize))
  }

  return block
}

function createWindow(windowSize) {
  const winArray = new Float32Array(windowSize)
  let counter = -1
  const step = 2 / (windowSize - 1)

  for (let i = 0; i < windowSize; i++) {
    winArray[i] = (1 - counter ** 2) ** 1.25
    counter += step
  }

  return winArray
}

function applyWindow(block, winArray) {
  const frameCount = block[0].length
  const channelCount = block.length

  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < channelCount; ch++) {
      block[ch][i] *= winArray[i]
    }
  }
}

function duplicateChannels(input, channelCount) {
  if (input.length === 1) {
    if (channelCount === 1) {
      return [input[0].slice()]
    }

    const channel = input[0].slice()
    return [channel, channel]
  }

  if (channelCount === 1) {
    const merged = new Float32Array(128)
    for (let i = 127; i >= 0; i--) {
      merged[i] = (input[0][i] + input[1][i]) * 0.5
    }

    return [merged]
  }

  const cloned = []

  for (let ch = 0; ch < channelCount; ch++) {
    cloned.push(input[ch].slice())
  }

  return cloned
}

// Returns a function for setting the phases of an array, array length `windowSize`.
// The returned function is `rephase(array, phases)`.
function makeRephaser(windowSize) {
  const halfWinSize = Math.floor(windowSize / 2)
  const halfWinSizePlusOne = halfWinSize + 1

  const re = new Float32Array(windowSize)
  const im = new Float32Array(windowSize)

  const m = log2(windowSize)

  const amplitudes = new Float32Array(halfWinSizePlusOne)
  let i
  const { length } = amplitudes

  return (array, phases) => {
    // Prepare im and re for FFT
    im.fill(0)
    re.set(array)

    // get the amplitudes of the frequency components and discard the phases
    fft(1, re, im, m)

    amplitudes.set(
      re
        // get only the unique part of the spectrum
        .subarray(0, halfWinSizePlusOne)
        // input signal is real, so abs value of `re` is the amplitude
        .map(Math.abs),
    )

    // Apply the new phases
    for (i = 0; i < length; i++) {
      re[i] = amplitudes[i] * Math.cos(phases[i])
      im[i] = amplitudes[i] * Math.sin(phases[i])
    }

    // Rebuild `re` and `im` by adding the symetric part
    for (i = 1; i < halfWinSize; i++) {
      re[halfWinSize + i] = re[halfWinSize - i]
      im[halfWinSize + i] = im[halfWinSize - i] * -1
    }

    // do the inverse FFT
    fft(-1, re, im, m)
    array.set(re)
  }
}

// Buffer of blocks allowing to read blocks of a fixed block size and to get overlapped
// blocks in output.
// `samples.write(block)` will queue `block`
// `samples.read(blockOut)` will read the queued blocks to `blockOut`
class Samples {
  constructor(displacePos) {
    const blocksIn = []
    let readPos = 0
    let framesAvailable = 0

    this.setDisplacePos = function (val) {
      displacePos = val
    }

    this.getReadPos = function () {
      return readPos
    }

    this.getFramesAvailable = function () {
      return framesAvailable
    }

    // If there's more data than `blockSize` return a block, otherwise return null.
    this.read = function (blockOut) {
      const channelCount = blockOut.length
      const blockSize = blockOut[0].length
      let i
      let ch
      let block
      let writePos // position of writing in output block
      let readStart // position to start reading from the next block
      let toRead // amount of frames to read from the next block

      if (framesAvailable >= blockSize) {
        readStart = Math.floor(readPos)
        writePos = 0
        i = 0

        // Write inBlocks to the outBlock
        while (writePos < blockSize) {
          block = blocksIn[i++]
          toRead = Math.min(block[0].length - readStart, blockSize - writePos)

          for (ch = 0; ch < channelCount; ch++) {
            blockOut[ch].set(
              block[ch].subarray(readStart, readStart + toRead),
              writePos,
            )
          }

          writePos += toRead
          readStart = 0
        }

        // Update positions
        readPos += displacePos || blockSize
        framesAvailable -= displacePos || blockSize

        // Discard used input blocks
        block = blocksIn[0]
        while (block[0].length < readPos) {
          blocksIn.shift()
          readPos -= block[0].length
          block = blocksIn[0]
        }

        return blockOut
      }

      return null
    }

    // Writes `block` to the queue
    this.write = function (block) {
      blocksIn.push(block)
      framesAvailable += block[0].length
    }
  }
}

/**
 * Paul's Extreme Sound Stretch algorithm.
 *
 * @license MIT
 * @copyright 2014 Sébastien Piquemal <sebpiq@gmail.com>
 * @copyright 2006-2011 Nasca Octavian Paul
 * @source https://github.com/sebpiq/paulstretch.js
 */
export class PaulStretch {
  /** @type {number} */ #ratio
  /** @type {number} */ #windowSize

  constructor(channelCount = 1, ratio = 5, windowSize = 2 ** 14) {
    this.samplesIn = new Samples()
    this.samplesOut = new Samples()
    this.channelCount = channelCount
    this.windowSize = windowSize
    this.ratio = ratio
  }

  get windowSize() {
    return this.#windowSize
  }

  // Sets the stretch windowSize.
  // Note that blocks that have already been processed are using the old windowSize.
  set windowSize(val) {
    const windowSize = prevPow2(val)
    if (this.#windowSize === windowSize) return
    this.#windowSize = windowSize
    this.halfWinSize = this.#windowSize / 2

    // Process samples from the queue. Returns the number of processed frames that were generated
    this.blockIn = newBlock(this.channelCount, this.#windowSize)
    this.blockOut = newBlock(this.channelCount, this.#windowSize)
    this.winArray = createWindow(this.#windowSize)
    this.rephase = makeRephaser(this.#windowSize)
    this.phaseArray = new Float32Array(this.halfWinSize + 1)

    // Invalidate ratio cache
    this.#ratio = -1
  }

  get ratio() {
    return this.#ratio
  }

  // Sets the stretch ratio.
  // Note that blocks that have already been processed are using the old ratio.
  set ratio(val) {
    if (this.#ratio === val) return
    this.#ratio = val
    this.samplesIn.setDisplacePos(this.halfWinSize / this.#ratio)
  }

  // Reads processed samples to `block`.
  // Returns `block`, or `null` if there wasn't enough processed frames.
  read(block) {
    return this.samplesOut.read(block)
  }

  // Pushes `block` to the processing queue.
  write(block) {
    this.samplesIn.write(duplicateChannels(block, this.channelCount))
  }

  // Returns the number of frames waiting to be processed
  writeQueueLength() {
    return this.samplesIn.getFramesAvailable()
  }

  // Returns the number of frames already processed
  readQueueLength() {
    return this.samplesOut.getFramesAvailable()
  }

  process() {
    // Read a block to blockIn
    if (this.samplesIn.read(this.blockIn) === null) return 0

    // get the windowed buffer
    applyWindow(this.blockIn, this.winArray)

    // Randomize phases for each channel
    for (let ch = 0; ch < this.channelCount; ch++) {
      map(this.phaseArray, () => Math.random() * 2 * Math.PI)
      this.rephase(this.blockIn[ch], this.phaseArray)
    }

    // overlap-add the output
    applyWindow(this.blockIn, this.winArray)

    for (let ch = 0; ch < this.channelCount; ch++) {
      add(
        this.blockIn[ch].subarray(0, this.halfWinSize),
        this.blockOut[ch].subarray(this.halfWinSize, this.#windowSize),
      )
    }

    // Generate the output
    for (let i = 0, l = this.blockIn.length; i < l; i++) {
      this.blockOut[i] = this.blockIn[i].slice()
    }

    this.samplesOut.write(
      this.blockOut.map((chArray) => chArray.subarray(0, this.halfWinSize)),
    )
    return this.halfWinSize
  }
}

/* MARK: Processor
------------------ */

class PaulStretchProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "ratio",
        defaultValue: 5,
        minValue: 1,
        maxValue: 100,
        automationRate: "k-rate",
      },
      {
        name: "windowSize",
        defaultValue: 2 ** 14,
        minValue: 128,
        maxValue: 2 ** 14 * 2,
        automationRate: "k-rate",
      },
    ]
  }

  constructor(options) {
    super(options)

    const { ratio, windowSize } = options.parameterData
    const channelCount = options.outputChannelCount[0]

    this.stretch = new PaulStretch(channelCount, ratio, windowSize)
  }

  /**
   * @param {Float32Array[][]} param0
   * @param {Float32Array[][]} param1
   * @param {Record<string, Float32Array>} param2
   */
  process([input], [output], { ratio, windowSize }) {
    this.stretch.windowSize = windowSize[0]
    this.stretch.ratio = ratio[0]

    this.stretch.write(input)

    if (this.stretch.readQueueLength() >= this.stretch.windowSize) {
      this.stretch.read(output)
    } else console.debug("not enough blocks ready")

    while (
      this.stretch.readQueueLength() < this.stretch.windowSize &&
      this.stretch.process() !== 0
    ) {
      this.stretch.readQueueLength()
    }

    return true
  }
}

AudioProcessor.define("paul-stretch", PaulStretchProcessor)
