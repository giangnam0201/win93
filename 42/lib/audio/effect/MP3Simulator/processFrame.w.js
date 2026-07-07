import {
  BAND_REASSIGNMENT_ACTIVE_BANDS,
  BladeCodec,
  loadBladeModule,
  normalizeBandReassignments,
  snapBladeBitrate,
} from "../../../../../c/libs/blade/blade-runtime.js"

const FRAME_SIZE = 1152
const STATS_INTERVAL = 8
const PRIME_FRAME_COUNT = 2
const INPUT_HISTORY_LIMIT = 2
const WET_HISTORY_LIMIT = 8
const FRAME_CROSSFADE_SAMPLES = 64
const RECONFIGURE_CROSSFADE_FRAMES = 4
const CLICK_SPIKE_THRESHOLD = 0.08
const INPUT_SILENCE_THRESHOLD = 1e-4
const SILENCE_RESET_FRAMES = 6
const FULL_FEEDBACK_BYPASS_THRESHOLD = 0.9999
const zeroLeft = new Float32Array(FRAME_SIZE)
const zeroRight = new Float32Array(FRAME_SIZE)

/**
 * @param {Float32Array} samples
 * @returns {boolean}
 */
function hasFiniteSamples(samples) {
  for (let index = 0; index < samples.length; index++) {
    if (!Number.isFinite(samples[index])) return false
  }

  return true
}

/**
 * @param {Float32Array} left
 * @param {Float32Array} right
 * @returns {number}
 */
function peakAbsStereo(left, right) {
  let peak = 0

  for (let index = 0; index < left.length; index++) {
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]))
  }

  return peak
}

class PCMFrameQueue {
  constructor() {
    this.chunks = []
    this.readOffset = 0
    this.framesAvailable = 0
  }

  reset() {
    this.chunks.length = 0
    this.readOffset = 0
    this.framesAvailable = 0
  }

  /**
   * @param {Float32Array} left
   * @param {Float32Array} right
   */
  push(left, right) {
    const frames = Math.min(left.length, right.length)
    if (frames <= 0) return

    this.chunks.push({
      left: left.subarray(0, frames),
      right: right.subarray(0, frames),
      frames,
    })
    this.framesAvailable += frames
  }

  /**
   * @param {Float32Array} left
   * @param {Float32Array} right
   * @returns {boolean}
   */
  pull(left, right) {
    if (this.framesAvailable < left.length || left.length !== right.length) {
      return false
    }

    let written = 0

    while (written < left.length && this.chunks.length > 0) {
      const chunk = this.chunks[0]
      const available = chunk.frames - this.readOffset
      const count = Math.min(left.length - written, available)

      left.set(
        chunk.left.subarray(this.readOffset, this.readOffset + count),
        written,
      )
      right.set(
        chunk.right.subarray(this.readOffset, this.readOffset + count),
        written,
      )

      written += count
      this.readOffset += count

      if (this.readOffset >= chunk.frames) {
        this.chunks.shift()
        this.readOffset = 0
      }
    }

    this.framesAvailable -= written
    return written === left.length
  }
}

/**
 * @param {Float32Array} samples
 * @returns {number}
 */
function repairClickSpikes(samples) {
  let repaired = 0

  for (let index = 1; index < samples.length - 1; index++) {
    const prev = samples[index - 1]
    const curr = samples[index]
    const next = samples[index + 1]
    const jumpIn = Math.abs(curr - prev)
    const jumpOut = Math.abs(curr - next)
    const bridge = Math.abs(next - prev)
    const localExtremum = (curr - prev) * (curr - next) > 0
    const threshold = Math.max(CLICK_SPIKE_THRESHOLD, bridge * 6)

    if (localExtremum && jumpIn > threshold && jumpOut > threshold) {
      samples[index] = (prev + next) * 0.5
      repaired += 1
    }
  }

  return repaired
}

/**
 * @param {Float32Array} outLeft
 * @param {Float32Array} outRight
 * @param {Float32Array} fromLeft
 * @param {Float32Array} fromRight
 * @param {Float32Array} toLeft
 * @param {Float32Array} toRight
 * @param {number} startMix
 * @param {number} endMix
 */
