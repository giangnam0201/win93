import "./picto.js"
import { Component } from "../../api/gui/Component.js"
import { BasicPlayerComponent } from "./basicPlayer.js"
import { findCodec } from "./player/findCodec.js"
import { ensureURL } from "../../api/os/ensureURL.js"
import { clamp } from "../../lib/type/number/math.js"

let ChiptuneNode

async function initChipPlayerCodec(player, type, url) {
  ChiptuneNode ??= (
    await import("../../../c/libs/chip-player-js/ChiptuneNode.js")
  ).ChiptuneNode

  const { audioContext, amp } = player

  await ChiptuneNode.load(audioContext)
  // player.soundfont (MIDI only) is an ad-hoc property callers can set
  // before load() -- lets the core start with the right soundfont already
  // loaded instead of the fallback + a swap moments later.
  const codec = new ChiptuneNode(audioContext, {
    type,
    soundfont: player.soundfont,
  })
  codec.connect(amp)

  const { signal } = player
  codec.on("ended", { signal }, () => player.stop({ ended: true }))

  await codec.loadTrack(url)
  return codec
}

async function initCodec(player, type, moduleName, url) {
  const { audioContext, amp } = player

  const { init } = await import(`../../../c/libs/codecs/${moduleName}.js`)
  const codec = await init({ audioContext })
  codec.type = type

  codec.audioNode.disconnect()
  codec.audioNode.connect(amp)

  const { signal } = player
  codec.on("ended", { signal }, () => player.stop({ ended: true }))

  await codec.loadTrack(url)

  return codec
}

export class PlayerComponent extends BasicPlayerComponent {
  static plan = {
    tag: "ui-player",
    props: {
      src: true,
      autoplay: true,
    },
  }

  /** @type {MediaElementAudioSourceNode} */
  #mediaSource

  /** @type {AudioContext} */
  #audioContext
  get audioContext() {
    this.#audioContext ??= new AudioContext()
    return this.#audioContext
  }
  set audioContext(audioContext) {
    this.#audioContext = audioContext
  }

  /** @type {GainNode} */
  #amp
  get amp() {
    if (!this.#amp) {
      const { audioContext } = this
      this.#amp = new GainNode(audioContext)
      this.#amp.connect(audioContext.destination)
    }
    return this.#amp
  }

  #volume = 1
  get volume() {
    return this.#volume
  }
  set volume(value) {
    value = clamp(value, 0, 1)
    this.amp.gain.cancelScheduledValues(0)
    this.amp.gain.setTargetAtTime(value, 0, 0.015)
    this.#volume = value
    this.codec?.setMidiVolume?.(this.#muted ? 0 : value)
  }

  #muted = false
  get muted() {
    return this.#muted
  }
  set muted(bool) {
    this.#muted = Boolean(bool)
    this.amp.gain.cancelScheduledValues(0)
    if (this.#muted) {
      this.muteEl.ariaLabel = "Unmute"
      this.mutePictoEl.value = "volume-off"
      this.amp.gain.setTargetAtTime(0, 0, 0.015)
      this.codec?.setMidiVolume?.(0)
    } else {
      this.muteEl.ariaLabel = "Mute"
      this.mutePictoEl.value = "volume"
      this.amp.gain.setTargetAtTime(this.#volume, 0, 0.015)
      this.codec?.setMidiVolume?.(this.#volume)
    }
  }

  // `force` skips the same-type reuse (loadTrack() on the existing codec)
  // and always destroys/recreates instead -- for recovering from a codec
  // that's crashed/corrupted rather than just switching tracks (see
  // MediaPlayer.js's "crashed" handling).
  async load(path, { force = false } = {}) {
    const res = await findCodec(path)

    if (res.codec) {
      const { codec, arrayBuffer } = res
      const type = codec.name
      try {
        this.unload()
        if (!force && this.codec.type === type) {
          await this.codec.loadTrack(path, arrayBuffer)
        } else {
          this.codec.destroy?.()
          this.codec =
            codec.kind === "chip-player"
              ? await initChipPlayerCodec(this, type, path)
              : await initCodec(this, type, codec.module ?? type, path)
        }
        this.loaded()
        // player.beforePlay is an ad-hoc async hook callers can set before
        // load() -- awaited here, once the codec exists but before
        // playback actually starts, so a track doesn't start rendering
        // through a not-yet-correctly-configured engine (e.g. a moment of
        // audible FluidLite before a persisted MIDI Device choice finishes
        // applying, or native playback starting at 1x before a persisted
        // Speed setting catches up).
        if (this.beforePlay) await this.beforePlay()
        if (this.autoplay) this.play()
      } catch (err) {
        this.disable(err)
      }
      return
    }

    if (this.codec !== this.mediaEl) {
      try {
        this.codec.destroy?.()
      } catch {}
    }

    this.codec = this.mediaEl
    if (!this.#mediaSource) {
      this.#mediaSource = this.audioContext.createMediaElementSource(
        this.mediaEl,
      )
      this.#mediaSource.connect(this.amp)
    }

    return super.load(await ensureURL(path))
  }

  destroyed() {
    // Closing the app otherwise leaves whatever's currently ringing on a
    // real MIDI Device stuck on -- stop() triggers the same all-notes-off
    // panic() the Stop button does, this just makes sure it also happens on
    // close, not only when the user explicitly hits Stop first.
    this.codec?.stop?.()
    this.codec?.destroy?.()
    this.amp?.disconnect?.()
  }
}

export const player = Component.define(PlayerComponent)
