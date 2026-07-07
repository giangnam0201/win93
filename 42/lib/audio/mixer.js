import { uid } from "../../api/uid.js"
import { Emittable } from "../class/mixin/Emittable.js"
import { Emitter } from "../class/Emitter.js"
import { WatchMap } from "../structure/WatchMap.js"
import { queueTask } from "../timing/queueTask.js"
import { isInstanceOf } from "../type/any/isInstanceOf.js"
import { slowFadeCurve } from "./algo/crossfaderCurves.js"
import { AudioTrack } from "./AudioTrack.js"
import { getDesktopRealm } from "../../api/env/realm/getDesktopRealm.js"
import { WatchSet } from "../structure/WatchSet.js"
import { LimiterNode } from "./effect/LimiterNode.js"
import { MixNode } from "./logic/MixNode.js"
import { noop } from "../type/function/noop.js"
// import { AudioHealthMonitor } from "./AudioHealthMonitor.js"

/**
 * @typedef {AudioNode & {context: AudioContext}} AudioNodeInstance
 * @typedef {any} AudioMixerTrackOptions
 */

export class AudioMixerTrackBase extends Emittable(AudioTrack) {
  isMainTrack = false
  isEffectTrack = false

  bridgeOutput
  bridgeAudioNode
  realmAudioContext

  /**
   * @param {AudioMixer} mixer
   * @param {any} [options]
   */
  constructor(mixer, options) {
    super(mixer.context, options)
    if (options?.realm) {
      options.dialogEl ??= options.realm.frameElement?.closest("ui-dialog")
      this.realm = options?.realm
    }

    if (options?.mediaEl) {
      options.dialogEl ??= options.mediaEl.closest("ui-dialog")
      this.mediaEl = options?.mediaEl
    }

    this.app = options?.app ?? options?.dialogEl?.app
    if (this.app) this.app.track = this
    this.dialogEl = options?.dialogEl ?? this.app?.dialogEl
    if (!this.dialogEl && this.app) {
      this.app.ready.then(() => {
        this.dialogEl = this.app.dialogEl
      })
    }

    this.#name = options?.name

    this.id = options?.id ?? this.app?.id ?? uid()
    this.picto = options?.picto ?? this.app?.getIcon("16x16")
    this.signal = options?.signal ?? this.app?.signal

    this.mixer = mixer

    this.mapper =
      this instanceof AudioMixerEffectTrack
        ? this.mixer.effectTracks
        : this.mixer.tracks

    this.signal?.addEventListener("abort", () => this.destroy())
  }

  #name
  get name() {
    return this.#name ?? this.app?.title
  }

  #destroyed = false
  destroy() {
    if (this.#destroyed) return
    this.#destroyed = true

    // Flush pending effect chain changes before cleanup
    this.flushEffectChain?.()

    this.emit("destroy")
    this.off("*")

    this.destinations.clear()
    this.willDestroy = true
    this.mixer.willDestroy.add(this.id)
    this.mapper.delete(this.id)

    this.fadeOut(this.mixer.trackFadeout).then(() => {
      this.mixer.willDestroy.delete(this.id)

      this.disconnect()
      this.bridgeOutput?.disconnect()
      this.bridgeAudioNode?.disconnect()
      if (
        this.mediaEl?.isConnected &&
        this.mediaEl.parentElement === document.documentElement
      ) {
        this.mediaEl.remove()
      }

      if (this.realmAudioContext) {
        if (this.realmAudioContext.state !== "closed") {
          this.realmAudioContext.close()
          this.realmAudioContext.close = noop
          this.realmAudioContext.suspend = noop
          this.realmAudioContext.resume = noop
        }

        this.realm = undefined
        this.realmAudioContext = undefined
      }
    })
  }

  /** @type {WatchSet<AudioMixerTrackBase>} */
  destinations = new WatchSet()
  connect(destination, ...args) {
    const out = super.connect(destination, ...args)
    this.destinations.add(destination)
    return out
  }
  disconnect(...args) {
    const out = super.disconnect(...args)
    if (args[0]) this.destinations.delete(args[0])
    else this.destinations.clear()
    return out
  }

  /**
   * Clone this track, creating a new instance with all parameters
   * and audioNode parameters copied from the current track.
   * @returns {this}
   */
  clone() {
    // Save state before cleanup
    const previousEffects = [...this.effects]
    const previousDestinations = [...this.destinations]

    // Collect all source tracks connected to this track
    const connectedTracks = []
    for (const track of this.mixer.tracks.values()) {
      if (track.destinations.has(this)) {
        connectedTracks.push(track)
      }
    }
    const connectedEffectTracks = []
    for (const effectTrack of this.mixer.effectTracks.values()) {
      if (effectTrack.destinations.has(this)) {
        connectedEffectTracks.push(effectTrack)
      }
    }

    // Save AudioParam values
    const params = {
      amp: this.amp.gain.value,
      soloAmp: this.soloAmp.gain.value,
      high: this.high.gain.value,
      mid: this.mid.gain.value,
      low: this.low.gain.value,
      preEffects: this.preEffects.gain.value,
      stereo: this.stereo.crossfader.value,
      postEffects: this.postEffects.gain.value,
      output: this.output.gain.value,
    }

    // Cleanup old track
    this.flushEffectChain?.()
    this.disconnect()
    this.off?.("*")

    // Create new instance using the constructor of the actual subclass
    const options = {
      id: this.id,
      name: this.name,
      picto: this.picto,
      fadeIn: 0, // Don't fade in again
    }

    const clone = new /** @type {typeof AudioMixerTrackBase} */ (
      this.constructor
    )(this.mixer, options)

    // Restore AudioParam values (cancel any scheduled automation first)

    clone.amp.gain.value = params.amp
    clone.soloAmp.gain.value = params.soloAmp
    clone.high.gain.value = params.high
    clone.mid.gain.value = params.mid
    clone.low.gain.value = params.low
    clone.preEffects.gain.value = params.preEffects
    clone.stereo.crossfader.value = params.stereo
    clone.postEffects.gain.value = params.postEffects
    clone.output.gain.value = params.output

    // Restore effects
    for (const effect of previousEffects) {
      clone.effects.add(effect)
    }

    // Restore destinations (connect to same outputs)
    for (const destination of previousDestinations) {
      clone.connect(destination)
    }

    // Reconnect all source tracks
    for (const track of connectedTracks) {
      track.disconnect(this)
      track.connect(clone)
    }

    // Reconnect all effect tracks
    for (const effectTrack of connectedEffectTracks) {
      effectTrack.disconnect(this)
      effectTrack.connect(clone)
    }

    return /** @type {this} */ (clone)
  }
}

export class AudioMixerMainTrack extends AudioMixerTrackBase {
  /** @type {true} */
  isMainTrack = true
}

// MARK: Effect Track
// ==================
export class AudioMixerEffectTrack extends AudioMixerTrackBase {
  /** @type {true} */
  isEffectTrack = true

