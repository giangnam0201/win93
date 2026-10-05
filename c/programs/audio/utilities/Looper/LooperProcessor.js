import { AudioProcessor } from "/42/lib/audio/AudioProcessorNode.js"

const ARM_THRESHOLD = 0.004

class LooperProcessor extends AudioProcessor {
  #recording = false
  #armed = false
  #chunks = []
  #startTime = 0
  #recordUntil = null

  constructor(options) {
    super(options)
    this.port.addEventListener("message", ({ data }) => {
      if (data.startRecording) {
        this.#chunks = []
        this.#startTime = -1
        this.#armed = Boolean(data.armed)
        this.#recording = !this.#armed
        this.#recordUntil = data.recordUntil ?? null
      } else if (data.stopRecording) {
        this.#finishRecording()
      } else if (data.clearRecording) {
        this.#chunks = []
        this.#startTime = -1
      }
    })
  }

  #finishRecording() {
    if (!this.#recording && !this.#armed) return
    this.#recording = false
    this.#armed = false
    this.#recordUntil = null
    let length = 0
    for (const chunk of this.#chunks) length += chunk.length
    const recorded = new Float32Array(length)
    let offset = 0
    for (const chunk of this.#chunks) {
      recorded.set(chunk, offset)
      offset += chunk.length
    }
    this.#chunks = []
    this.port.postMessage({ recorded, startTime: this.#startTime }, [
      recorded.buffer,
    ])
  }

  process(inputs) {
    if (!this.running) return false
    const channel = inputs[0]?.[0]

    if (this.#armed && channel) {
      for (let i = 0; i < channel.length; i++) {
        if (Math.abs(channel[i]) >= ARM_THRESHOLD) {
          this.#armed = false
          this.#recording = true
          break
        }
      }
    }

    if (this.#recording) {
      if (this.#startTime === -1) this.#startTime = currentTime
      if (channel) this.#chunks.push(channel.slice())
      if (this.#recordUntil !== null && currentTime >= this.#recordUntil) {
        this.#finishRecording()
      }
    }
    return true
  }
}

AudioProcessor.define("looper-processor", LooperProcessor)
