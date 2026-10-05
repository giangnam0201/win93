import { AudioProcessorNode } from "/42/lib/audio/AudioProcessorNode.js"

export class LooperNode extends AudioProcessorNode {
  static module = new URL("./LooperProcessor.js", import.meta.url).href

  #onRecorded

  constructor(context, options) {
    super(context, "looper-processor", {
      numberOfInputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
      ...options,
    })
    this.port.addEventListener("message", ({ data }) => {
      if (data.recorded) this.#onRecorded?.(data.recorded, data.startTime)
    })
    this.port.start()
  }

  startRecording(armed = false, recordUntil = null) {
    this.port.postMessage({ startRecording: true, armed, recordUntil })
  }

  clearRecording() {
    this.port.postMessage({ clearRecording: true })
  }

  stopRecording() {
    return new Promise((resolve) => {
      this.#onRecorded = (recorded, startTime) =>
        resolve({ recorded, startTime })
      this.port.postMessage({ stopRecording: true })
    })
  }

  waitForRecording() {
    return new Promise((resolve) => {
      this.#onRecorded = (recorded, startTime) =>
        resolve({ recorded, startTime })
    })
  }
}