  constructor(mixer, audioNode, options) {
    super(mixer, options)

    this.preEffects.disconnect()
    this.preEffects.connect(audioNode)

    if (options?.hasAudioOutput !== false) {
      audioNode.connect(this.postEffects)
      this.connect(this.mixer.mainTrack)
      this.mapper.set(this.id, this)
    }
  }
}

// MARK: Track
// ===========
export class AudioMixerTrack extends AudioMixerTrackBase {
  /**
   * @param {AudioMixer} mixer
   * @param {AudioNodeInstance} audioNode
   * @param {AudioMixerTrackOptions} [options]
   */
  constructor(mixer, audioNode, options) {
    super(mixer, options)
    if (audioNode.context === mixer.context) {
      audioNode.connect(this)
    } else {
      const bridgeInput = new MediaStreamAudioDestinationNode(audioNode.context)
      let bridgeOutput
      try {
        bridgeOutput = new MediaStreamAudioSourceNode(mixer.context, {
          mediaStream: bridgeInput.stream,
        })
      } catch (err) {
        // Firefox throws if audioNode.context.sampleRate is not the same as mixer.context
        console.log(err)
        return
      }

      audioNode.disconnect()
      audioNode.connect(bridgeInput)
      if (isInstanceOf(audioNode, GainNode)) audioNode.gain.value = 1

      this.bridgeAudioNode = audioNode
      this.bridgeInput = bridgeInput
      this.bridgeOutput = bridgeOutput
      this.bridgeOutput.connect(this)

      if (this.realm && this.realm !== window) {
        this.realmAudioContext = audioNode.context
      }
    }

    this.connect(this.mixer.mainTrack)
    this.mapper.set(this.id, this)
  }

  toggleXFadeChannel(value) {
    if (value === "A" && this.xfadeChannel === "A") value = undefined
    else if (value === "B" && this.xfadeChannel === "B") value = undefined
    this.xfadeChannel = value
    this.emit("xfadeChannelChange", value)
  }

  #soloed = false
  get soloed() {
    return this.#soloed
  }
  set soloed(bool) {
    this.#soloed = bool
    this.emit?.("solo", bool)
  }

