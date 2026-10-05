import { toast } from "../../ui/layout/toast.js"

/**
 * Monitors audio output for NaN/Infinity values and excessive levels,
 * using progressive recovery strategies to restore audio health.
 */
export class AudioHealthMonitor {
  static SAMPLE_INTERVAL = 500 // ms
  static RECOVERY_TIMEOUT = 3000 // ms before escalating to track restart
  static LOUD_THRESHOLD_DB = 25 // dB over 0dBFS to consider as feedback
  static LOUD_THRESHOLD = 10 ** (AudioHealthMonitor.LOUD_THRESHOLD_DB / 20) // ~31.62

  #analyser
  #buffer
  #checkInterval
  #mixer
  #toastEl
  #isRecovering = false
  #recoveryStartTime = 0
  #effectRemovalOrder = []

  constructor(mixer, options = {}) {
    this.#mixer = mixer
    const audioContext = mixer.context
    const outputNode = mixer.mainTrack.stereo

    this.#analyser = new AnalyserNode(audioContext, {
      fftSize: 256,
      smoothingTimeConstant: 0,
    })
    this.#buffer = new Float32Array(this.#analyser.fftSize)

    outputNode.connect(this.#analyser)

    // Track effect addition order
    mixer.mainTrack.effects.on("add", (effect) => {
      this.#effectRemovalOrder.push(effect)
    })
    mixer.mainTrack.effects.on("delete", (effect) => {
      const idx = this.#effectRemovalOrder.indexOf(effect)
      if (idx !== -1) this.#effectRemovalOrder.splice(idx, 1)
    })

    let lastIdleId
    this.#checkInterval = setInterval(() => {
      cancelIdleCallback(lastIdleId)
      lastIdleId = requestIdleCallback(() => this.#check())
    }, AudioHealthMonitor.SAMPLE_INTERVAL)

    options.signal?.addEventListener("abort", () => this.destroy())
  }

  #check() {
    this.#analyser.getFloatTimeDomainData(this.#buffer)

    let hasBadSamples = false
    let maxValue = 0

    for (let i = 0; i < this.#buffer.length; i++) {
      const sample = this.#buffer[i]
      if (!Number.isFinite(sample)) {
        hasBadSamples = true
        break
      }
      maxValue = Math.max(maxValue, Math.abs(sample))
    }

    // Detect audio that is way too loud (likely feedback)
    if (maxValue > AudioHealthMonitor.LOUD_THRESHOLD) {
      hasBadSamples = true
    }

    if (hasBadSamples) {
      this.#handleBadAudio()
    } else if (this.#isRecovering) {
      // Audio is healthy again, recovery succeeded
      this.#finishRecovery(true)
    }
  }

  async #handleBadAudio() {
    const now = Date.now()

    // Mute immediately to prevent damage
    this.#mixer.mainTrack.mute()

    // Start recovery if not already recovering
    if (!this.#isRecovering) {
      this.#isRecovering = true
      this.#recoveryStartTime = now

      this.#toastEl = await toast({
        label: "Audio Feedback Detected",
        message: "Attempting to recover...",
        picto: "emblems/forbidden",
        timeout: false,
      })
    }

    // Check if we should escalate (timeout exceeded)
    if (now - this.#recoveryStartTime > AudioHealthMonitor.RECOVERY_TIMEOUT) {
      await this.#escalateRecovery()
      return
    }

    // Try removing effects progressively
    await this.#attemptEffectRemoval()
  }

  async #attemptEffectRemoval() {
    // Validate effect chain first
    this.#mixer.mainTrack.validateEffects?.()

    // Remove last added effect if any remain
    if (this.#effectRemovalOrder.length === 0) return

    const lastEffect =
      this.#effectRemovalOrder[this.#effectRemovalOrder.length - 1]
    const app = this.#findAppForEffect(lastEffect)

    if (app) {
      app.bypass()
    } else {
      this.#mixer.mainTrack.effects.delete(lastEffect)
    }

    // Wait briefly for audio to stabilize
    await new Promise((r) => setTimeout(r, 200))

    // Unmute to test if fixed
    this.#mixer.mainTrack.unmute()
  }

  #findAppForEffect(effectNode) {
    for (const track of this.#mixer.effectTracks.values()) {
      if (track.app?.audioPipe === effectNode) {
        return track.app
      }
    }
    return null
  }

  async #escalateRecovery() {
    // Clear all effects first
    for (const effect of this.#mixer.mainTrack.effects) {
      const app = this.#findAppForEffect(effect)
      if (app) app.bypass()
      this.#mixer.mainTrack.effects.delete(effect)
    }

    // Restart the main track (creates fresh audio nodes)
    this.#mixer.restartTrack(this.#mixer.mainTrack)
    this.#finishRecovery(false)
  }

  /**
   * @param {boolean} success - Whether recovery succeeded naturally.
   */
  #finishRecovery(success) {
    this.#toastEl?.close()
    this.#toastEl = null
    this.#isRecovering = false
    this.#recoveryStartTime = 0

    if (success) {
      toast({
        label: "Audio Recovered",
        message: "Problematic effect was bypassed.",
        picto: "emblems/info",
        timeout: 3000,
      })
    } else {
      toast({
        label: "Audio System Restarted",
        message: "Effects were cleared to restore audio.",
        picto: "emblems/info",
        timeout: 3000,
      })
    }
  }

  destroy() {
    clearInterval(this.#checkInterval)
    this.#analyser?.disconnect()
    this.#toastEl?.close()
    this.#effectRemovalOrder.length = 0
  }
}
