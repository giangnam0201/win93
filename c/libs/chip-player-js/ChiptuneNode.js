import { loadArrayBuffer } from "../../../42/api/load/loadArrayBuffer.js"
import { AudioProcessorNode } from "../../../42/lib/audio/AudioProcessorNode.js"
import { Emittable } from "../../../42/lib/class/mixin/Emittable.js"
import { defer } from "../../../42/lib/type/promise/defer.js"
import { MIDIFilePlayer } from "./players/MIDIPlayer/MIDIFilePlayer.js"
import { MIDIFile } from "../../../42/formats/midi/MIDIFile.js"
import { AudioClock } from "../../../42/lib/audio/AudioClock.js"

const soundfontCache = new Map()

const DEFAULT_SOUNDFONT_URL = import.meta.resolve("./soundfonts/gmgsx-plus.sf2")

function resolveSoundfontURL(soundfont) {
  if (!soundfont || soundfont === "gmgsx-plus.sf2") {
    return DEFAULT_SOUNDFONT_URL
  }
  return soundfont.startsWith("/")
    ? new URL(soundfont, import.meta.url).href
    : import.meta.resolve(`./soundfonts/${soundfont}`)
}

const WEB_MIDI_TICK_SECONDS = 0.015

const LIVE_CONTROLLER_THROTTLE_MS = 50