  solo() {
    if (this.#soloed) return
    this.soloed = true
    this.soloAmp.gain.cancelScheduledValues(0)
    this.soloAmp.gain.setTargetAtTime(1, 0, 0.015)
    for (const track of this.mixer.tracks.values()) {
      if (track === this) continue
      track.soloAmp.gain.cancelScheduledValues(0)
      track.soloAmp.gain.setTargetAtTime(0, 0, 0.015)
      track.soloed = false
    }
  }

  unsolo() {
    if (!this.#soloed) return
    this.soloed = false
    for (const track of this.mixer.tracks.values()) {
      if (track === this) continue
      track.soloAmp.gain.cancelScheduledValues(0)
      track.soloAmp.gain.setTargetAtTime(1, 0, 0.015)
      track.soloed = false
    }
  }

  toggleSolo(force = !this.#soloed) {
    if (force) this.solo()
    else this.unsolo()
  }
}

// MARK: AudioMixer
// ----------------

export class AudioMixer extends Emitter {
  trackFadeout = 0.75

  crossfaderValue = 0.5

  /** @type {[AudioNodeInstance, AudioMixerTrackOptions][]} */
  outputs

  /** @type {AudioContext[]} */
  contexts

  /** @type {typeof AudioContext} */
  NativeAudioContext

  /** @type {WatchMap<string, AudioMixerTrack>} */
  tracks = new WatchMap()
  willDestroy = new Set()

  /** @type {WatchMap<string, AudioMixerEffectTrack>} */
  effectTracks = new WatchMap()

  // /** @type {AudioHealthMonitor} */
  // #healthMonitor

  /** @type {Function} */
  createAudioContext

  /** @type {AudioContext} */
  #context
  get context() {
    if (this.#context) return this.#context
    this.#context = new this.NativeAudioContext()
    this.contexts.push(this.#context)
    return this.#context
  }

  /** @type {AudioMixerMainTrack} */
  #mainTrack
  get mainTrack() {
    if (this.#mainTrack) return this.#mainTrack
    this.#mainTrack = new AudioMixerMainTrack(this, {
      id: "mainTrack",
      name: "Main Mix",
      picto: "mixer",
      fadeIn: 0,
    })

    // // -3 dB on main track
    // this.#mainTrack.preFader.gain.value = 0.7

    this.#mainTrack
      // .connect(
      //   new DynamicsCompressorNode(this.#context, {
      //     threshold: -5,
      //     knee: 0,
      //     ratio: 20,
      //     attack: 0.001,
      //     release: 0.1,
      //   }),
      // )
      // .connect(
      //   new DynamicsCompressorNode(this.#context, {
      //     threshold: 0,
      //     knee: 0,
      //     ratio: 2,
      //     attack: 0.001,
      //     release: 0.01,
      //   }),
      // )
      // .connect(new LimiterNode(this.#context))
      .connect(this.#context.destination)

    // this.#healthMonitor = new AudioHealthMonitor(this)

    return this.#mainTrack
  }

  async load() {
    await Promise.all([
      LimiterNode.load(this.context),
      MixNode.load(this.context),
    ])
  }

  addTrack(audioNode, options) {
    return new AudioMixerTrack(this, audioNode, options)
  }

  addEffectTrack(audioNode, options) {
    return new AudioMixerEffectTrack(this, audioNode, options)
  }

  /**
   * Force creation of a new AudioContext (used for recovery).
   */
  _forceNewContext() {
    // this.#healthMonitor?.destroy()
    // this.#healthMonitor = undefined
    this.#context = undefined
    // Trigger lazy creation
    return this.context
  }

  /**
   * Restarts a track by creating a fresh instance while preserving
   * all effects and reconnecting all source tracks.
   * Emits "trackRestart" event with the old and new track.
   * @param {AudioMixerTrackBase} track
   * @returns {AudioMixerTrackBase}
   */
  restartTrack(track) {
    const isMain = track === this.#mainTrack

    if (isMain) {
      // // Destroy health monitor before cloning
      // this.#healthMonitor?.destroy()
      // this.#healthMonitor = undefined
    }

    const clone = track.clone()

    if (isMain) {
      this.#mainTrack = /** @type {AudioMixerMainTrack} */ (clone)
      // this.#healthMonitor = new AudioHealthMonitor(this)
    }

    this.emit("trackRestart", track, clone)

    return clone
  }
}

// MARK: Crossfader
// ----------------

new BroadcastChannel("crossfader").onmessage = ({ data }) => {
  mixer.crossfaderValue = data

  const [a, b] = slowFadeCurve(data)

  for (const track of mixer.tracks.values()) {
    if (track.xfadeChannel === "A") {
      track.preEffects.gain.setTargetAtTime(a, 0, 0.015)
    } else if (track.xfadeChannel === "B") {
      track.preEffects.gain.setTargetAtTime(b, 0, 0.015)
    }
  }
}

// MARK: global mixer
// ------------------

/** @type {AudioMixer} */
export let mixer

const realm = getDesktopRealm()

// @ts-ignore
realm.sys42 ??= {}
const system = realm.sys42

if (system.mixer) {
  mixer = system.mixer
  if (isInstanceOf(mixer, AudioMixer) === false) {
    mixer = new AudioMixer()
    Object.assign(mixer, system.mixer)
    await mixer.load()
  }
} else {
  // @ts-ignore
  await import("../../core.js")
  mixer = new AudioMixer()
  Object.assign(mixer, system.mixer)
  await mixer.load()
}

system.mixer = mixer

queueTask(() => {
  for (const [audioNode, options] of mixer.outputs) {
    mixer.addTrack(audioNode, options)
  }

  mixer.outputs.length = 0
})
