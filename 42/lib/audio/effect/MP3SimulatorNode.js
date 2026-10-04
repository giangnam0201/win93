import { AudioProcessorNode } from "../AudioProcessorNode.js"
import {
  BAND_REASSIGNMENT_ACTIVE_BANDS,
  normalizeBandReassignments,
  snapBladeBitrate,
} from "../../../../c/libs/blade/blade-runtime.js"

const NAME = "mp3-simulator"

const BAND_REASSIGNMENTS = Array.from(
  { length: BAND_REASSIGNMENT_ACTIVE_BANDS },
  (_, index) => index,
)

/**
 * @param {Record<string, number> | undefined} parameterData
 * @returns {Record<string, number>}
 */
function normalizeParameterData(parameterData) {
  /** @type {Record<string, number>} */
  const normalized = {}

  if (!parameterData) return normalized

  for (const [key, value] of Object.entries(parameterData)) {
    if (key === "signal" || key === "turbo" || key === "error") continue
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value
    }
  }

  return normalized
}

export class MP3SimulatorNode extends AudioProcessorNode {
  static module = import.meta.resolve("./MP3Simulator/MP3SimulatorProcessor.js")
  static bandReassignmentBandCount = BAND_REASSIGNMENT_ACTIVE_BANDS

  /** @type {AudioParam} */ bitrate
  /** @type {AudioParam} */ drive
  /** @type {AudioParam} */ quality
  /** @type {AudioParam} */ bias
  /** @type {AudioParam} */ feedback
  /** @type {AudioParam} */ glitch
  /** @type {AudioParam} */ highCut
  /** @type {AudioParam} */ lowCut
  /** @type {AudioParam} */ makeupGain
  /** @type {AudioParam} */ mix

  diagnostics = { worker: {}, processor: {} }
  bandReassignments = BAND_REASSIGNMENTS

  /**
   * @param {BaseAudioContext} context
   * @param {Record<string, number>} [parameterData]
   */
  constructor(context, parameterData) {
    const initialBitrate = snapBladeBitrate(parameterData?.bitrate ?? 128)
    const initialQuality = parameterData?.quality
    const initialFeedback = parameterData?.feedback
    const initialGlitch = parameterData?.glitch
    const normalizedParameterData = normalizeParameterData(parameterData)

    normalizedParameterData.bitrate = initialBitrate
    if (typeof initialQuality === "number" && Number.isFinite(initialQuality)) {
      normalizedParameterData.quality = initialQuality
    }
    if (
      typeof initialFeedback === "number" &&
      Number.isFinite(initialFeedback)
    ) {
      normalizedParameterData.feedback = initialFeedback
    }
    if (typeof initialGlitch === "number" && Number.isFinite(initialGlitch)) {
      normalizedParameterData.glitch = initialGlitch
    }

    super(context, NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      parameterData: {
        ...normalizedParameterData,
      },
    })

    this.setParameters()

    this.worker = new Worker(
      import.meta.resolve("./MP3Simulator/processFrame.w.js"),
      { type: "module" },
    )

    this.updateDiagnostics = (source, stats) => {
      this.diagnostics = {
        ...this.diagnostics,
        [source]: {
          ...this.diagnostics[source],
          ...stats,
        },
      }

      this.dispatchEvent(
        new CustomEvent("diagnostics", {
          detail: this.diagnostics,
        }),
      )
    }

    this.worker.addEventListener("message", ({ data }) => {
      if (data.type === "stats") {
        this.updateDiagnostics("worker", data.stats)
        return
      }

      if (data.type === "log") {
        const log = console[data.level] ?? console.log
        log("[MP3Sim]", data.message)
      }

      const transfer = []
      if (data.leftBuffer) transfer.push(data.leftBuffer)
      if (data.rightBuffer) transfer.push(data.rightBuffer)
      this.port.postMessage(data, transfer)
    })

    this.port.addEventListener("message", ({ data }) => {
      if (data.type === "stats") {
        this.updateDiagnostics("processor", data.stats)
        return
      }

      const transfer = []
      if (data.leftBuffer) transfer.push(data.leftBuffer)
      if (data.rightBuffer) transfer.push(data.rightBuffer)
      this.worker.postMessage(data, transfer)
    })

    this.worker.postMessage({
      type: "init",
      sampleRate: context.sampleRate,
      bitrate: initialBitrate,
    })
    this.setBandReassignments(this.bandReassignments)

    this.port.start()
  }

  getBandReassignments() {
    return this.bandReassignments.slice()
  }

  /**
   * @param {ArrayLike<number> | undefined} values
   */
  setBandReassignments(values) {
    const normalized = normalizeBandReassignments(values)
    this.bandReassignments = Array.from(
      normalized.subarray(0, BAND_REASSIGNMENT_ACTIVE_BANDS),
    )

    this.worker?.postMessage({
      type: "band-reassignments",
      order: this.bandReassignments,
    })

    this.dispatchEvent(
      new CustomEvent("band-reassignments", {
        detail: this.getBandReassignments(),
      }),
    )
  }

  resetBandReassignments() {
    this.setBandReassignments(
      Array.from(
        { length: BAND_REASSIGNMENT_ACTIVE_BANDS },
        (_, index) => index,
      ),
    )
  }

  randomizeBandReassignments() {
    this.setBandReassignments(
      Array.from({ length: BAND_REASSIGNMENT_ACTIVE_BANDS }, () =>
        Math.floor(Math.random() * BAND_REASSIGNMENT_ACTIVE_BANDS),
      ),
    )
  }

  /**
   * @param {number} delta
   */
  shiftBandReassignments(delta) {
    const step = Math.round(delta)
    if (!step) return

    this.setBandReassignments(
      this.bandReassignments.map((value) => value + step),
    )
  }

  destroy() {
    this.worker?.postMessage({ type: "stop" })
    this.worker?.terminate()
    this.worker = undefined
    super.destroy()
  }
}
