import { loadArrayBuffer } from "../../../api/load/loadArrayBuffer.js"
import { listen } from "../../event/on.js"

export class MediaNode extends MediaElementAudioSourceNode {
  constructor(audioCtx, options) {
    let mediaElement = options?.mediaElement
    if (!mediaElement) {
      mediaElement = document.createElement(options?.type ?? "audio")
      if (options?.src) mediaElement.src = options.src
    }

    super(audioCtx, { mediaElement })

    this.buffer = undefined
    this.audioBuffer = undefined
  }

  get currentTime() {
    return this.mediaElement.currentTime
  }

  set currentTime(currentTime) {
    this.mediaElement.currentTime = currentTime
  }

  get src() {
    return this.mediaElement.src
  }

  set src(src) {
    this.mediaElement.src = src
  }

  async getAudioBuffer() {
    this.buffer ??= await loadArrayBuffer(this.mediaElement.src)
    this.audioBuffer ??= await this.context.decodeAudioData(this.buffer)
    return this.audioBuffer
  }

  async untilReady() {
    if (this.context.state !== "running") {
      await new Promise((resolve) => {
        const off = listen(this.context, "statechange", () => {
          if (this.context.state === "running") {
            resolve()
            off()
          }
        })
      })
    }

    if (this.mediaElement.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      await new Promise((resolve) =>
        this.mediaElement.addEventListener(
          "canplaythrough", //
          () => resolve(),
          { once: true },
        ),
      )
    }
  }

  get paused() {
    return this.mediaElement.paused
  }
  set paused(value) {
    this.togglePause(value)
  }

  async play(currentTime = 0) {
    await this.untilReady()
    this.mediaElement.currentTime = currentTime
    return this.mediaElement.play()
  }

  pause() {
    this.mediaElement.pause()
  }

  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }
}
