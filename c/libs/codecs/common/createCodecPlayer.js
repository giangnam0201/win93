import { loadArrayBuffer } from "../../../../42/api/load/loadArrayBuffer.js"
import { Emitter } from "../../../../42/lib/class/Emitter.js"
import { getBasename } from "../../../../42/lib/syntax/path/getBasename.js"

class CodecPlayer extends Emitter {
  constructor(backend, intance) {
    super()

    this.backend = backend
    this.backend.setOnTrackEnd(() => this.emit("ended"))

    this.player = intance
    this.player._initByUserGesture()

    this.audioNode = this.player._producerNode
  }

  init() {}

  #trackUrl
  #trackBuffer
  #setTrackBuffer(url, arrayBuffer, prefix = "") {
    this.#trackUrl = url
    this.#trackBuffer = arrayBuffer

    this.#emptyCache()

    return new Promise((resolve) => {
      this.player._onTrackReadyToPlay = () => {
        requestIdleCallback(() => resolve())
      }
      this.player._prepareTrackForPlayback(
        prefix + getBasename(url),
        arrayBuffer,
        {},
      )
    })
  }

  async loadTrack(url, arrayBuffer) {
    if (!url) return
    if (arrayBuffer) return this.#setTrackBuffer(url, arrayBuffer)
    return loadArrayBuffer(url).then((arrayBuffer) =>
      this.#setTrackBuffer(url, arrayBuffer),
    )
  }

  get currentTime() {
    const currentTime = this.player.getPlaybackPosition()
    if (this.ended) {
      if (currentTime < this.player.getMaxPlaybackPosition()) {
        this.ended = false
        return currentTime / 1000
      }
      return 0
    }
    return currentTime / 1000
  }
  set currentTime(value) {
    this.player.seekPlaybackPosition(value * 1000)
  }

  get duration() {
    return this.player.getMaxPlaybackPosition() / 1000
  }

  get paused() {
    return this.player.isPaused()
  }

  get metadata() {
    return this.backend.getSongInfo()
  }

  async play() {
    if (this.ended) {
      // Force reload track
      // TODO: Allow loop in codec
      await this.#setTrackBuffer(
        this.#trackUrl,
        this.#trackBuffer,
        String(Date.now()),
      )
      this.player.resume()
      return
    }
    if (this.paused) this.player.resume()
    else this.player.play()
  }

  pause() {
    if (this.paused) return
    return this.player.pause()
  }

  #emptyCache() {
    const cache = this.player?._getCache?.()
    if (!cache) return
    for (const key of Object.keys(cache._binaryFileMap)) {
      delete cache._binaryFileMap[key]
    }
  }

  destroy() {
    this.emit("destroy")
    this.off("*")

    this.player.pause()
    this.player._onTrackReadyToPlay = undefined
    this.player._tickerNode?.disconnect()
    this.audioNode.disconnect()

    this.#emptyCache()
  }
}

export async function createCodecPlayer(ScriptNodePlayer, Backend) {
  const backend = new Backend()
  await ScriptNodePlayer.initialize(backend, undefined, [], true)
  const player = ScriptNodePlayer.getInstance()
  return new CodecPlayer(backend, player)
}
