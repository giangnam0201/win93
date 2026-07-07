import { loadArrayBuffer } from "../../../42/api/load/loadArrayBuffer.js"
import { AudioProcessorNode } from "../../../42/lib/audio/AudioProcessorNode.js"
import { Emittable } from "../../../42/lib/class/mixin/Emittable.js"
import { defer } from "../../../42/lib/type/promise/defer.js"

export class ChiptuneNode extends Emittable(AudioProcessorNode) {
  static module = new URL(
    "./ChiptuneProcessor.js", //
    import.meta.url,
  ).href

  paused = true
  #currentTime = 0
  #currentTimeSab
  get currentTime() {
    return this.#currentTimeSab?.[0] ?? this.#currentTime
  }

  set currentTime(currentTime) {
    if (this.#currentTimeSab) {
      this.#currentTimeSab[0] = currentTime
    } else {
      this.#currentTime = currentTime
    }
    this.port.postMessage({ currentTime })
  }

  constructor(context, options) {
    const { type, ...parameterData } = options

    // Make sure bufferSize is at least baseLatency
    const bufferSize = Math.max(
      2 **
        Math.ceil(
          Math.log2((context.baseLatency || 0.001) * context.sampleRate),
        ),
      2048,
    )

    const soundfontURL = import.meta.resolve("./soundfonts/Scc1t2.sf2")

    super(context, "chiptune", {
      numberOfInputs: 0,
      channelCountMode: "explicit",
      outputChannelCount: [2],
      processorOptions: { bufferSize, type, soundfontURL },
      parameterData,
    })

    this.type = type

    this.ready = defer()

    this.port.addEventListener("message", ({ data }) => {
      if (data.requestWasm) {
        loadArrayBuffer(import.meta.resolve("./chip-core.wasm")) //
          .then(async (arrayBuffer) => {
            let soundfontBuffer
            const transfers = [arrayBuffer]
            if (type === "midi") {
              soundfontBuffer = await loadArrayBuffer(soundfontURL)
              transfers.push(soundfontBuffer)
            }
            this.port.postMessage(
              { createCore: arrayBuffer, soundfontBuffer },
              transfers,
            )
          })
      } else if (data.requestSoundfont) {
        loadArrayBuffer(soundfontURL).then((soundfontBuffer) => {
          this.port.postMessage({ createCore: true, soundfontBuffer }, [
            soundfontBuffer,
          ])
        })
      } else if (data.event) {
        if (data.event.type === "playerStateUpdate") {
          if (data.event.data.isStopped) {
            if (!this.stoppedFromGUI) this.emit("ended")
            this.stoppedFromGUI = false
          } else if (data.event.data.durationMs) {
            this.state = data.event.data
            this.duration = data.event.data.durationMs / 1000
            this.ready.resolve()
          }
        }
      } else if (data.initSAB) {
        this.#currentTimeSab = new Float64Array(data.initSAB)
      }
    })

    this.port.start()
  }

  async loadTrack(url) {
    if (!url) return
    await loadArrayBuffer(url).then((arrayBuffer) => {
      this.port.postMessage({ track: { arrayBuffer, url } }, [arrayBuffer])
    })

    await this.ready
  }

  async play() {
    this.paused = false
    this.port.postMessage({ paused: false })
  }

  pause() {
    this.paused = true
    this.port.postMessage({ paused: true })
  }

  stop(options) {
    this.paused = true
    this.port.postMessage({ paused: true })
    if (options?.ended) return
    this.stoppedFromGUI = true
    this.port.postMessage({ stopPlayer: true })
  }
}
