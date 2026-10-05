/* eslint-disable complexity */
import "./globalThis.TextDecoder.js"
import "./globalThis.URL.js"
import { AudioProcessor } from "../../../42/lib/audio/AudioProcessorNode.js"
import { RingBufferProcessor } from "../../../42/lib/structure/RingBuffer.js"
import { defer } from "../../../42/lib/type/promise/defer.js"

import CHIP_CORE from "./chip-core.js"

import { MIDIPlayer } from "./players/MIDIPlayer.js"
import { VGMPlayer } from "./players/VGMPlayer.js"
import { GMEPlayer } from "./players/GMEPlayer.js"
import { XMPPlayer } from "./players/XMPPlayer.js"
import { MDXPlayer } from "./players/MDXPlayer.js"

const codecs = {
  midi: MIDIPlayer,
  vgm: VGMPlayer,
  gme: GMEPlayer,
  xmp: XMPPlayer,
  mdx: MDXPlayer,
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
  // globalThis.currentTime (AudioWorkletGlobalScope's audio-clock) is in
  // SECONDS -- real performance.now() is in milliseconds, and MIDIFilePlayer
  // (see setPositionWebMidi/processPlay) does ms-scale arithmetic against it
  // (BUFFER_AHEAD = 33). Without the *1000 this clock ran ~1000x too slow,
  // so elapsedTime crept up 1000x slower than real playTime: only an initial
  // handful of MIDI events would ever fall inside the lookahead window, so
  // Web MIDI output (processPlay()) would go silent almost immediately.
  now: () => {
    cnt += 0.0001
    return globalThis.currentTime * 1000 + cnt
  },
}

globalThis.requestIdleCallback = (fn) => fn()
globalThis.cancelIdleCallback = () => {}

