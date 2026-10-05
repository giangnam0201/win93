const FRAME_SIZE = 1152
const DEFAULT_OUTPUT_SIZE = Math.ceil(FRAME_SIZE * 1.25 + 7200)
export const BAND_REASSIGNMENT_ACTIVE_BANDS = 20
export const BAND_REASSIGNMENT_TOTAL_BANDS = 32
export const ALLOWED_BITRATES = Object.freeze([
  32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
])

let bladeFactoryPromise

/**
 * @param {number} value
 * @returns {number}
 */
function clampUnit(value) {
  return Math.min(1, Math.max(0, value))
}

/**
 * @param {number} value
 * @param {number} fallback
 * @param {number} max
 * @returns {number}
 */
function clampBandIndex(value, fallback, max) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(0, Math.round(value)))
}

/**
 * @param {ArrayLike<number> | undefined} [values]
 * @returns {Int32Array}
 */
export function normalizeBandReassignments(values) {
  const normalized = new Int32Array(BAND_REASSIGNMENT_TOTAL_BANDS)

  for (let index = 0; index < BAND_REASSIGNMENT_TOTAL_BANDS; index++) {
    normalized[index] = index
  }

  if (!values) return normalized

  const limit = Math.min(values.length ?? 0, BAND_REASSIGNMENT_ACTIVE_BANDS)
  const maxBandIndex = BAND_REASSIGNMENT_TOTAL_BANDS - 1

  for (let index = 0; index < limit; index++) {
    normalized[index] = clampBandIndex(values[index], index, maxBandIndex)
  }

  return normalized
}

/**
 * Map the UI's glitch amount to Blade's per-frame error bends.
 * Low values stay mostly clean and trigger short burst events only occasionally.
 * @param {number} glitch
 * @param {{ framesRemaining: number }} state
 * @returns {number}
 */
function mapGlitchToBladeError(glitch, state) {
  const amount = clampUnit(glitch)
  if (amount <= 0) {
    state.framesRemaining = 0
    return 0
  }

  const continuousAmount =
    amount <= 0.65 ? 0 : ((amount - 0.65) / 0.35) ** 2 * 0.6

  if (state.framesRemaining > 0) {
    state.framesRemaining -= 1
    return Math.max(continuousAmount, 0.06 + amount * 0.5)
  }

  if (amount <= 0.08) {
    return continuousAmount
  }

  const shiftedAmount = (amount - 0.08) / 0.92
  const burstChance = 0.002 + shiftedAmount ** 2 * 0.18
  if (Math.random() < burstChance) {
    state.framesRemaining = Math.max(0, Math.round(amount * 4) - 1)
    return Math.max(continuousAmount, 0.06 + amount * 0.5)
  }

  return continuousAmount
}

/**
 * @param {number} bitrate
 * @returns {number}
 */