export class ChiptuneNode extends Emittable(AudioProcessorNode) {
  static module = new URL("./ChiptuneProcessor.js", import.meta.url).href

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
    this.#webMidiPlayer?.setPosition(currentTime * 1000)
  }

  #webMidiPlayer
  #webMidiClock
  #webMidiDeviceIndex
  #trackUrl
  #webMidiEndCallback = () => {
    if (!this.stoppedFromGUI) this.emit("ended")
  }

  constructor(context, options) {
    const {
      type,
      soundfont,
      bufferSize: requestedBufferSize,
      ...parameterData
    } = options

    const bufferSize =
      requestedBufferSize ??
      Math.max(
        2 **
          Math.ceil(
            Math.log2((context.baseLatency || 0.001) * context.sampleRate),
          ),
        2048,
      )

    const soundfontURL = resolveSoundfontURL(soundfont)

    super(context, "chiptune", {
      numberOfInputs: 0,
      channelCountMode: "explicit",
      outputChannelCount: [2],
      processorOptions: { bufferSize, type, soundfontURL },
      parameterData,
    })

    this.type = type

    this.ready = defer()
    this.coreReady = defer()

    this.port.addEventListener("message", ({ data }) => {
      if (data.coreReady) {
        this.opl3Banks = data.opl3Banks
        this.coreReady.resolve()
      } else if (data.requestWasm) {
        loadArrayBuffer(import.meta.resolve("./chip-core.wasm")).then(
          async (arrayBuffer) => {
            let soundfontBuffer
            const transfers = [arrayBuffer]
            if (type === "midi") {
              const result = await this.loadSoundfontBuffer(soundfontURL)
              soundfontBuffer = result.buffer
              if (result.fellBack) this.soundfontFallback = "gmgsx-plus.sf2"
              transfers.push(soundfontBuffer)
            }
            this.port.postMessage(
              { createCore: arrayBuffer, soundfontBuffer },
              transfers,
            )
          },
        )
      } else if (data.requestSoundfont) {
        this.loadSoundfontBuffer(soundfontURL).then(({ buffer, fellBack }) => {
          if (fellBack) this.soundfontFallback = "gmgsx-plus.sf2"
          this.port.postMessage({ createCore: true, soundfontBuffer: buffer }, [
            buffer,
          ])
        })
      } else if (data.event) {
        if (data.event.type === "playerStateUpdate") {
          if (data.event.data.isStopped) {
            if (!this.stoppedFromGUI && !this.#webMidiPlayer) this.emit("ended")
            this.stoppedFromGUI = false
          } else if (data.event.data.durationMs) {
            this.state = data.event.data
            this.duration = data.event.data.durationMs / 1000
            this.ready.resolve()
            this.emit("state", this.state)
          } else if (this.state) {
            Object.assign(this.state, data.event.data)
            this.emit("state", this.state)
          }
        } else if (data.event.type === "crashed") {
          this.emit("crashed", data.event.data)
        }
      } else if (data.initSAB) {
        this.#currentTimeSab = new Float64Array(data.initSAB)
      } else if (data.requestMidiAccess) {
        this.ensureWebMidi().catch((err) => {
          console.warn("Web MIDI access failed:", err)
        })
      } else if (data.midiOut) {
        if (this.#webMidiPlayer) return
        const { deviceIndex, message, timestamp } = data.midiOut
        const output = this.midiOutputs?.[deviceIndex]
        if (!output) return
        try {
          if (typeof timestamp === "number") {
            output.send(message, timestamp * 1000 + this.performanceEpochOffset)
          } else {
            output.send(message)
          }
        } catch (err) {
          console.warn("MIDIOutput.send() failed:", err, message)
        }
      }
    })

    this.port.start()
  }

  async loadTrack(url) {
    if (!url) return
    this.#trackUrl = url
    this.ready = defer()
    await loadArrayBuffer(url).then((arrayBuffer) => {
      this.port.postMessage({ track: { arrayBuffer, url } }, [arrayBuffer])
    })

    await this.ready

    if (this.#webMidiPlayer) {
      const player = this.#webMidiPlayer
      await this.#loadWebMidiTrack(url)
      if (this.#webMidiPlayer === player) player.play(this.#webMidiEndCallback)
    }
  }

  async #loadWebMidiTrack(url) {
    const arrayBuffer = await loadArrayBuffer(url)
    const midiFile = new MIDIFile(new Uint8Array(arrayBuffer))
    this.#webMidiPlayer.load(midiFile)
  }

  async fetchSoundfont(url) {
    const cached = soundfontCache.get(url)
    if (cached) return cached.slice(0)
    const master = await loadArrayBuffer(url)
    soundfontCache.set(url, master)
    return master.slice(0)
  }

  async loadSoundfontBuffer(url) {
    const fallbackURL = DEFAULT_SOUNDFONT_URL
    try {
      return { buffer: await this.fetchSoundfont(url), fellBack: false }
    } catch (err) {
      if (url === fallbackURL) throw err
      console.warn(
        `Soundfont not found (${url}), falling back to default.`,
        err,
      )
      return { buffer: await this.fetchSoundfont(fallbackURL), fellBack: true }
    }
  }

  applySoundfontBuffer(url, buffer, fellBack = false) {
    if (this.type !== "midi") return
    const value = fellBack ? "gmgsx-plus.sf2" : url.split("/").pop()
    this.port.postMessage({ setSoundfont: { value, buffer } }, [buffer])
  }

  async setSoundfont(url) {
    if (this.type !== "midi") return
    const { buffer, fellBack } = await this.loadSoundfontBuffer(url)
    this.applySoundfontBuffer(url, buffer, fellBack)
  }

  setVoiceMask(voiceMask) {
    if (this.state) this.state.voiceMask = voiceMask
    this.port.postMessage({ setVoiceMask: voiceMask })
    if (this.#webMidiPlayer) {
      let i = 0
      for (let ch = 0; ch < 16; ch++) {
        if (!this.#webMidiPlayer.getChannelInUse(ch)) continue
        this.#webMidiPlayer.setChannelMute(ch, voiceMask[i] === false)
        i++
      }
    }
  }

  setSynthEngine(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setSynthEngine: value })
    if (value === 2) {
      this.#ensureWebMidiPlayer().catch((err) => {
        console.warn("Web MIDI (main-thread player) setup failed:", err)
      })
    } else {
      this.#teardownWebMidiPlayer()
    }
  }

  setOpl3Bank(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setOpl3Bank: value })
  }

  setMidiDevice(index) {
    if (this.type !== "midi") return
    this.port.postMessage({ setMidiDevice: index })
    this.#webMidiDeviceIndex = index - 1
  }

  async #ensureWebMidiPlayer() {
    if (this.#webMidiPlayer) return
    this.#webMidiDeviceIndex ??= 0
    const player = (this.#webMidiPlayer = new MIDIFilePlayer({
      skipSilence: false,
      sampleRate: this.context.sampleRate,
      programChangeCb: () => {},
      output: {
        send: (message, timestamp) => {
          const output = this.midiOutputs?.[this.#webMidiDeviceIndex]
          if (!output) return
          try {
            output.send(message, timestamp)
          } catch (err) {
            console.warn("MIDIOutput.send() failed:", err, message)
          }
        },
      },
    }))
    player.useWebMIDI = true

    if (this.#trackUrl) await this.#loadWebMidiTrack(this.#trackUrl)
    if (this.#webMidiPlayer !== player) return

    if (this.currentTime > 0) {
      player.endCallback = this.#webMidiEndCallback
      player.setPosition(this.currentTime * 1000)
      if (!this.paused) player.resume()
    } else if (!this.paused) {
      player.play(this.#webMidiEndCallback)
    }

    if (!this.#webMidiClock) {
      this.#webMidiClock = new AudioClock(this.context)
      await this.#webMidiClock.init()
      if (this.#webMidiPlayer !== player) return
    }
    this.#webMidiClock.start()
    this.#webMidiClock
      .setTimeout(
        () => this.#webMidiPlayer?.processPlay(),
        WEB_MIDI_TICK_SECONDS,
      )
      .repeat(WEB_MIDI_TICK_SECONDS)
  }

  #teardownWebMidiPlayer() {
    if (!this.#webMidiPlayer) return
    this.#webMidiClock?.stop()
    this.#webMidiPlayer.stop()
    this.#webMidiPlayer = undefined
  }

  setTempo(value) {
    this.port.postMessage({ setTempo: value })
    this.#webMidiPlayer?.setSpeed(Number.parseFloat(value))
  }

  setTranspose(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setTranspose: value })
    this.#webMidiPlayer?.setTranspose(value)
  }

  setMidiVolume(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setMidiVolume: value })
    this.#webMidiPlayer?.setMasterVolume(value)
  }

  setPlayerParameter(id, value) {
    this.port.postMessage({ setPlayerParameter: { id, value } })
    if ((id === "modwheel" || id === "pitchbend") && this.#webMidiPlayer) {
      this.#sendLiveControllerThrottled(id, Number.parseInt(value, 10))
    }
  }

  #liveControllerThrottle = new Map()
  #sendLiveControllerThrottled(id, value) {
    let state = this.#liveControllerThrottle.get(id)
    if (!state) {
      state = { lastSent: -Infinity, timer: undefined, pending: undefined }
      this.#liveControllerThrottle.set(id, state)
    }
    state.pending = value
    const elapsed = performance.now() - state.lastSent
    if (elapsed >= LIVE_CONTROLLER_THROTTLE_MS) {
      state.lastSent = performance.now()
      this.#webMidiPlayer.setLiveController(id, value)
    } else if (!state.timer) {
      state.timer = setTimeout(() => {
        state.timer = undefined
        state.lastSent = performance.now()
        this.#webMidiPlayer?.setLiveController(id, state.pending)
      }, LIVE_CONTROLLER_THROTTLE_MS - elapsed)
    }
  }

  setReverb(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setReverb: value })
  }

  setChorus(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setChorus: value })
  }

  setPolyphony(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setPolyphony: value })
    this.#webMidiPlayer?.setPolyphonyLimit(Number.parseInt(value, 10))
  }

  setHumanize(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setHumanize: value })
    this.#webMidiPlayer?.setHumanize(Number.parseFloat(value))
  }

  setScaleName(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setScaleName: value })
    this.#webMidiPlayer?.setScaleName(value)
  }

  setScaleRoot(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setScaleRoot: value })
    this.#webMidiPlayer?.setScaleRoot(Number.parseInt(value, 10))
  }

  setDrunk(value) {
    if (this.type !== "midi") return
    this.port.postMessage({ setDrunk: value })
    this.#webMidiPlayer?.setDrunk(Number.parseFloat(value))
  }

  resetGm() {
    if (this.type !== "midi") return
    this.port.postMessage({ gmReset: true })
    this.#webMidiPlayer?.reset()
  }

  noteOn(channel, note, velocity) {
    if (this.type !== "midi") return
    this.port.postMessage({ noteOn: { channel, note, velocity } })
  }

  noteOff(channel, note) {
    if (this.type !== "midi") return
    this.port.postMessage({ noteOff: { channel, note } })
  }

  programChange(channel, program) {
    if (this.type !== "midi") return
    this.port.postMessage({ programChange: { channel, program } })
  }

  controlChange(channel, controller, value) {
    if (this.type !== "midi") return
    this.port.postMessage({ controlChange: { channel, controller, value } })
  }

  pitchBend(channel, value) {
    if (this.type !== "midi") return
    this.port.postMessage({ pitchBend: { channel, value } })
  }

  panic() {
    if (this.type !== "midi") return
    this.port.postMessage({ panic: true })
  }

  async ensureWebMidi() {
    if (this.midiAccess) return this.midiAccess
    this.performanceEpochOffset =
      performance.now() - this.context.currentTime * 1000
    this.midiAccess = await navigator.requestMIDIAccess({ sysex: true })
    this.midiOutputs = [...this.midiAccess.outputs.values()]
    this.port.postMessage({
      midiDevices: this.midiOutputs.map((o) => o.name),
    })
    return this.midiAccess
  }

  async play() {
    this.paused = false
    this.port.postMessage({ paused: false })
    const player = this.#webMidiPlayer
    if (player?.paused) {
      if (player.position === 0) player.play(this.#webMidiEndCallback)
      else player.togglePause()
    }
  }

  pause() {
    this.paused = true
    this.port.postMessage({ paused: true })
    if (this.#webMidiPlayer && !this.#webMidiPlayer.paused) {
      this.#webMidiPlayer.togglePause()
    }
  }

  stop(options) {
    this.paused = true
    this.port.postMessage({ paused: true })
    if (this.#webMidiPlayer) {
      this.#webMidiPlayer.stop()
      this.#webMidiPlayer.position = 0
      this.#webMidiPlayer.elapsedTime = 0
    }
    if (options?.ended) return
    this.stoppedFromGUI = true
    this.port.postMessage({ stopPlayer: true })
  }
}