// AudioWorkletGlobalScope has no timer APIs at all (not "slow", genuinely
// absent) -- MIDIFilePlayer.setPositionWebMidi() calls plain setTimeout()
// to resume playback after flushing a burst of CC events, which threw
// "setTimeout is not defined" every single time the engine switched to Web
// MIDI. That exception aborted MIDIPlayer.setParameter() before it reached
// its own `this.params[id] = value` assignment, so the engine silently
// never actually switched (still rendered FluidLite audio, never entered
// the processPlay()/Web MIDI code path) despite the UI showing it as
// selected. Polyfilled here against the worklet's own audio clock, checked
// once per process() call below.
const pendingTimers = []
let nextTimerId = 1
globalThis.setTimeout = (fn, delayMs = 0, ...args) => {
  const id = nextTimerId++
  pendingTimers.push({
    id,
    fireAt: globalThis.currentTime + delayMs / 1000,
    fn,
    args,
  })
  return id
}
globalThis.clearTimeout = (id) => {
  const index = pendingTimers.findIndex((timer) => timer.id === id)
  if (index !== -1) pendingTimers.splice(index, 1)
}

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
        // Pausing mid-note otherwise leaves it stuck on, audibly, until
        // playback resumes -- MIDI only (other player types have no
        // panic()). Fires on every pause, including the first step of
        // Stop's own {paused:true} -- harmless, stop's own panic (via
        // stopPlayer below) just runs again on an already-silent channel.
        if (this.paused) this.player.panic?.()
        // Live nodes have no track to reload; calling loadTrack(undefined)
        // would fail while trying to read the missing file.
        if (!this.paused && this.player.stopped && this.track) {
          // Without this, the output ring buffer still holds audio already
          // rendered from the position playing when Stop was pressed -- that
          // stale chunk plays out first (an audible glitch of "what was
          // playing a moment ago") before the reloaded track's fresh render
          // catches up.
          this.rb.reset()
          this.loadTrack(this.track)
        }
      } else if ("setSoundfont" in data) {
        const { value, buffer } = data.setSoundfont
        await this.playerReady
        this.player.soundfontBuffer = buffer
        this.player.setParameter("soundfont", value)
      } else if ("setVoiceMask" in data) {
        await this.playerReady
        this.player.setVoiceMask(data.setVoiceMask)
      } else if ("setSynthEngine" in data) {
        await this.playerReady
        this.player.setParameter("synthengine", data.setSynthEngine)
        // navigator (and therefore Web MIDI) doesn't exist in this
        // worklet's global scope -- ask the main thread to request access
        // and report back which devices exist.
        if (data.setSynthEngine === 2) {
          this.port.postMessage({ requestMidiAccess: true })
        }
      } else if ("setOpl3Bank" in data) {
        await this.playerReady
        this.player.setParameter("opl3bank", data.setOpl3Bank)
      } else if ("setMidiDevice" in data) {
        await this.playerReady
        this.player.setParameter("mididevice", data.setMidiDevice)
      } else if ("setTempo" in data) {
        await this.playerReady
        this.player.setTempo(data.setTempo)
      } else if ("setTranspose" in data) {
        await this.playerReady
        this.player.setTranspose(data.setTranspose)
      } else if ("setMidiVolume" in data) {
        // Only MIDIPlayer implements this (real MIDI Device output bypasses
        // this worklet's own audio graph, so the GainNode-based volume on
        // the main thread has no effect on it).
        await this.playerReady
        this.player.setMidiVolume?.(data.setMidiVolume)
      } else if ("setPlayerParameter" in data) {
        // Generic passthrough for a player's own one-off paramDefs (e.g.
        // XMPPlayer's "interpolation") -- unlike the MIDI ones above, these
        // aren't shared across player types, so they don't warrant their
        // own dedicated setXyz() message each.
        await this.playerReady
        const { id, value } = data.setPlayerParameter
        this.player.setParameter(id, value)
      } else if ("setReverb" in data) {
        await this.playerReady
        this.player.setParameter("reverb", data.setReverb)
      } else if ("setChorus" in data) {
        await this.playerReady
        this.player.setParameter("chorus", data.setChorus)
      } else if ("setPolyphony" in data) {
        await this.playerReady
        this.player.setParameter("fluidpoly", data.setPolyphony)
      } else if ("setHumanize" in data) {
        await this.playerReady
        this.player.setParameter("humanize", data.setHumanize)
      } else if ("setScaleName" in data) {
        await this.playerReady
        this.player.setParameter("scalename", data.setScaleName)
      } else if ("setScaleRoot" in data) {
        await this.playerReady
        this.player.setParameter("scaleroot", data.setScaleRoot)
      } else if ("setDrunk" in data) {
        await this.playerReady
        this.player.setParameter("drunk", data.setDrunk)
      } else if ("gmReset" in data) {
        await this.playerReady
        this.player.setParameter("gmreset", true)
      } else if ("midiDevices" in data) {
        await this.playerReady
        this.player.setMidiDeviceNames(data.midiDevices)
      } else if ("noteOn" in data) {
        // Live messages bypass the file sequencer and must stay synchronous
        // to minimize input latency.
        if (!this.player) return
        const { channel, note, velocity } = data.noteOn
        this.player.noteOn(channel, note, velocity)
      } else if ("noteOff" in data) {
        if (!this.player) return
        const { channel, note } = data.noteOff
        this.player.noteOff(channel, note)
      } else if ("programChange" in data) {
        if (!this.player) return
        const { channel, program } = data.programChange
        this.player.programChange(channel, program)
      } else if ("controlChange" in data) {
        if (!this.player) return
        const { channel, controller, value } = data.controlChange
        this.player.controlChange(channel, controller, value)
      } else if ("pitchBend" in data) {
        if (!this.player) return
        const { channel, value } = data.pitchBend
        this.player.pitchBend(channel, value)
      } else if ("panic" in data) {
        if (!this.player) return
        this.player.panic()
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
      // Silent by default -- this is FluidSynth/libADLMIDI's raw internal
      // stdout/stderr (bank/program fallback notices, soundfont parse
      // chatter, etc.), routine and not user-actionable even at verbose
      // log levels. Swap back to console.debug(...) here temporarily if
      // ever chasing a real native-side bug.
      print: () => {},
      printErr: () => {},
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
    // Live callers need readiness independent of a loaded track. Include the
    // OPL3 bank names, which are only available after player construction.
    const opl3bankDef = this.player.paramDefs?.find?.(
      (def) => def.id === "opl3bank",
    )
    const opl3Banks = opl3bankDef?.options?.[0]?.items
    this.port.postMessage({ coreReady: true, opl3Banks })
  }

  /**
   * @param {Float32Array[][]} _
   * @param {Float32Array[][]} outputs
   */
  process(_, [output]) {
    for (let i = pendingTimers.length - 1; i >= 0; i--) {
      if (pendingTimers[i].fireAt <= globalThis.currentTime) {
        const [timer] = pendingTimers.splice(i, 1)
        timer.fn(...timer.args)
      }
    }

    if (this.paused) return this.running
    this.rb.processOutput(output)
    return this.running
  }
}

AudioProcessor.define("chiptune", ChiptuneProcessor)