export function snapBladeBitrate(bitrate) {
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
 * @returns {Promise<any>}
 */
export async function loadBladeModule() {
  bladeFactoryPromise ??= import("./blade.js").then(
    ({ default: createBlade }) => createBlade,
  )

  const createBlade = await bladeFactoryPromise

  return createBlade({
    locateFile: (path) => new URL(path, import.meta.url).href,
  })
}

/**
 * @typedef {{
 *   bitrate?: number
 *   quality?: number
 *   turbo?: number
 *   bias?: number
 *   thresholdBias?: number
 *   feedback?: number
 *   mdctFeedback?: number
 *   mdctfeedback?: number
 *   bandReassignments?: ArrayLike<number>
 *   glitch?: number
 *   error?: number
 * }} BladeRealtimeParams
 */

export class BladeCodec {
  /**
   * @param {any} module
   * @param {number} sampleRate
   * @param {number} bitrate
   */
  constructor(module, sampleRate, bitrate) {
    this.module = module
    this.sampleRate = sampleRate
    this.leftPtr = 0
    this.rightPtr = 0
    this.outputPtr = 0
    this.bandReassignmentPtr = 0
    this.outputSize =
      module._blade_get_max_output_size?.() ?? DEFAULT_OUTPUT_SIZE
    this.frameSize = module._blade_get_chunk_size(0) || FRAME_SIZE
    this.bitrate = 0
    this.handle = 0
    this.glitchState = { framesRemaining: 0 }
    this.bandReassignments = normalizeBandReassignments()
    this.#initPointers()
    this.setBitrate(bitrate)
  }

  #initPointers() {
    this.leftPtr = this.module._malloc(
      FRAME_SIZE * Float32Array.BYTES_PER_ELEMENT,
    )
    this.rightPtr = this.module._malloc(
      FRAME_SIZE * Float32Array.BYTES_PER_ELEMENT,
    )
    this.bandReassignmentPtr = this.module._malloc(
      BAND_REASSIGNMENT_TOTAL_BANDS * Int32Array.BYTES_PER_ELEMENT,
    )
    this.outputPtr = this.module._malloc(this.outputSize)
  }

  applyBandReassignments() {
    if (!this.handle || !this.bandReassignmentPtr) return

    new Int32Array(
      this.module.HEAPU8.buffer,
      this.bandReassignmentPtr,
      BAND_REASSIGNMENT_TOTAL_BANDS,
    ).set(this.bandReassignments)

    this.module._blade_set_mdct_band_reassignment_bends(
      this.handle,
      this.bandReassignmentPtr,
    )
  }

  /**
   * @param {number} bitrate
   */
  setBitrate(bitrate) {
    const snappedBitrate = snapBladeBitrate(bitrate)
    if (this.bitrate === snappedBitrate && this.handle) return

    if (this.handle) {
      this.module._blade_deinit(this.handle)
    }

    this.handle = this.module._blade_init(this.sampleRate, snappedBitrate)
    if (!this.handle) {
      throw new Error(`Blade init failed for bitrate ${snappedBitrate}`)
    }
    this.module._blade_reset_bends(this.handle)
    this.applyBandReassignments()
    this.bitrate = snappedBitrate
  }

  /**
   * @param {BladeRealtimeParams} params
   */
  updateParams(params = {}) {
    if (!this.handle) return

    if (params.bitrate && snapBladeBitrate(params.bitrate) !== this.bitrate) {
      this.setBitrate(params.bitrate)
    }

    const quality = Math.min(
      1,
      Math.max(
        0,
        params.quality ?? (params.turbo === undefined ? 1 : 1 - params.turbo),
      ),
    )
    const turbo = 1 - quality
    const thresholdBias = params.thresholdBias ?? params.bias ?? 0
    const feedback = clampUnit(
      params.feedback ?? params.mdctFeedback ?? params.mdctfeedback ?? 0,
    )
    const glitch = mapGlitchToBladeError(
      params.glitch ?? params.error ?? 0,
      this.glitchState,
    )

    this.bandReassignments = normalizeBandReassignments(
      params.bandReassignments,
    )

    this.module._blade_set_bitrate_squish_bends(this.handle, (1 - turbo) ** 3)
    this.module._blade_set_threshold_bias_bends(this.handle, thresholdBias)
    this.applyBandReassignments()
    this.module._blade_set_mdct_feedback_bends(this.handle, feedback)
    this.module._blade_set_error_bends(this.handle, glitch)
  }

  resetState() {
    if (!this.handle) return

    this.glitchState.framesRemaining = 0
    this.module._blade_reset_bends(this.handle)
  }

  /**
   * @param {Float32Array} left
   * @param {Float32Array} right
   * @param {BladeRealtimeParams} [params]
   * @returns {Uint8Array}
   */
  encode(left, right, params) {
    this.updateParams(params)

    this.module.HEAPF32.set(left, this.leftPtr / Float32Array.BYTES_PER_ELEMENT)
    this.module.HEAPF32.set(
      right,
      this.rightPtr / Float32Array.BYTES_PER_ELEMENT,
    )

    const size = this.module._blade_encode_chunk(
      this.handle,
      this.leftPtr,
      this.rightPtr,
      this.outputPtr,
    )

    if (size <= 0) {
      return new Uint8Array()
    }

    return this.module.HEAPU8.slice(this.outputPtr, this.outputPtr + size)
  }

  destroy() {
    this.glitchState.framesRemaining = 0

    if (this.handle) {
      this.module._blade_deinit(this.handle)
      this.handle = 0
    }

    if (this.leftPtr) {
      this.module._free(this.leftPtr)
      this.leftPtr = 0
    }

    if (this.rightPtr) {
      this.module._free(this.rightPtr)
      this.rightPtr = 0
    }

    if (this.outputPtr) {
      this.module._free(this.outputPtr)
      this.outputPtr = 0
    }

    if (this.bandReassignmentPtr) {
      this.module._free(this.bandReassignmentPtr)
      this.bandReassignmentPtr = 0
    }
  }
}
