import "./globalThis.TextDecoder.js"
import { AudioProcessor } from "../../../42/lib/audio/AudioProcessorNode.js"
import { RingBufferProcessor } from "../../../42/lib/structure/RingBuffer.js"
import { defer } from "../../../42/lib/type/promise/defer.js"

import CHIP_CORE from "./chip-core.js"

import { MIDIPlayer } from "./players/MIDIPlayer.js"
import { VGMPlayer } from "./players/VGMPlayer.js"
import { GMEPlayer } from "./players/GMEPlayer.js"
// import { XMPPlayer } from "./players/XMPPlayer.js"
// import { MDXPlayer } from "./players/MDXPlayer.js"

const codecs = {
  midi: MIDIPlayer,
  vgm: VGMPlayer,
  gme: GMEPlayer,
  // xmp: XMPPlayer,
  // mdx: MDXPlayer,
}

// // @ts-ignore
// globalThis.TextDecoder = class TextDecoder {
//   decode(arr) {
//     console.warn(111)
//     // console.log(arr)
//     return ""
//   }
// }

let cnt = 0
// @ts-ignore
globalThis.performance = {
  now: () => {
    cnt += 0.0001
    return globalThis.currentTime + cnt
  },
}

globalThis.requestIdleCallback = (fn) => fn()
globalThis.cancelIdleCallback = () => {}

const supportSAB = globalThis.SharedArrayBuffer !== undefined

globalThis.soundfonts ??= new Map()

class ChiptuneProcessor extends AudioProcessor {
  constructor(options) {
    super(options)

    this.config = options.processorOptions

    this.paused = options.processorOptions?.paused ?? true

    const { bufferSize } = this.config

    this.rb = new RingBufferProcessor(bufferSize, 0, 2)

    const sab = supportSAB
      ? new SharedArrayBuffer(Float64Array.BYTES_PER_ELEMENT)
      : new ArrayBuffer(Float64Array.BYTES_PER_ELEMENT)

    this.positionF64 = new Float64Array(sab)

    if (supportSAB) {
      this.port.postMessage({ initSAB: sab })
    }

    this.playerReady = defer()
    if (globalThis.chiptuneWasmBinary) {
      if (
        this.config.type === "midi" &&
        globalThis.soundfonts.has(this.config.soundfontURL)
      ) {
        this.port.postMessage({ requestSoundfont: true })
      } else this.createCore()
    } else {
      this.port.postMessage({ requestWasm: true })
    }

    this.port.onmessage = async ({ data }) => {
      if ("createCore" in data) {
        this.createCore(
          data.createCore === true ? undefined : data.createCore,
          data.soundfontBuffer,
        )
      } else if ("track" in data) {
        this.loadTrack(data.track)
      } else if ("currentTime" in data) {
        this.player.seekMs(data.currentTime * 1000)
      } else if ("stopPlayer" in data) {
        this.player.stop()
      } else if ("paused" in data) {
        this.paused = Boolean(data.paused)
        if (!this.paused && this.player.stopped) {
          // this.rb.reset()
          this.loadTrack(this.track)
        }
      }
    }
  }

  async loadTrack(track) {
    this.track = track
    await this.playerReady
    await this.player.loadData(new Uint8Array(track.arrayBuffer), track.url)
    const numVoices = this.player.getNumVoices()
    this.player.setVoiceMask(new Array(numVoices).fill(true))
  }

  async createCore(wasmBinary, soundfontBuffer) {
    if (wasmBinary) globalThis.chiptuneWasmBinary = wasmBinary
    if (soundfontBuffer) {
      globalThis.soundfonts.set(this.config.soundfontURL, soundfontBuffer)
    }

    this.core = await CHIP_CORE({
      wasmBinary: globalThis.chiptuneWasmBinary,
      print: (msg) => console.debug("[stdout] " + msg),
      printErr: (msg) => console.debug("[stderr] " + msg),
    })

    this.player = new codecs[this.config.type](
      this.core,
      sampleRate,
      this.config.bufferSize,
    )

    this.player.worklet = this
    this.player.soundfontBuffer = globalThis.soundfonts.get(
      this.config.soundfontURL,
    )

    this.player.handleFileSystemReady()

    this.player.audioNode = {
      context: {
        suspend: async () => {},
        resume: async () => {},
      },
    }

    this.player.on("*", (type, data) => {
      // console.log(type, data, this.player.getDurationMs())
      this.port.postMessage({ event: { type, data } })
    })

    this.rb.onProcess = (_, output) => {
      this.player.processAudioInner(output)
      this.positionF64[0] = this.player.getPositionMs() / 1000
    }

    this.playerReady.resolve()
  }

  /**
   * @param {Float32Array[][]} _
   * @param {Float32Array[][]} outputs
   */
  process(_, [output]) {
    if (this.paused) return this.running
    this.rb.processOutput(output)
    return this.running
  }
}

AudioProcessor.define("chiptune", ChiptuneProcessor)