function crossfadeWetToWet(
  outLeft,
  outRight,
  fromLeft,
  fromRight,
  toLeft,
  toRight,
  startMix,
  endMix,
) {
  for (let index = 0; index < FRAME_SIZE; index++) {
    const t = index / Math.max(1, FRAME_SIZE - 1)
    const mix = startMix + (endMix - startMix) * t
    const fromLeftSample = fromLeft[index]
    const fromRightSample = fromRight[index]
    outLeft[index] = fromLeftSample + (toLeft[index] - fromLeftSample) * mix
    outRight[index] = fromRightSample + (toRight[index] - fromRightSample) * mix
  }
}

class CodecPipeline {
  /**
   * @param {{
   *   module: Awaited<ReturnType<typeof loadBladeModule>>
   *   sampleRate: number
   *   bitrate: number
   *   label: "active" | "staging"
   * }} options
   */
  constructor({ module, sampleRate, bitrate, label }) {
    this.module = module
    this.sampleRate = sampleRate
    this.requestedBitrate = bitrate
    this.bitrate = snapBladeBitrate(bitrate)
    this.label = label
    this.codec = undefined
    this.decoder = undefined
    this.previousLastLeft = undefined
    this.previousLastRight = undefined
  }

  async init() {
    this.codec = new BladeCodec(this.module, this.sampleRate, this.bitrate)
    this.decoder = new MP3FrameDecoder(this.sampleRate)
    await this.primeWithSilence(PRIME_FRAME_COUNT)
  }

  /**
   * @param {number} frameCount
   */
  async primeWithSilence(frameCount) {
    if (!this.codec || !this.decoder) return

    this.resetSmoothing()

    for (let index = 0; index < frameCount; index++) {
      zeroLeft.fill(0)
      zeroRight.fill(0)

      const encoded = this.codec.encode(zeroLeft, zeroRight, {
        bitrate: this.bitrate,
        quality: 1,
        bias: 0,
        feedback: 0,
        glitch: 0,
      })

      const decodedLeft = new Float32Array(FRAME_SIZE)
      const decodedRight = new Float32Array(FRAME_SIZE)
      await this.decoder.decode(encoded, decodedLeft, decodedRight)
    }
  }

  /**
   * @param {{ left: Float32Array, right: Float32Array }[]} historyFrames
   * @param {{ quality: number, bias: number, feedback: number, glitch: number, bandReassignments?: ArrayLike<number> }} params
   * @returns {Promise<boolean>}
   */
  async replayHistory(historyFrames, params) {
    for (const frame of historyFrames) {
      const result = await this.process(frame.left, frame.right, params)
      if (!result.valid) {
        return false
      }
    }

    return true
  }

  resetSmoothing() {
    this.previousLastLeft = undefined
    this.previousLastRight = undefined
  }

  destroy() {
    this.codec?.destroy()
    this.decoder?.close()
    this.codec = undefined
    this.decoder = undefined
    this.resetSmoothing()
  }

  async resetStream() {
    if (!this.codec || !this.decoder) return

    this.codec.resetState()
    this.decoder.reset()
    await this.primeWithSilence(PRIME_FRAME_COUNT)
  }

  /**
   * @param {Float32Array} leftInput
   * @param {Float32Array} rightInput
   * @param {{ quality: number, bias: number, feedback: number, glitch: number, bandReassignments?: ArrayLike<number> }} params
   */
  async process(leftInput, rightInput, params) {
    if (!this.codec || !this.decoder) {
      throw new Error(`${this.label} pipeline is not initialized`)
    }

    const left = leftInput.slice()
    const right = rightInput.slice()
    const encoded = this.codec.encode(left, right, {
      bitrate: this.bitrate,
      quality: params.quality,
      bias: params.bias,
      feedback: params.feedback,
      glitch: params.glitch,
      bandReassignments: params.bandReassignments,
    })

    const decoded = await this.decoder.decode(encoded, left, right)
    const valid = decoded && hasFiniteSamples(left) && hasFiniteSamples(right)

    if (!valid) {
      this.resetSmoothing()
      left.set(leftInput)
      right.set(rightInput)
      return {
        valid: false,
        left,
        right,
        encodedBytes: encoded.byteLength,
        decodedFrames: decoded ? FRAME_SIZE : 0,
        decoderBufferedFrames: this.decoder.pcmQueue.framesAvailable,
        enqueuedFrames: this.decoder.lastEnqueuedFrames,
        outputFormat: this.decoder.lastOutputFormat,
        boundaryJump: 0,
        repairedSpikes: 0,
      }
    }

    const boundaryJump = this.smoothFrameBoundary(left, right)
    const repairedSpikes = repairClickSpikes(left) + repairClickSpikes(right)

    return {
      valid: true,
      left,
      right,
      encodedBytes: encoded.byteLength,
      decodedFrames: FRAME_SIZE,
      decoderBufferedFrames: this.decoder.pcmQueue.framesAvailable,
      enqueuedFrames: this.decoder.lastEnqueuedFrames,
      outputFormat: this.decoder.lastOutputFormat,
      boundaryJump,
      repairedSpikes,
    }
  }

