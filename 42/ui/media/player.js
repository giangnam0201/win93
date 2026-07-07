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
  const codec = new ChiptuneNode(audioContext, { type })
  codec.connect(amp)

  const { signal } = player
  codec.on("ended", { signal }, () => player.stop({ ended: true }))

  await codec.loadTrack(url)
  return codec
}

async function initCodec(player, type, url) {
  const { audioContext, amp } = player

  const { init } = await import(`../../../c/libs/codecs/${type}.js`)
  const codec = await init({ audioContext })

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
    } else {
      this.muteEl.ariaLabel = "Mute"
      this.mutePictoEl.value = "volume"
      this.amp.gain.setTargetAtTime(this.#volume, 0, 0.015)
    }
  }

  async load(path) {
    const res = await findCodec(path)

    if (res.codec) {
      const { codec, arrayBuffer } = res
      const type = codec.name
      try {
        this.unload()
        if (this.codec.type === type) {
          await this.codec.loadTrack(path, arrayBuffer)
        } else {
          this.codec.destroy?.()
          this.codec =
            codec.kind === "chip-player"
              ? await initChipPlayerCodec(this, type, path)
              : await initCodec(this, type, path)
        }
        this.loaded()
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
    this.codec?.destroy?.()
    this.amp?.disconnect?.()
  }
}

export const player = Component.define(PlayerComponent)
