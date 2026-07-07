/* eslint-disable no-unused-expressions */
import { WatchSet } from "../structure/WatchSet.js"
import { debounce } from "../timing/debounce.js"
import { MixNode } from "./logic/MixNode.js"
import { unmute, mute, fadeOut, fadeIn } from "./algo/fading.js"

// console.log("fadin avec setTargetAtTime")

/**
 * @typedef {any} AudioTrackOptions
 */

export class AudioTrack extends GainNode {
  /** @type {WatchSet<AudioNode>} */
  effects = new WatchSet()

  /** @param {AudioContext} audioContext */
  static async load(audioContext) {
    await MixNode.load(audioContext)
  }

  /**
   * @param {AudioContext} audioContext
   * @param {AudioTrackOptions} [options]
   */
  static async init(audioContext, options) {
    await this.load(audioContext)
    return new this(audioContext, options)
  }

  /**
   * @param {AudioContext} audioContext
   * @param {AudioTrackOptions} [options]
   */
  constructor(audioContext, options) {
    super(audioContext)

    /** @type {Function} */ this.emit

    this.preFader = this
    this.amp = new GainNode(this.context, { gain: 1 })
    this.soloAmp = new GainNode(this.context, { gain: 1 })
    this.preEffects = new GainNode(this.context, { gain: 1 })
    this.postEffects = new GainNode(this.context, { gain: 1 })
    this.output = new GainNode(this.context, { gain: 0 })

    // Stereo
    // ------

    this.stereo = new MixNode(this.context)

    // EQ
    // --

    const from = 320
    const to = 3200

    const geometricMean = Math.sqrt(from * to) // https://stackoverflow.com/a/33541780/1289275

    this.low = new BiquadFilterNode(this.context, {
      type: "lowshelf",
      frequency: from,
      gain: options?.low ?? 0,
    })
    this.mid = new BiquadFilterNode(this.context, {
      type: "peaking",
      frequency: geometricMean,
      Q: geometricMean / (to - from),
      gain: options?.mid ?? 0,
    })
    this.high = new BiquadFilterNode(this.context, {
      type: "highshelf",
      frequency: to,
      gain: options?.high ?? 0,
    })

    super
      .connect(this.amp)
      .connect(this.soloAmp)
      .connect(this.high)
      .connect(this.mid)
      .connect(this.low)
      .connect(this.preEffects)
      .connect(this.postEffects)
      .connect(this.stereo)
      .connect(this.output)

    const rebuildChain = debounce(() => {
      try {
        this.preEffects.disconnect()
        let lastNode = /** @type {AudioNode} */ (this.preEffects)

        for (const node of this.effects) {
          try {
            node.disconnect()
          } catch {}
          lastNode.connect(node)
          lastNode = node
        }

        lastNode.connect(this.postEffects)
      } catch (err) {
        console.warn(err)
      }
    }, 0)

    this.effects.on("change", rebuildChain)
    this.effects.on("delete", (node) => {
      try {
        // Disconnect immediately to prevent parallel route leaks.
        node.disconnect()
      } catch {}
    })

    this.flushEffectChain = () => rebuildChain.flush?.()

    if (this.context.state === "running") {
      this.fadeIn(options?.fadeIn)
    } else {
      const onresume = () => {
        if (this.context.state === "running") {
          this.fadeIn(options?.fadeIn)
          this.context.removeEventListener("statechange", onresume)
        }
      }

      this.context.addEventListener("statechange", onresume)
    }
  }

  connect(...args) {
    // @ts-ignore
    return this.output.connect(...args)
  }
  disconnect(...args) {
    try {
      // @ts-ignore
      this.output.disconnect(...args)
    } catch (err) {
      console.log(err)
    }
  }

  addEffects(...audioNodes) {
    for (const audioNode of audioNodes) {
      this.effects.add(audioNode)
    }
  }

  /**
   * Removes any invalid or orphaned effects from the chain.
   * Call this periodically or when audio issues are detected.
   */
  validateEffects() {
    for (const node of this.effects) {
      // Check if node is still a valid, connected AudioNode
      const isInvalid =
        !node ||
        !node.context ||
        node.context.state === "closed" ||
        node.context !== this.context // Different context = orphaned

      if (isInvalid) {
        console.warn("Removing invalid effect from chain:", node)
        this.effects.delete(node)
      }
    }
  }

  fadeIn(duration = 0.5) {
    return fadeIn(this.output, duration)
  }

  fadeOut(duration = 0.5) {
    return fadeOut(this.output, duration)
  }

  // fadeIn(duration = 0.5) {
  //   this.output.gain.cancelScheduledValues(0)
  //   this.output.gain.setTargetAtTime(1, 0, duration / 3)
  // }

  // fadeOut(duration = 0.5) {
  //   const now = this.context.currentTime
  //   this.output.gain.exponentialRampToValueAtTime(0.001, now + duration)
  // }

  get volume() {
    return this.amp.gain.value
  }
  set volume(value) {
    this.amp.gain.cancelScheduledValues(0)
    this.amp.gain.setTargetAtTime(value, 0, 0.015)
  }

  #muted = false
  get muted() {
    return this.#muted
  }
  set muted(bool) {
    this.toggleMute(bool)
  }

  mute() {
    if (this.#muted) return
    this.#muted = true
    this.emit?.("mute", true)
    mute(this.output)
  }

  unmute() {
    if (!this.#muted) return
    this.#muted = false
    this.emit?.("mute", false)
    unmute(this.output)
  }

  toggleMute(force = !this.#muted) {
    if (force) this.mute()
    else this.unmute()
  }

  resetParams(duration = 0.5) {
    duration /= 3
    // this.amp.gain.setTargetAtTime(this.amp.gain.defaultValue, 0, duration)
    this.low.gain.setTargetAtTime(0, 0, duration)
    this.mid.gain.setTargetAtTime(0, 0, duration)
    this.high.gain.setTargetAtTime(0, 0, duration)
    this.postEffects.gain.setTargetAtTime(
      this.postEffects.gain.defaultValue,
      0,
      duration,
    )
    this.stereo.crossfader.setTargetAtTime(0, 0, duration)
  }
}