  /**
   * @param {Float32Array} left
   * @param {Float32Array} right
   * @returns {number}
   */
  smoothFrameBoundary(left, right) {
    let boundaryJump = 0

    if (
      Number.isFinite(this.previousLastLeft) &&
      Number.isFinite(this.previousLastRight)
    ) {
      const leftDelta = this.previousLastLeft - left[0]
      const rightDelta = this.previousLastRight - right[0]
      boundaryJump = Math.max(Math.abs(leftDelta), Math.abs(rightDelta))

      for (let index = 0; index < FRAME_CROSSFADE_SAMPLES; index++) {
        const decay = 1 - index / FRAME_CROSSFADE_SAMPLES
        left[index] += leftDelta * decay
        right[index] += rightDelta * decay
      }
    }

    this.previousLastLeft = left[FRAME_SIZE - 1]
    this.previousLastRight = right[FRAME_SIZE - 1]
    return boundaryJump
  }
}

class MP3FrameDecoder {
  /**
   * @param {number} sampleRate
   */
  constructor(sampleRate) {
    this.sampleRate = sampleRate
    this.frameIndex = 0
    this.chunkIndex = 0
    this.pcmQueue = new PCMFrameQueue()
    this.lastEnqueuedFrames = 0
    this.lastOutputFormat = ""
    this.error = undefined
    this.waiters = []
    this.supported = Boolean(
      globalThis.AudioDecoder && globalThis.EncodedAudioChunk,
    )

    if (!this.supported) {
      return
    }

    this.decoder = new AudioDecoder({
      output: (audioData) => {
        this.enqueueAudioData(audioData)
        this.resolveWaiters()
      },
      error: (error) => {
        this.error = error
        this.resolveWaiters()
      },
    })

    this.decoder.configure({
      codec: "mp3",
      sampleRate,
      numberOfChannels: 2,
    })
  }

  reset() {
    this.frameIndex = 0
    this.chunkIndex = 0
    this.lastEnqueuedFrames = 0
    this.lastOutputFormat = ""
    this.error = undefined
    this.resolveAllWaiters(false)
    this.pcmQueue.reset()
    this.decoder?.reset()
    this.decoder?.configure({
      codec: "mp3",
      sampleRate: this.sampleRate,
      numberOfChannels: 2,
    })
  }

  /**
   * @param {AudioData} audioData
   * @param {number} planeIndex
   * @returns {Float32Array}
   */
  copyPlane(audioData, planeIndex) {
    try {
      const size = audioData.allocationSize({
        planeIndex,
        format: "f32-planar",
      })
      const channel = new Float32Array(size / Float32Array.BYTES_PER_ELEMENT)
      audioData.copyTo(channel, {
        planeIndex,
        format: "f32-planar",
      })
      return channel
    } catch {
      const size = audioData.allocationSize({ planeIndex })
      const nativeFormat = audioData.format ?? "f32-planar"

      if (nativeFormat.startsWith("s16")) {
        const channel = new Int16Array(size / Int16Array.BYTES_PER_ELEMENT)
        audioData.copyTo(channel, { planeIndex })
        const normalized = new Float32Array(channel.length)
        for (let index = 0; index < channel.length; index++) {
          normalized[index] = channel[index] / 32768
        }
        return normalized
      }

      const channel = new Float32Array(size / Float32Array.BYTES_PER_ELEMENT)
      audioData.copyTo(channel, { planeIndex })
      return channel
    }
  }

  /**
   * @param {AudioData} audioData
   */
  enqueueAudioData(audioData) {
    this.lastOutputFormat = audioData.format ?? this.lastOutputFormat

    const channelLeft = this.copyPlane(audioData, 0)
    let channelRight
    if (audioData.numberOfChannels > 1) {
      channelRight = this.copyPlane(audioData, 1)
    } else {
      channelRight = new Float32Array(channelLeft.length)
      channelRight.set(channelLeft)
    }

    const frames = Math.min(
      audioData.numberOfFrames,
      channelLeft.length,
      channelRight.length,
    )

    this.pcmQueue.push(
      channelLeft.subarray(0, frames),
      channelRight.subarray(0, frames),
    )
    this.lastEnqueuedFrames += frames
    audioData.close()
  }

