import { AudioProcessor } from "../../AudioProcessorNode.js"
import { RingBuffer } from "../../../structure/RingBuffer.js"

const NAME = "mp3-simulator"

const FRAME_SIZE = 1152
const QUANTUM_SIZE = 128
const RING_CAPACITY = 8192
const FRAME_POOL_SIZE = 4
const STATS_INTERVAL = 16
const MIX_SLEW = 0.2
const MIX_EPSILON = 0.0001
const INPUT_SILENCE_THRESHOLD = 1e-4
const FEEDBACK_TAIL_GUARD_THRESHOLD = 0.05
const FULL_FEEDBACK_BYPASS_THRESHOLD = 0.9999
const FEEDBACK_TAIL_PEAK_LIMIT = 0.5
const FEEDBACK_TAIL_GUARD_RELEASE = 0.01
const BLADE_LATENCY_SAMPLES = 2209
const TARGET_BUFFERED_FRAMES = BLADE_LATENCY_SAMPLES + FRAME_SIZE
const MAX_BUFFERED_FRAMES = TARGET_BUFFERED_FRAMES + FRAME_SIZE
const ALLOWED_BITRATES = [
  32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
]

const zeroFrame = new Float32Array(QUANTUM_SIZE)

/**
 * @param {number} value
 * @returns {number}
 */
function dbToGain(value) {
  return 10 ** (value / 20)
}

/**
 * @param {number} frequency
 * @returns {number}
 */
function clampFrequency(frequency) {
  return Math.min(Math.max(frequency, 10), sampleRate * 0.45)
}

/**
 * @param {number} value
 * @param {number} fallback
 * @returns {number}
 */
function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

/**
 * @param {Float32Array} left
 * @param {Float32Array} right
 * @returns {number}
 */
function peakAbsStereo(left, right) {
  let peak = 0

  for (let i = 0; i < left.length; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i] ?? left[i]))
  }

  return peak
}

/**
 * @param {number} bitrate
 * @returns {number}
 */
function snapBladeBitrate(bitrate) {
  let snapped = ALLOWED_BITRATES[0]
  let bestDistance = Infinity

  for (const allowedBitrate of ALLOWED_BITRATES) {
    const distance = Math.abs(allowedBitrate - bitrate)
    if (distance < bestDistance) {
      bestDistance = distance
      snapped = allowedBitrate
    }
  }

  return snapped
}

/**
 * @param {RingBuffer} ring
 * @param {number} frames
 */
function dropOldestFrames(ring, frames) {
  while (frames > 0 && ring.framesAvailable > 0) {
    const chunk = Math.min(frames, ring.framesAvailable, QUANTUM_SIZE)
    const discard = Array.from(
      { length: ring.channelCount },
      () => new Float32Array(chunk),
    )
    ring.pull(discard)
    frames -= chunk
  }
}

/**
 * @param {RingBuffer} ring
 * @param {Float32Array[]} block
 * @returns {number}
 */
function pushKeepingLatest(ring, block) {
  const incomingFrames = block[0]?.length ?? 0
  const freeFrames = ring.capacity - ring.framesAvailable
  const overflowFrames = Math.max(0, incomingFrames - freeFrames)

  if (overflowFrames > 0) {
    dropOldestFrames(ring, overflowFrames)
  }

  ring.push(block)
  return overflowFrames
}

/**
 * @param {RingBuffer} wetRing
 * @param {RingBuffer} dryRing
 * @param {Float32Array[]} wetBlock
 * @param {Float32Array[]} dryBlock
 */
function pushKeepingLatestPair(wetRing, dryRing, wetBlock, dryBlock) {
  const incomingFrames = wetBlock[0]?.length ?? 0
  const freeFrames = Math.min(
    wetRing.capacity - wetRing.framesAvailable,
    dryRing.capacity - dryRing.framesAvailable,
  )
  const overflowFrames = Math.max(0, incomingFrames - freeFrames)

  if (overflowFrames > 0) {
    dropOldestFrames(wetRing, overflowFrames)
    dropOldestFrames(dryRing, overflowFrames)
  }

  wetRing.push(wetBlock)
  dryRing.push(dryBlock)
  return overflowFrames
}