  /**
   * @param {number} frames
   * @returns {Promise<boolean>}
   */
  waitForFrames(frames) {
    if (this.pcmQueue.framesAvailable >= frames) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const waiter = {
        frames,
        resolve: (ready) => resolve(ready),
      }

      this.waiters.push(waiter)

      const timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter)
        if (index !== -1) this.waiters.splice(index, 1)
        resolve(this.pcmQueue.framesAvailable >= frames)
      }, 250)

      waiter.resolve = (ready) => {
        clearTimeout(timer)
        resolve(ready)
      }
    })
  }

  resolveWaiters() {
    for (let index = this.waiters.length - 1; index >= 0; index--) {
      const waiter = this.waiters[index]
      if (this.error || this.pcmQueue.framesAvailable >= waiter.frames) {
        this.waiters.splice(index, 1)
        waiter.resolve(
          !this.error && this.pcmQueue.framesAvailable >= waiter.frames,
        )
      }
    }
  }

  /**
   * @param {boolean} ready
   */
  resolveAllWaiters(ready) {
    while (this.waiters.length > 0) {
      this.waiters.pop().resolve(ready)
    }
  }

  /**
   * @param {Uint8Array} bytes
   * @param {Float32Array} left
   * @param {Float32Array} right
   * @returns {Promise<boolean>}
   */
  async decode(bytes, left, right) {
    if (!this.supported || !this.decoder || bytes.byteLength === 0) {
      return false
    }

    this.error = undefined
    this.lastEnqueuedFrames = 0

    const timestamp = Math.round(
      (this.frameIndex / this.sampleRate) * 1_000_000,
    )
    const duration = Math.round((FRAME_SIZE / this.sampleRate) * 1_000_000)
    const chunkType = this.chunkIndex === 0 ? "key" : "delta"
    this.frameIndex += FRAME_SIZE
    this.chunkIndex += 1

    this.decoder.decode(
      new EncodedAudioChunk({
        type: chunkType,
        timestamp,
        duration,
        data: bytes,
      }),
    )

    const ready = await this.waitForFrames(FRAME_SIZE)

    if (this.error) {
      throw this.error
    }

    left.fill(0)
    right.fill(0)
    return ready && this.pcmQueue.pull(left, right)
  }

  close() {
    this.resolveAllWaiters(false)
    this.pcmQueue.reset()
    this.decoder?.close()
  }
}

const state = {
  sampleRate: 44100,
  bladeModule: undefined,
  activePipeline: undefined,
  stagingPipeline: undefined,
  bypass: false,
  desiredBitrate: 128,
  deferredBitrate: 0,
  transition: {
    mode: "idle",
    framesRemaining: 0,
    framesTotal: 0,
    targetBitrate: 128,
    generation: 0,
  },
  recentInputFrames: [],
  recentWetFrames: [],
  silence: {
    consecutiveFrames: 0,
    streamIdle: false,
  },
  bandReassignments: normalizeBandReassignments(),
  stats: {
    encodedFrames: 0,
    decodedFrames: 0,
    fallbackFrames: 0,
    invalidFrames: 0,
    reconfigures: 0,
    recoveries: 0,
    lastEncodedBytes: 0,
    lastDecodedFrames: 0,
    lastEnqueuedFrames: 0,
    lastOutputFormat: "",
    lastStatus: "booting",
    requestedBitrate: 128,
    desiredBitrate: 128,
    activeBitrate: 128,
    stagedBitrate: 0,
    deferredBitrate: 0,
    boundarySmoothing: FRAME_CROSSFADE_SAMPLES,
    decoderBufferedFrames: 0,
    lastBoundaryJump: 0,
    maxBoundaryJump: 0,
    repairedSpikes: 0,
    lastRepairedSpikes: 0,
    transitionMode: "idle",
    transitionFramesRemaining: 0,
    transitionGeneration: 0,
    transitionStarts: 0,
    transitionCompletes: 0,
    transitionCancels: 0,
    stagingReplays: 0,
    activeFallbackFrames: 0,
    stagingInvalidFrames: 0,
    wetToWetCrossfades: 0,
    silentInputPeak: 0,
    silentFrames: 0,
    silenceResets: 0,
    streamIdle: false,
    bandReassignments: Array.from(
      { length: BAND_REASSIGNMENT_ACTIVE_BANDS },
      (_, index) => index,
    ),
  },
}

let queue = Promise.resolve()

function postStats() {
  postMessage({
    type: "stats",
    source: "worker",
    stats: {
      ...state.stats,
      bypass: state.bypass,
      bitrate: state.activePipeline?.bitrate ?? state.desiredBitrate,
    },
  })
}

function maybePostStats() {
  if ((state.stats.encodedFrames & (STATS_INTERVAL - 1)) === 0) {
    postStats()
  }
}

/**
 * @param {{ left: Float32Array, right: Float32Array }[]} history
 * @param {{ left: Float32Array, right: Float32Array }} frame
 * @param {number} limit
 */
function rememberHistoryFrame(history, frame, limit) {
  history.push({
    left: frame.left.slice(),
    right: frame.right.slice(),
  })

  if (history.length > limit) {
    history.splice(0, history.length - limit)
  }
}

/**
 * @param {{ left: Float32Array, right: Float32Array }} frame
 */
function rememberRecentInput(frame) {
  rememberHistoryFrame(state.recentInputFrames, frame, INPUT_HISTORY_LIMIT)
}

/**
 * @param {{ left: Float32Array, right: Float32Array }} frame
 */
function rememberRecentWet(frame) {
  rememberHistoryFrame(state.recentWetFrames, frame, WET_HISTORY_LIMIT)
}

/**
 * @param {string} mode
 */
function setTransitionMode(mode) {
  state.transition.mode = mode
  state.stats.transitionMode = mode
}

function resetTransitionState() {
  state.transition.framesRemaining = 0
  state.transition.framesTotal = 0
  state.transition.targetBitrate =
    state.activePipeline?.bitrate ?? state.desiredBitrate
  state.stats.transitionFramesRemaining = 0
  state.stats.stagedBitrate = 0

  if (
    state.deferredBitrate !== 0 &&
    state.deferredBitrate === (state.activePipeline?.bitrate ?? 0)
  ) {
    state.deferredBitrate = 0
    state.stats.deferredBitrate = 0
  }

  setTransitionMode("idle")
}

function resetSilenceState() {
  state.silence.consecutiveFrames = 0
  state.silence.streamIdle = false
  state.stats.streamIdle = false
}

function destroyStagingPipeline() {
  state.stagingPipeline?.destroy()
  state.stagingPipeline = undefined
  state.stats.stagedBitrate = 0
}

async function resetCodecStream(reason) {
  destroyStagingPipeline()
  cancelStagingTransition()

  await state.activePipeline?.resetStream()

  state.recentInputFrames.length = 0
  state.recentWetFrames.length = 0
  state.silence.streamIdle = true
  state.stats.streamIdle = true
  state.stats.silenceResets += 1
  state.stats.lastStatus = reason

  postMessage({
    type: "stream-reset",
    reason,
    bitrate: state.activePipeline?.bitrate ?? state.desiredBitrate,
  })
}

function cancelStagingTransition() {
  const hadTransition =
    state.transition.mode !== "idle" ||
    Boolean(state.stagingPipeline) ||
    state.transition.targetBitrate !==
      (state.activePipeline?.bitrate ?? state.desiredBitrate)

  if (!hadTransition) return

  state.stats.transitionCancels += 1
  state.transition.generation += 1
  state.stats.transitionGeneration = state.transition.generation
  destroyStagingPipeline()
  resetTransitionState()
}

/**
 * @param {number} bitrate
 * @param {"active" | "staging"} label
 */
async function createPipeline(bitrate, label) {
  state.bladeModule ??= await loadBladeModule()

  const pipeline = new CodecPipeline({
    module: state.bladeModule,
    sampleRate: state.sampleRate,
    bitrate,
    label,
  })
  await pipeline.init()
  return pipeline
}

function beginCrossfade() {
  state.transition.framesRemaining = RECONFIGURE_CROSSFADE_FRAMES
  state.transition.framesTotal = RECONFIGURE_CROSSFADE_FRAMES
  state.stats.transitionFramesRemaining = state.transition.framesRemaining
  setTransitionMode("crossfading")
}

function promoteStagingPipeline() {
  const oldActive = state.activePipeline
  const nextActive = state.stagingPipeline

  if (!nextActive) return

  nextActive.label = "active"
  state.activePipeline = nextActive
  state.stagingPipeline = undefined
  oldActive?.destroy()
  state.stats.transitionCompletes += 1
  state.stats.activeBitrate = nextActive.bitrate
  resetTransitionState()
}

/**
 * @param {ReturnType<CodecPipeline["process"]> extends Promise<infer T> ? T : never} result
 */