class MP3SimulatorProcessor extends AudioProcessor {
  static get parameterDescriptors() {
    return [
      { name: "bitrate", defaultValue: 128, minValue: 32, maxValue: 320 },
      { name: "drive", defaultValue: 0, minValue: -18, maxValue: 18 },
      { name: "quality", defaultValue: 1, minValue: 0, maxValue: 1 },
      { name: "bias", defaultValue: 0, minValue: -1, maxValue: 1 },
      { name: "feedback", defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: "glitch", defaultValue: 0, minValue: 0, maxValue: 1 },
      {
        name: "highCut",
        defaultValue: 18_000,
        minValue: 1000,
        maxValue: 20_000,
      },
      { name: "lowCut", defaultValue: 20, minValue: 10, maxValue: 5000 },
      { name: "makeupGain", defaultValue: 0, minValue: -18, maxValue: 18 },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1 },
    ]
  }

  constructor(options) {
    super(options)

    this.ready = false
    this.bypass = false
    this.wetActive = false
    this.useDelayedDryFallback = false
    this.mixState = 0
    this.pendingFrames = 0
    this.receivedFrames = 0
    this.underruns = 0
    this.inputDrops = 0
    this.outputDrops = 0
    this.alignedDryDrops = 0
    this.latencyTrims = 0
    this.dryAlignmentDrops = 0
    this.dryTargetFrames = 0
    this.pendingDryMisses = 0
    this.nextFrameId = 0
    this.blockCount = 0
    this.inputRing = new RingBuffer(RING_CAPACITY, 2)
    this.dryRing = new RingBuffer(RING_CAPACITY, 2)
    this.outputRing = new RingBuffer(RING_CAPACITY, 2)
    this.alignedDryRing = new RingBuffer(RING_CAPACITY, 2)
    this.renderBuffer = [
      new Float32Array(QUANTUM_SIZE),
      new Float32Array(QUANTUM_SIZE),
    ]
    this.wetBuffer = [
      new Float32Array(QUANTUM_SIZE),
      new Float32Array(QUANTUM_SIZE),
    ]
    this.dryBuffer = [
      new Float32Array(QUANTUM_SIZE),
      new Float32Array(QUANTUM_SIZE),
    ]
    /** @type {[Float32Array, Float32Array][]} */
    this.framePool = Array.from({ length: FRAME_POOL_SIZE }, () => [
      new Float32Array(FRAME_SIZE),
      new Float32Array(FRAME_SIZE),
    ])
    /** @type {[Float32Array, Float32Array][]} */
    this.dryFramePool = Array.from({ length: FRAME_POOL_SIZE }, () => [
      new Float32Array(FRAME_SIZE),
      new Float32Array(FRAME_SIZE),
    ])
    /** @type {{ id: number, frame: [Float32Array, Float32Array] }[]} */
    this.pendingDryFrames = []

    this.lowpassState = new Float32Array(2)
    this.highpassInput = new Float32Array(2)
    this.highpassState = new Float32Array(2)
    this.feedbackTailGuardGain = 1
    this.feedbackTailGuardClamps = 0
    this.feedbackTailGuardPeak = 0
    this.feedbackTailInputPeak = 0
    this.feedbackTailGuardActive = false

    this.port.addEventListener("message", ({ data }) => {
      if (data.type === "ready") {
        this.ready = true
        this.bypass = Boolean(data.bypass)
        return
      }

      if (data.type === "stream-reset") {
        this.wetActive = false
        this.useDelayedDryFallback = true
        this.outputRing.reset()
        this.alignedDryRing.reset()
        return
      }

      if (data.type !== "processed-frame") return

      const left = new Float32Array(data.leftBuffer)
      const right = new Float32Array(data.rightBuffer)
      const dryFrame = this.pullPendingDryFrame(data.frameId)
      const alignedDryFrame = dryFrame ?? [left, right]

      const pairDrops = pushKeepingLatestPair(
        this.outputRing,
        this.alignedDryRing,
        [left, right],
        alignedDryFrame,
      )
      this.outputDrops += pairDrops
      this.alignedDryDrops += pairDrops
      this.framePool.push([left, right])
      if (dryFrame) {
        this.dryFramePool.push(dryFrame)
      } else {
        this.pendingDryMisses += 1
      }
      this.receivedFrames += 1
      this.pendingFrames = Math.max(0, this.pendingFrames - 1)
    })

    this.port.start()
  }

  getTargetDryBufferedFrames() {
    return Math.min(
      RING_CAPACITY,
      this.inputRing.framesAvailable +
        this.pendingFrames * FRAME_SIZE +
        this.outputRing.framesAvailable,
    )
  }

  alignDryRing() {
    this.dryTargetFrames = this.getTargetDryBufferedFrames()
    const excessFrames = this.dryRing.framesAvailable - this.dryTargetFrames

    if (excessFrames > 0) {
      dropOldestFrames(this.dryRing, excessFrames)
      this.dryAlignmentDrops += excessFrames
    }
  }

  takeDryFrame() {
    return (
      this.dryFramePool.pop() ?? [
        new Float32Array(FRAME_SIZE),
        new Float32Array(FRAME_SIZE),
      ]
    )
  }

  /**
   * @param {number} frameId
   * @returns {[Float32Array, Float32Array] | undefined}
   */
  pullPendingDryFrame(frameId) {
    if (this.pendingDryFrames.length === 0) return

    const first = this.pendingDryFrames[0]
    if (first.id === frameId) {
      this.pendingDryFrames.shift()
      return first.frame
    }

    const index = this.pendingDryFrames.findIndex(
      (entry) => entry.id === frameId,
    )
    if (index === -1) return

    return this.pendingDryFrames.splice(index, 1)[0].frame
  }

  /**
   * @param {number} channel
   * @param {number} value
   * @param {number} alpha
   * @returns {number}
   */
  applyLowpass(channel, value, alpha) {
    this.lowpassState[channel] = finiteOr(this.lowpassState[channel], value)
    this.lowpassState[channel] += alpha * (value - this.lowpassState[channel])
    return this.lowpassState[channel]
  }

  /**
   * @param {number} channel
   * @param {number} value
   * @param {number} alpha
   * @returns {number}
   */
  applyHighpass(channel, value, alpha) {
    this.highpassInput[channel] = finiteOr(this.highpassInput[channel], value)
    this.highpassState[channel] = finiteOr(this.highpassState[channel], value)
    const out =
      alpha *
      (this.highpassState[channel] + value - this.highpassInput[channel])

    this.highpassInput[channel] = value
    this.highpassState[channel] = out
    return out
  }

  /**
   * @param {Record<string, Float32Array>} params
   */
  queueFrames(params) {
    while (
      this.ready &&
      this.framePool.length > 0 &&
      this.inputRing.framesAvailable >= FRAME_SIZE
    ) {
      const projectedBufferedFrames =
        this.outputRing.framesAvailable + this.pendingFrames * FRAME_SIZE

      if (projectedBufferedFrames >= TARGET_BUFFERED_FRAMES) {
        break
      }

      const frame = this.framePool.pop()
      this.inputRing.pull(frame)
      const dryFrame = this.takeDryFrame()
      dryFrame[0].set(frame[0])
      dryFrame[1].set(frame[1])
      const frameId = this.nextFrameId
      this.nextFrameId += 1
      this.pendingDryFrames.push({
        id: frameId,
        frame: dryFrame,
      })

      const drive = dbToGain(params.drive[0])
      if (drive !== 1) {
        for (let i = 0; i < FRAME_SIZE; i++) {
          frame[0][i] *= drive
          frame[1][i] *= drive
        }
      }

      this.pendingFrames += 1

      this.port.postMessage(
        {
          type: "process-frame",
          frameId,
          bitrate: snapBladeBitrate(Math.round(params.bitrate[0])),
          quality: params.quality[0],
          bias: params.bias[0],
          feedback: params.feedback[0],
          glitch: params.glitch[0],
          leftBuffer: frame[0].buffer,
          rightBuffer: frame[1].buffer,
        },
        [frame[0].buffer, frame[1].buffer],
      )
    }
  }

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   * @param {Record<string, Float32Array>} params
   */
  process([input], [output], params) {
    if (!input || input.length === 0) return this.running

    const inputLeft = input?.[0] ?? zeroFrame
    const inputRight = input?.[1] ?? inputLeft
    const outputLeft = output[0]
    const outputRight = output[1] ?? output[0]

    this.inputDrops += pushKeepingLatest(this.inputRing, [
      inputLeft,
      inputRight,
    ])
    this.inputDrops += pushKeepingLatest(this.dryRing, [inputLeft, inputRight])
    this.queueFrames(params)
    this.alignDryRing()

    const bufferedFrames = this.outputRing.framesAvailable
    if (
      !this.wetActive &&
      bufferedFrames >= BLADE_LATENCY_SAMPLES &&
      !this.bypass
    ) {
      this.wetActive = true
      this.useDelayedDryFallback = false
    }

    if (this.wetActive && bufferedFrames < QUANTUM_SIZE) {
      this.wetActive = false
      this.useDelayedDryFallback = true
      this.underruns += 1
    }

    if (this.wetActive && bufferedFrames > MAX_BUFFERED_FRAMES) {
      const trimFrames = bufferedFrames - TARGET_BUFFERED_FRAMES
      dropOldestFrames(this.outputRing, trimFrames)
      dropOldestFrames(this.alignedDryRing, trimFrames)
      this.latencyTrims += trimFrames
      this.alignDryRing()
    }

    const hasWetFrame =
      this.wetActive &&
      this.outputRing.framesAvailable >= QUANTUM_SIZE &&
      this.alignedDryRing.framesAvailable >= QUANTUM_SIZE
    const hasDelayedDryFrame = this.dryRing.framesAvailable >= QUANTUM_SIZE

    if (hasWetFrame) {
      this.outputRing.pull(this.renderBuffer)
      if (this.alignedDryRing.framesAvailable >= QUANTUM_SIZE) {
        this.alignedDryRing.pull(this.dryBuffer)
      } else if (hasDelayedDryFrame) {
        this.dryRing.pull(this.dryBuffer)
      } else {
        this.dryBuffer[0].set(inputLeft)
        this.dryBuffer[1].set(inputRight)
      }
    } else if (this.useDelayedDryFallback && hasDelayedDryFrame) {
      this.dryRing.pull(this.dryBuffer)
      this.renderBuffer[0].set(this.dryBuffer[0])
      this.renderBuffer[1].set(this.dryBuffer[1])
    } else {
      this.renderBuffer[0].set(inputLeft)
      this.renderBuffer[1].set(inputRight)
      this.dryBuffer[0].set(inputLeft)
      this.dryBuffer[1].set(inputRight)
    }

    const highCut = clampFrequency(finiteOr(params.highCut[0], 18_000))
    const lowCut = clampFrequency(finiteOr(params.lowCut[0], 20))
    const dt = 1 / sampleRate
    const lowpassAlpha = dt / (1 / (Math.PI * 2 * highCut) + dt)
    const highpassAlpha =
      1 / (Math.PI * 2 * lowCut) / (1 / (Math.PI * 2 * lowCut) + dt)
    const makeupGain = dbToGain(finiteOr(params.makeupGain[0], 0))
    const mix = finiteOr(params.mix[0], 1)
    const targetMix = hasWetFrame && !this.bypass ? mix : 0
    this.mixState += (targetMix - this.mixState) * MIX_SLEW
    if (
      !hasWetFrame &&
      this.useDelayedDryFallback &&
      this.mixState <= MIX_EPSILON
    ) {
      this.useDelayedDryFallback = false
    }
    const wetMix = this.mixState
    const feedback = finiteOr(params.feedback[0], 0)
    const allowInfiniteFeedback = feedback >= FULL_FEEDBACK_BYPASS_THRESHOLD
    const inputPeak = peakAbsStereo(inputLeft, inputRight)
    let wetPeak = 0

    for (let i = 0; i < QUANTUM_SIZE; i++) {
      const dryLeft = finiteOr(this.dryBuffer[0][i], inputLeft[i] ?? 0)
      const dryRight = finiteOr(this.dryBuffer[1][i], inputRight[i] ?? dryLeft)
      const renderLeft = finiteOr(this.renderBuffer[0][i], dryLeft)
      const renderRight = finiteOr(this.renderBuffer[1][i], dryRight)

      let wetLeft = this.applyLowpass(0, renderLeft, lowpassAlpha)
      wetLeft = this.applyHighpass(0, wetLeft, highpassAlpha) * makeupGain
      wetLeft = finiteOr(wetLeft, dryLeft)

      let wetRight = this.applyLowpass(1, renderRight, lowpassAlpha)
      wetRight = this.applyHighpass(1, wetRight, highpassAlpha) * makeupGain
      wetRight = finiteOr(wetRight, dryRight)

      this.wetBuffer[0][i] = wetLeft
      this.wetBuffer[1][i] = wetRight
      wetPeak = Math.max(wetPeak, Math.abs(wetLeft), Math.abs(wetRight))

      outputLeft[i] = dryLeft
      outputRight[i] = dryRight
    }

    const silentFeedbackTail =
      hasWetFrame &&
      !this.bypass &&
      wetMix > MIX_EPSILON &&
      !allowInfiniteFeedback &&
      feedback >= FEEDBACK_TAIL_GUARD_THRESHOLD &&
      inputPeak <= INPUT_SILENCE_THRESHOLD

    const tailGuardTarget =
      silentFeedbackTail && wetPeak > FEEDBACK_TAIL_PEAK_LIMIT
        ? FEEDBACK_TAIL_PEAK_LIMIT / wetPeak
        : 1

    if (tailGuardTarget < this.feedbackTailGuardGain) {
      this.feedbackTailGuardGain = tailGuardTarget
      this.feedbackTailGuardClamps += 1
    } else {
      this.feedbackTailGuardGain +=
        (tailGuardTarget - this.feedbackTailGuardGain) *
        FEEDBACK_TAIL_GUARD_RELEASE
    }

    this.feedbackTailGuardActive =
      silentFeedbackTail && this.feedbackTailGuardGain < 0.999
    this.feedbackTailGuardPeak = wetPeak
    this.feedbackTailInputPeak = inputPeak
    const wetGuard = hasWetFrame ? this.feedbackTailGuardGain : 1

    for (let i = 0; i < QUANTUM_SIZE; i++) {
      const dryLeft = outputLeft[i]
      const dryRight = outputRight[i]
      const wetLeft = this.wetBuffer[0][i] * wetGuard
      const wetRight = this.wetBuffer[1][i] * wetGuard

      outputLeft[i] = dryLeft + (wetLeft - dryLeft) * wetMix
      outputRight[i] = dryRight + (wetRight - dryRight) * wetMix
    }

    this.blockCount += 1
    if ((this.blockCount & (STATS_INTERVAL - 1)) === 0) {
      this.port.postMessage({
        type: "stats",
        source: "processor",
        stats: {
          ready: this.ready,
          bypass: this.bypass,
          wetActive: this.wetActive,
          pendingFrames: this.pendingFrames,
          bufferedFrames: this.outputRing.framesAvailable,
          alignedDryBufferedFrames: this.alignedDryRing.framesAvailable,
          dryBufferedFrames: this.dryRing.framesAvailable,
          dryTargetFrames: this.dryTargetFrames,
          dryAlignmentDrops: this.dryAlignmentDrops,
          alignedDryDrops: this.alignedDryDrops,
          pendingDryFrames: this.pendingDryFrames.length,
          pendingDryMisses: this.pendingDryMisses,
          mixState: this.mixState,
          feedbackTailGuardActive: this.feedbackTailGuardActive,
          feedbackTailGuardGain: this.feedbackTailGuardGain,
          feedbackTailGuardClamps: this.feedbackTailGuardClamps,
          feedbackTailInputPeak: this.feedbackTailInputPeak,
          feedbackTailPeak: this.feedbackTailGuardPeak,
          underruns: this.underruns,
          inputDrops: this.inputDrops,
          outputDrops: this.outputDrops,
          latencyTrims: this.latencyTrims,
          receivedFrames: this.receivedFrames,
        },
      })
    }

    return this.running
  }
}

AudioProcessor.define(NAME, MP3SimulatorProcessor)