function updateRenderStats(result) {
  state.stats.encodedFrames += 1
  state.stats.lastEncodedBytes = result.encodedBytes
  state.stats.lastDecodedFrames = result.decodedFrames
  state.stats.lastEnqueuedFrames = result.enqueuedFrames
  state.stats.decoderBufferedFrames = result.decoderBufferedFrames
  state.stats.lastOutputFormat =
    result.outputFormat || state.stats.lastOutputFormat
  state.stats.lastBoundaryJump = result.boundaryJump
  state.stats.maxBoundaryJump = Math.max(
    state.stats.maxBoundaryJump,
    result.boundaryJump,
  )
  state.stats.lastRepairedSpikes = result.repairedSpikes
  state.stats.repairedSpikes += result.repairedSpikes

  if (result.valid) {
    state.stats.decodedFrames += 1
    return
  }

  state.stats.fallbackFrames += 1
  state.stats.invalidFrames += 1
}

/**
 * @param {number} frameId
 * @param {Float32Array} left
 * @param {Float32Array} right
 */
function postProcessedFrame(frameId, left, right) {
  postMessage(
    {
      type: "processed-frame",
      frameId,
      leftBuffer: left.buffer,
      rightBuffer: right.buffer,
    },
    [left.buffer, right.buffer],
  )
}

/**
 * @param {number} frameId
 * @param {{ left: Float32Array, right: Float32Array }} input
 */
function postDryFrame(frameId, input) {
  state.stats.lastStatus = "bypass"
  postProcessedFrame(frameId, input.left.slice(), input.right.slice())
}

/**
 * @param {number} sampleRate
 * @param {number} bitrate
 */
async function init(sampleRate, bitrate) {
  state.sampleRate = sampleRate
  state.deferredBitrate = 0
  resetSilenceState()
  state.stats.requestedBitrate = bitrate
  state.stats.desiredBitrate = bitrate
  state.stats.deferredBitrate = 0
  state.desiredBitrate = snapBladeBitrate(bitrate)

  try {
    state.activePipeline = await createPipeline(bitrate, "active")
    state.bypass = false
    state.stats.activeBitrate = state.activePipeline.bitrate
    state.stats.lastStatus = "ready"
    resetTransitionState()
    state.stats.lastStatus = "ready"
  } catch (error) {
    state.activePipeline?.destroy()
    destroyStagingPipeline()
    state.activePipeline = undefined
    state.bypass = true
    state.stats.lastStatus = "bypass"
    postMessage({
      type: "log",
      level: "warn",
      message: error instanceof Error ? error.message : String(error),
    })
  }

  postMessage({ type: "ready", bypass: state.bypass })
  postStats()
}

/**
 * @param {ArrayLike<number> | undefined} values
 */
function setBandReassignments(values) {
  state.bandReassignments = normalizeBandReassignments(values)
  state.stats.bandReassignments = Array.from(
    state.bandReassignments.subarray(0, BAND_REASSIGNMENT_ACTIVE_BANDS),
  )
}

/**
 * @param {number} targetBitrate
 * @param {{ quality: number, bias: number, feedback: number, glitch: number }} params
 */
async function ensureStagingPipeline(targetBitrate, params) {
  if (!state.activePipeline || targetBitrate === state.activePipeline.bitrate) {
    cancelStagingTransition()
    return
  }

  const allowInfiniteFeedback =
    Math.min(
      1,
      Math.max(0, Number.isFinite(params.feedback) ? params.feedback : 0),
    ) >= FULL_FEEDBACK_BYPASS_THRESHOLD

  if (state.stagingPipeline?.bitrate === targetBitrate) {
    state.transition.targetBitrate = targetBitrate
    state.stats.stagedBitrate = targetBitrate
    if (state.transition.mode === "idle") {
      setTransitionMode("staging")
    }
    return
  }

  cancelStagingTransition()
  state.transition.generation += 1
  state.transition.targetBitrate = targetBitrate
  state.stats.transitionGeneration = state.transition.generation
  state.stats.transitionStarts += 1
  state.stats.reconfigures += 1
  setTransitionMode("staging")

  const generation = state.transition.generation

  try {
    const stagingPipeline = await createPipeline(targetBitrate, "staging")
    if (generation !== state.transition.generation) {
      stagingPipeline.destroy()
      return
    }

    state.stagingPipeline = stagingPipeline
    state.stats.stagedBitrate = stagingPipeline.bitrate
    const transitionHistory =
      allowInfiniteFeedback && state.recentWetFrames.length > 0
        ? state.recentWetFrames
        : state.recentInputFrames

    state.stats.stagingReplays += transitionHistory.length

    const replayed = await stagingPipeline.replayHistory(
      transitionHistory,
      params,
    )

    if (generation !== state.transition.generation) {
      stagingPipeline.destroy()
      if (state.stagingPipeline === stagingPipeline) {
        state.stagingPipeline = undefined
        state.stats.stagedBitrate = 0
      }
      return
    }

    if (!replayed) {
      state.stats.stagingInvalidFrames += 1
      destroyStagingPipeline()
      setTransitionMode("idle")
    }
  } catch (error) {
    destroyStagingPipeline()
    setTransitionMode("idle")
    postMessage({
      type: "log",
      level: "warn",
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * @param {string} reason
 * @param {number} [bitrate]
 */
async function recoverCodec(reason, bitrate = state.desiredBitrate) {
  state.stats.recoveries += 1
  state.stats.lastStatus = "recovering"
  state.transition.generation += 1
  state.stats.transitionGeneration = state.transition.generation
  setTransitionMode("recovering")

  postMessage({
    type: "log",
    level: "warn",
    message: `Recovering Blade codec after ${reason}`,
  })

  postMessage({
    type: "stream-reset",
    reason: "recovery",
    bitrate: snapBladeBitrate(bitrate),
  })

  try {
    destroyStagingPipeline()
    state.activePipeline?.destroy()
    state.activePipeline = await createPipeline(bitrate, "active")
    state.bypass = false
    state.desiredBitrate = state.activePipeline.bitrate
    state.recentInputFrames.length = 0
    state.recentWetFrames.length = 0
    state.stats.activeBitrate = state.activePipeline.bitrate
    resetTransitionState()
    state.stats.lastStatus = "recovered"
  } catch (error) {
    state.activePipeline?.destroy()
    destroyStagingPipeline()
    state.activePipeline = undefined
    state.bypass = true
    state.stats.lastStatus = "bypass"
    postMessage({
      type: "log",
      level: "warn",
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * @param {{
 *   frameId: number
 *   bitrate: number
 *   quality: number
 *   bias: number
 *   feedback: number
 *   glitch: number
 *   leftBuffer: ArrayBuffer
 *   rightBuffer: ArrayBuffer
 * }} data
 */
async function processFrame(data) {
  const input = {
    left: new Float32Array(data.leftBuffer),
    right: new Float32Array(data.rightBuffer),
  }
  const feedback = Math.min(
    1,
    Math.max(0, Number.isFinite(data.feedback) ? data.feedback : 0),
  )
  const allowInfiniteFeedback = feedback >= FULL_FEEDBACK_BYPASS_THRESHOLD
  const inputPeak = peakAbsStereo(input.left, input.right)
  const silentInput = inputPeak <= INPUT_SILENCE_THRESHOLD

  state.stats.silentInputPeak = inputPeak

  if (silentInput) {
    state.silence.consecutiveFrames += 1
    state.stats.silentFrames = state.silence.consecutiveFrames
  } else {
    resetSilenceState()
  }

  if (!silentInput) {
    rememberRecentInput(input)
  }

  const requestedBitrate = data.bitrate
  const snappedBitrate = snapBladeBitrate(requestedBitrate)

  state.stats.requestedBitrate = requestedBitrate
  state.stats.desiredBitrate = snappedBitrate
  state.desiredBitrate = snappedBitrate
  state.stats.activeBitrate = state.activePipeline?.bitrate ?? snappedBitrate
  state.stats.transitionGeneration = state.transition.generation

  if (state.activePipeline && snappedBitrate === state.activePipeline.bitrate) {
    state.deferredBitrate = 0
    state.stats.deferredBitrate = 0
  }

  if (
    state.activePipeline &&
    allowInfiniteFeedback &&
    snappedBitrate !== state.activePipeline.bitrate
  ) {
    state.deferredBitrate = snappedBitrate
    state.stats.deferredBitrate = snappedBitrate
  }

  if (state.bypass || !state.activePipeline) {
    postDryFrame(data.frameId, input)
    return
  }

  if (silentInput && state.silence.streamIdle) {
    state.stats.lastStatus = "silent-idle"
    postDryFrame(data.frameId, input)
    maybePostStats()
    return
  }

  try {
    const codecParams = {
      quality: data.quality,
      bias: data.bias,
      feedback: data.feedback,
      glitch: data.glitch,
      bandReassignments: state.bandReassignments,
    }

    if (
      !allowInfiniteFeedback &&
      silentInput &&
      state.silence.consecutiveFrames >= SILENCE_RESET_FRAMES
    ) {
      await resetCodecStream("silent-reset")
      postDryFrame(data.frameId, input)
      maybePostStats()
      return
    }

    const targetBitrate =
      state.deferredBitrate !== 0 ? state.deferredBitrate : snappedBitrate
    const shouldHoldDeferredBitrate =
      state.deferredBitrate !== 0 && (allowInfiniteFeedback || silentInput)

    if (shouldHoldDeferredBitrate) {
      if (state.stagingPipeline) {
        cancelStagingTransition()
      }
      state.stats.lastStatus = allowInfiniteFeedback
        ? "deferred-bitrate-feedback"
        : "deferred-bitrate-waiting-input"
    } else if (targetBitrate !== state.activePipeline.bitrate) {
      await ensureStagingPipeline(targetBitrate, codecParams)
    } else if (state.stagingPipeline) {
      cancelStagingTransition()
    }

    const activeResult = await state.activePipeline.process(
      input.left,
      input.right,
      codecParams,
    )
    updateRenderStats(activeResult)

    if (!activeResult.valid) {
      state.stats.activeFallbackFrames += 1
      state.stats.lastStatus = "active-fallback"
      postProcessedFrame(data.frameId, activeResult.left, activeResult.right)
      maybePostStats()
      return
    }

    rememberRecentWet({
      left: activeResult.left,
      right: activeResult.right,
    })

    if (!state.stagingPipeline || state.transition.mode === "idle") {
      state.stats.lastStatus = "wet"
      postProcessedFrame(data.frameId, activeResult.left, activeResult.right)
      maybePostStats()
      return
    }

    const stagedInput = allowInfiniteFeedback
      ? {
          left: activeResult.left,
          right: activeResult.right,
        }
      : input

    const stagedResult = await state.stagingPipeline.process(
      stagedInput.left,
      stagedInput.right,
      codecParams,
    )
    updateRenderStats(stagedResult)

    if (!stagedResult.valid) {
      state.stats.stagingInvalidFrames += 1
      state.stats.lastStatus = "staging-invalid"
      postProcessedFrame(data.frameId, activeResult.left, activeResult.right)
      maybePostStats()
      return
    }

    if (state.transition.mode === "staging") {
      beginCrossfade()
    }

    const transitionIndex =
      state.transition.framesTotal - state.transition.framesRemaining
    const startMix = transitionIndex / Math.max(1, state.transition.framesTotal)
    const endMix =
      (transitionIndex + 1) / Math.max(1, state.transition.framesTotal)

    crossfadeWetToWet(
      activeResult.left,
      activeResult.right,
      activeResult.left,
      activeResult.right,
      stagedResult.left,
      stagedResult.right,
      startMix,
      endMix,
    )

    state.transition.framesRemaining = Math.max(
      0,
      state.transition.framesRemaining - 1,
    )
    state.stats.transitionFramesRemaining = state.transition.framesRemaining
    state.stats.wetToWetCrossfades += 1
    state.stats.lastStatus = "crossfading"

    if (state.transition.framesRemaining === 0) {
      promoteStagingPipeline()
      state.stats.lastStatus = "wet"
    }

    postProcessedFrame(data.frameId, activeResult.left, activeResult.right)
    maybePostStats()
    return
  } catch (error) {
    state.stats.fallbackFrames += 1
    state.stats.lastStatus = "error"
    postMessage({
      type: "log",
      level: "warn",
      message: error instanceof Error ? error.message : String(error),
    })

    await recoverCodec(
      error instanceof Error ? error.message : String(error),
      requestedBitrate,
    )
  }

  postProcessedFrame(data.frameId, input.left.slice(), input.right.slice())
  maybePostStats()
}

globalThis.onmessage = ({ data }) => {
  if (data.type === "init") {
    queue = queue.then(() => init(data.sampleRate, data.bitrate))
    return
  }

  if (data.type === "band-reassignments") {
    queue = queue.then(() => {
      setBandReassignments(data.order)
      postStats()
    })
    return
  }

  if (data.type === "process-frame") {
    queue = queue.then(() => processFrame(data))
    return
  }

  if (data.type === "stop") {
    postStats()
    state.activePipeline?.destroy()
    destroyStagingPipeline()
    state.activePipeline = undefined
  }
}
