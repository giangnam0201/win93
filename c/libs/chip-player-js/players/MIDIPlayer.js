/* eslint-disable complexity */
import { Player } from "../Player.js"
import { MIDIFile } from "../../../../42/formats/midi/MIDIFile.js"
import { MIDIFilePlayer, SCALES } from "./MIDIPlayer/MIDIFilePlayer.js"
import {
  SOUNDFONTS,
  GM_DRUM_KITS,
  GM_INSTRUMENTS,
} from "./MIDIPlayer/MIDIConstants.js"
import { debounce } from "../../../../42/lib/timing/debounce.js"
import { noop } from "../../../../42/lib/type/function/noop.js"
import { EmscriptenFS } from "../../../../42/api/fs/class/EmscriptenFS.js"
import { lerp } from "../../../../42/lib/type/number/math.js"

// const SOUNDFONT_URL_PATH = "https://gifx.co/soundfonts/"
const SOUNDFONT_URL_PATH = "/c/libs/chip-player-js/soundfonts"
const SOUNDFONT_MOUNTPOINT = "/mount/soundfonts"

const dummyMidiOutput = { send: noop }
const midiDevices = [dummyMidiOutput]

// UI order (A -> G#), each paired with its MIDI pitch class (0 = C).
const SCALE_ROOTS = [
  ["A", 9],
  ["A#", 10],
  ["B", 11],
  ["C", 0],
  ["C#", 1],
  ["D", 2],
  ["D#", 3],
  ["E", 4],
  ["F", 5],
  ["F#", 6],
  ["G", 7],
  ["G#", 8],
]

const fileExtensions = [
  "mid", //
  "midi",
  "smf",
]

const MIDI_ENGINE_LIBFLUIDLITE = 0
const MIDI_ENGINE_LIBADLMIDI = 1
const MIDI_ENGINE_WEBMIDI = 2

export class MIDIPlayer extends Player {
  paramDefs = [
    {
      id: "synthengine",
      label: "Synth Engine",
      type: "enum",
      options: [
        {
          label: "MIDI Synthesis Engine",
          items: [
            {
              label: "SoundFont (libFluidLite)",
              value: MIDI_ENGINE_LIBFLUIDLITE,
            },
            {
              label: "Adlib/OPL3 FM (libADLMIDI)",
              value: MIDI_ENGINE_LIBADLMIDI,
            },
            {
              label: "MIDI Device (Web MIDI)",
              value: MIDI_ENGINE_WEBMIDI,
            },
          ],
        },
      ],
      defaultValue: 0,
    },
    {
      id: "soundfont",
      label: "Soundfont",
      type: "enum",
      options: SOUNDFONTS,
      // The only soundfont bundled with chip-player-js. Other soundfonts are
      // discovered from the file index by the application UI.
      defaultValue: "gmgsx-plus.sf2",
      dependsOn: {
        param: "synthengine",
        value: MIDI_ENGINE_LIBFLUIDLITE,
      },
    },
    {
      id: "reverb",
      label: "Reverb",
      type: "number",
      min: 0,
      max: 1,
      step: 0.01,
      // Not a GM/GS hardware standard, and this port's own call -- 0.33 was
      // just FluidSynth's own arbitrary softsynth default (matches
      // chiptune.app upstream, itself not standard either).
      defaultValue: 0,
      dependsOn: {
        param: "synthengine",
        value: MIDI_ENGINE_LIBFLUIDLITE,
      },
    },
    {
      id: "chorus",
      label: "Chorus",
      type: "number",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0,
      dependsOn: {
        param: "synthengine",
        value: MIDI_ENGINE_LIBFLUIDLITE,
      },
    },
    {
      id: "fluidpoly",
      label: "Polyphony",
      type: "number",
      min: 1,
      max: 256,
      step: 1,
      defaultValue: 128,
      dependsOn: {
        param: "synthengine",
        value: MIDI_ENGINE_LIBFLUIDLITE,
      },
    },
    {
      id: "opl3bank",
      label: "OPL3 Bank",
      type: "enum",
      options: [],
      defaultValue: 58, // Windows 95 bank
      dependsOn: {
        param: "synthengine",
        value: MIDI_ENGINE_LIBADLMIDI,
      },
    },
    {
      id: "mididevice",
      label: "MIDI Device",
      type: "enum",
      options: [
        {
          label: "MIDI Output Devices",
          items: [{ label: "Dummy device", value: 0 }],
        },
      ],
      defaultValue: 0,
      dependsOn: {
        param: "synthengine",
        value: MIDI_ENGINE_WEBMIDI,
      },
    },
    {
      id: "gmreset",
      label: "GM Reset",
      hint: "Send a General MIDI Reset sysex and reset all controllers on all channels.",
      type: "button",
    },
    {
      id: "humanize",
      label: "Humanize",
      hint: "Subtle random timing/velocity variation on Note On events, to counteract a sequenced file's perfectly mechanical feel. 0 = off.",
      type: "number",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0,
    },
    {
      // Always-on now -- there's no separate enable toggle any more
      // (removed: redundant with just picking Chromatic, see its label
      // below). Scale/Key still apply live as the file plays either way.
      id: "scalename",
      label: "Scale",
      type: "enum",
      options: [
        {
          label: "Scale",
          items: Object.keys(SCALES).map((name) => ({
            // "Chromatic" is every semitone -- i.e. quantizing is a no-op,
            // this is the "off" state now that there's no separate toggle.
            label: name === "Chromatic" ? "Chromatic (None)" : name,
            value: name,
          })),
        },
      ],
      defaultValue: "Chromatic",
    },
    {
      id: "scaleroot",
      label: "Scale Key",
      type: "enum",
      options: [
        {
          label: "Scale Key",
          items: SCALE_ROOTS.map(([label, value]) => ({ label, value })),
        },
      ],
      defaultValue: 9, // A
    },
    {
      id: "drunk",
      label: "Random Note",
      hint: "Percent chance a Note On plays the wrong pitch instead (shifted by a random amount, up to an octave either way). 0 = off.",
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 0,
    },
    {
      id: "modwheel",
      label: "Mod Wheel",
      hint: "MIDI CC1, sent on all channels. Feeds the soundfont's Vibrato LFO Pitch Depth (SF2 default modulator 8.4.4) -- how much periodic pitch wobble is layered on top of the note, if the instrument has a vibrato LFO configured at all. 0 = none.",
      type: "number",
      min: 0,
      max: 127,
      step: 1,
      defaultValue: 0,
    },
    {
      id: "pitchbend",
      label: "Pitch Bend",
      hint: "Sent on all channels. 14-bit, 8192 = center/no bend.",
      type: "number",
      min: 0,
      max: 16_383,
      step: 1,
      defaultValue: 8192,
    },
  ]

  constructor(core, sampleRate, bufferSize = 2048, debug = false) {
    super(core, sampleRate, bufferSize, debug)

    this.core._tp_init(this.sampleRate)

    // Initialize Soundfont filesystem
    this.FS = new EmscriptenFS(this.core.FS)
    this.FS.writeDir(SOUNDFONT_MOUNTPOINT)
    // this.core.FS.mount(this.core.FS.filesystems.IDBFS, {}, SOUNDFONT_MOUNTPOINT)

    this.name = "MIDI Player"
    this.fileExtensions = fileExtensions
    this.activeChannels = []
    this.buffer = this.core._malloc(this.bufferSize * 4 * 2) // f32 * 2 channels
    this.filepathMeta = {}

    const programChangeCb = () =>
      this.emit("playerStateUpdate", {
        voiceNames: Array.from({ length: this.getNumVoices() }, (_, i) =>
          this.getVoiceName(i),
        ),
      })

    this.midiFilePlayer = new MIDIFilePlayer({
      // playerStateUpdate is debounced to prevent flooding program change events
      programChangeCb: globalThis.setTimeout
        ? debounce(programChangeCb, 200)
        : programChangeCb,
      output: dummyMidiOutput,
      skipSilence: true,
      sampleRate: this.sampleRate,
      synth: {
        // TODO: Consider removing the tiny player (tp), since a lot of MIDI is now implemented in JS.
        //       All it's really doing is hiding the FluidSynth and libADLMIDI insances behind a singleton.
        //       C object ("context") pointers could also be hidden at the JS layer, if those are annoying.
        //       The original benefit was to tie in tml.h (MIDI file reader) which is not used any more.
        //       Besides, MIDIPlayer.js already calls directly into libADLMIDI functions.
        //       see also ../../scripts/build-chip-core.js:29
        noteOn: this.core._tp_note_on,
        noteOff: this.core._tp_note_off,
        pitchBend: this.core._tp_pitch_bend,
        controlChange: this.core._tp_control_change,
        programChange: this.core._tp_program_change,
        panic: this.core._tp_panic,
        panicChannel: this.core._tp_panic_channel,
        render: this.core._tp_render,
        reset: this.core._tp_reset,
        getValue: this.core.getValue,
      },
    })

    // Populate OPL3 banks
    const numBanks = this.core._adl_getBanksCount()
    const ptr = this.core._adl_getBankNames()
    const oplBanks = []
    for (let i = 0; i < numBanks; i++) {
      oplBanks.push({
        label: this.core.UTF8ToString(this.core.getValue(ptr + i * 4, "*")),
        value: i,
      })
    }
    // console.log(oplBanks)
    this.paramDefs.find((def) => def.id === "opl3bank").options = [
      { label: "OPL3 Bank", items: oplBanks },
    ]

    this.webMidiIsInitialized = false
    // this.midiFilePlayer = new MIDIFilePlayer({ output: dummyMidiOutput });

    // Initialize parameters
    this.params = {}
    // Transient parameters hold a parameter that is valid only for the current song.
    // They are reset when another song is loaded.
    this.transientParams = {}
    this.paramDefs
      .filter((p) => p.id !== "soundfont")
      .forEach((p) => {
        this.setParameter(p.id, p.defaultValue)
      })
  }

  handleFileSystemReady() {
    const soundfontParam = this.paramDefs.find(
      (paramDef) => paramDef.id === "soundfont",
    )
    this.setParameter(soundfontParam.id, soundfontParam.defaultValue)
    this.updateSoundfontParamDefs()
  }

  processAudioInner(channels) {
    const useWebMIDI = this.params.synthengine === MIDI_ENGINE_WEBMIDI

    // No early return or zero-fill during pause.
    // Notes are allowed to ring out, and the MIDI synth behaves more like external hardware.

    if (useWebMIDI) {
      // Audio goes out over Web MIDI to an external device, not through
      // this worklet -- channels is a reused ring-buffer slot, so without
      // explicitly silencing it here it keeps replaying whatever the
      // FluidLite/OPL3 branch last rendered into it before the engine
      // switch, which sounds exactly like "it reverted to the soundfont".
      for (let ch = 0; ch < channels.length; ch++) channels[ch].fill(0)
      this.midiFilePlayer.processPlay()
    } else if (
      this.midiFilePlayer.processPlaySynth(this.buffer, this.bufferSize)
    ) {
      for (let ch = 0; ch < channels.length; ch++) {
        for (let i = 0; i < this.bufferSize; i++) {
          channels[ch][i] = this.core.getValue(
            this.buffer + // Interleaved channel format
              i * 4 * 2 + // frame offset   * bytes per sample * num channels +
              ch * 4, // channel offset * bytes per sample
            "float",
          )
        }
      }
    } else {
      this.stop()
    }
  }

  /** @param {string} filepath */
  metadataFromFilepath(filepath) {
    filepath = decodeURIComponent(filepath) // unescape, %25 -> %
    const parts = filepath.split("/")
    const len = parts.length
    const meta = {}
    // HACK: MIDI metadata is guessed from filepath
    // based on the directory structure of Chip Player catalog.
    // Ideally, this data should be embedded in the MIDI files.
    if (parts.length >= 3) {
      meta.formatted = {
        title: `${parts[1]} - ${parts[len - 1]}`,
        subtitle: parts[0],
      }
    } else if (parts.length === 2) {
      meta.formatted = {
        title: parts[1],
        subtitle: parts[0],
      }
    } else {
      meta.formatted = {
        title: parts[0],
        subtitle: "MIDI",
      }
    }
    return meta
  }

  /**
   * AudioWorkletGlobalScope has no navigator, so Web MIDI access can't be
   * requested from here. The main thread (ChiptuneNode.js) requests it and
   * reports back just the device names; each "device" registered here is
   * a proxy whose send() posts back to the main thread to be dispatched
   * on the real MIDIOutput.
   * @param {string[]} names
   */
  setMidiDeviceNames(names) {
    if (this.webMidiIsInitialized === true) return
    this.webMidiIsInitialized = true

    if (names.length === 0) {
      console.warn("No MIDI output devices found.")
      return
    }

    names.forEach((name, deviceIndex) => {
      midiDevices.push({
        name,
        send: (message, timestamp) => {
          // timestamp (when present) is in globalThis.performance's shimmed
          // milliseconds (see ChiptuneProcessor.js: currentTime * 1000 +
          // tiny tie-breaker) -- meaningless on the main thread, whose real
          // performance.now() has a completely different origin. Undo the
          // *1000 to recover plain audioContext.currentTime seconds, which
          // IS the same clock the main thread's context uses (unlike
          // performance.now()) -- see ChiptuneNode.js's midiOut handler.
          // Calls with no timestamp (panic()/reset() fired bare,
          // allNotesOff()) never had precise timing to begin with; leave
          // undefined so they still go out immediately.
          this.worklet?.port.postMessage({
            midiOut: {
              deviceIndex,
              message,
              timestamp:
                typeof timestamp === "number" ? timestamp / 1000 : undefined,
            },
          })
        },
      })
      this.paramDefs
        .find((def) => def.id === "mididevice")
        .options[0].items.push({ label: name, value: midiDevices.length - 1 })
    })

    // Let the main thread know the device list is ready to display.
    this.emit("playerStateUpdate", { paramDefs: this.getParamDefs() })

    // TODO: remove if removing Dummy Device
    this.setParameter("mididevice", 1)
  }

  async loadData(data, filepath) {
    this.filepathMeta = this.metadataFromFilepath(filepath)

    const newTransientParams = {}

    // Web MIDI device access is requested explicitly (Settings > Synth
    // Engine), not on every track load -- see setMidiDeviceNames() above.

    // Apply transient params. Avoid thrashing of params that haven't changed.
    Object.keys(this.params).forEach((key) => {
      if (newTransientParams[key] !== this.transientParams[key]) {
        this.setTransientParameter(key, newTransientParams[key])
      }
    })

    const midiFile = new MIDIFile(data)
    // console.log(midiFile)
    // Checking filepath doesn't work for dragged files. Force to true during development.
    const useTrackLoops = filepath.includes("SoundFont MIDI")
    this.midiFilePlayer.load(midiFile, useTrackLoops)
    this.midiFilePlayer.play(() =>
      this.emit("playerStateUpdate", { isStopped: true }),
    )

    this.activeChannels = []
    for (let i = 0; i < 16; i++) {
      if (this.midiFilePlayer.getChannelInUse(i)) this.activeChannels.push(i)
    }

    this.resume()
    this.emit("playerStateUpdate", {
      ...this.getBasePlayerState(),
      isStopped: false,
    })
  }

  isPlaying() {
    return !this.midiFilePlayer.paused
  }

  suspend() {
    super.suspend()
    this.midiFilePlayer.stop()
  }

  stop() {
    this.suspend()
    this.emit("playerStateUpdate", { isStopped: true })
  }

  // Releases any note currently ringing (sustain pedal, all sound off,
  // controller reset) without touching position or emitting isStopped --
  // unlike stop(), this doesn't end the track, so pausing mid-note doesn't
  // leave it stuck on when playback resumes. See ChiptuneProcessor.js's
  // "paused" handling.
  panic() {
    this.midiFilePlayer.panic()
  }

  noteOn(channel, note, velocity) {
    this.midiFilePlayer.synth.noteOn(channel, note, velocity)
  }

  noteOff(channel, note) {
    this.midiFilePlayer.synth.noteOff(channel, note)
  }

  programChange(channel, program) {
    this.midiFilePlayer.synth.programChange(channel, program)
  }

  controlChange(channel, controller, value) {
    this.midiFilePlayer.synth.controlChange(channel, controller, value)
  }

  pitchBend(channel, value) {
    this.midiFilePlayer.synth.pitchBend(channel, value)
  }

  togglePause() {
    return this.midiFilePlayer.togglePause()
  }

  getDurationMs() {
    return this.midiFilePlayer.getDuration()
  }

  getPositionMs() {
    return this.midiFilePlayer.getPosition()
  }

  seekMs(ms) {
    return this.midiFilePlayer.setPosition(ms)
  }

  getTempo() {
    return this.midiFilePlayer.getSpeed()
  }

  setTempo(tempo) {
    this.midiFilePlayer.setSpeed(tempo)
  }

  getTranspose() {
    return this.midiFilePlayer.getTranspose()
  }

  setTranspose(semitones) {
    this.midiFilePlayer.setTranspose(semitones)
  }

  setMidiVolume(value) {
    this.midiFilePlayer.setMasterVolume(value)
  }

  getNumVoices() {
    return this.activeChannels.length
  }

  getVoiceName(index) {
    const ch = this.activeChannels[index]
    const pgm = this.midiFilePlayer.channelProgramNums[ch]
    return ch === 9 ? GM_DRUM_KITS[pgm] || GM_DRUM_KITS[0] : GM_INSTRUMENTS[pgm]
  }

  getVoiceMask() {
    return this.activeChannels.map((ch) => this.midiFilePlayer.channelMask[ch])
  }

  setVoiceMask(voiceMask) {
    voiceMask.forEach((isEnabled, i) => {
      const ch = this.activeChannels[i]
      this.midiFilePlayer.setChannelMute(ch, !isEnabled)
    })
  }

  getMetadata() {
    return this.filepathMeta
  }

  // getParameter() already knows how to read each of these live (fluidpoly
  // in particular comes straight from the native synth) -- surfaced here so
  // the Settings dialog can show current values instead of just defaults.
  getBasePlayerState() {
    return {
      ...super.getBasePlayerState(),
      reverb: this.getParameter("reverb"),
      chorus: this.getParameter("chorus"),
      polyphony: this.getParameter("fluidpoly"),
    }
  }

  getInfoTexts() {
    return [this.midiFilePlayer.textInfo.join("\n")].filter(
      (text) => text !== "",
    )
  }

  getParameter(id) {
    if (id === "fluidpoly") return this.core._tp_get_polyphony()
    if (this.transientParams[id] != null) return this.transientParams[id]
    return this.params[id]
  }

  updateSoundfontParamDefs() {
    this.paramDefs = this.paramDefs.map((paramDef) => {
      if (paramDef.id === "soundfont") {
        const userSoundfonts = paramDef.options[0]
        const userSoundfontPath = `${SOUNDFONT_MOUNTPOINT}/user/`
        if (this.core.FS.analyzePath(userSoundfontPath).exists) {
          userSoundfonts.items = this.core.FS.readdir(userSoundfontPath)
            .filter((f) => f.match(/\.sf2$/i))
            .map((f) => ({
              label: f,
              value: `user/${f}`,
            }))
        }
      }
      return paramDef
    })
  }

  setTransientParameter(id, value) {
    if (value == null) {
      // Unset the transient parameter.
      this.setParameter(id, this.params[id])
    } else {
      this.setParameter(id, value, true)
    }
  }

  setFluidChorus(value) {
    const fluidSynth = this.core._tp_get_fluid_synth()
    if (value === 0) {
      this.core._fluid_synth_set_chorus_on(fluidSynth, false)
    } else {
      this.core._fluid_synth_set_chorus_on(fluidSynth, true)
      // FLUID_CHORUS_DEFAULT_N 3 (0 to 99)
      const nr = 3
      // FLUID_CHORUS_DEFAULT_LEVEL 2.0f (0 to 10)
      const level = Math.round(lerp(value, 0, 4))
      // FLUID_CHORUS_DEFAULT_SPEED 0.3f (0.29 to 5)
      const speed = 0.3
      // FLUID_CHORUS_DEFAULT_DEPTH 8.0f (0 to ~100)
      const depthMs = Math.round(lerp(value, 2, 14))
      // FLUID_CHORUS_DEFAULT_TYPE FLUID_CHORUS_MOD_SINE
      //   FLUID_CHORUS_MOD_SINE = 0,
      //   FLUID_CHORUS_MOD_TRIANGLE = 1
      const type = 0
      // (fluid_synth_t* synth, int nr, double level, double speed, double depth_ms, int type)
      this.core._fluid_synth_set_chorus(
        fluidSynth,
        nr,
        level,
        speed,
        depthMs,
        type,
      )
    }
  }

  setParameter(id, value, isTransient = false) {
    switch (id) {
      case "synthengine":
        value = Number.parseInt(value, 10)
        if (
          this.params.synthengine === MIDI_ENGINE_WEBMIDI &&
          value !== MIDI_ENGINE_WEBMIDI
        ) {
          // Leaving Web MIDI mid-playback: panic() below sends its cleanup
          // immediately, but it can't reach notes that were ALREADY queued
          // on the main thread's AudioClock (up to BUFFER_AHEAD=33ms of
          // lookahead scheduling -- see MIDIFilePlayer.js) before this
          // switch happened. Those still fire at their scheduled time,
          // *after* panic()'s cleanup went out -- and since useWebMIDI is
          // about to become false, nothing will ever send their matching
          // Note Off. Tell the main thread to drop anything still pending
          // before that can happen; see ChiptuneNode.js's handler.
          this.worklet?.port.postMessage({ cancelPendingMidiOut: true })
        }
        this.midiFilePlayer.panic()
        if (value === MIDI_ENGINE_WEBMIDI) {
          this.midiFilePlayer.setUseWebMIDI(true)
        } else {
          this.midiFilePlayer.setUseWebMIDI(false)
          this.core._tp_set_synth_engine(value)
          if (value === MIDI_ENGINE_LIBFLUIDLITE && this.params.soundfont) {
            this.loadSoundfont(this.params.soundfont)
          } else if (value === MIDI_ENGINE_LIBADLMIDI && this.params.opl3bank) {
            this.core._tp_set_bank(this.params.opl3bank)
          }
        }
        // OPL has no native polyphony control the way FluidSynth does --
        // fall back to the same JS-level voice-stealing used for Web MIDI.
        this.midiFilePlayer.setUseOplPolyphonyLimit(
          value === MIDI_ENGINE_LIBADLMIDI,
        )
        break
      case "soundfont":
        if (this.params.synthengine === MIDI_ENGINE_LIBFLUIDLITE) {
          this.loadSoundfont(value)
        }
        break
      case "reverb":
        // TODO: call fluidsynth directly from JS, similar to chorus
        value = Number.parseFloat(value)
        this.core._tp_set_reverb(value)
        break
      case "chorus":
        value = Number.parseFloat(value)
        this.setFluidChorus(value)
        break
      case "fluidpoly":
        // TODO: call fluidsynth directly from JS, similar to chorus
        value = Number.parseInt(value, 10)
        this.core._tp_set_polyphony(value)
        // Harmless when the active engine isn't Web MIDI -- the limiter
        // only ever gets consulted from processPlay()'s useWebMIDI branch.
        this.midiFilePlayer.setPolyphonyLimit(value)
        break
      case "opl3bank":
        value = Number.parseInt(value, 10)
        this.core._tp_set_bank(value)
        break
      case "mididevice":
        this.midiFilePlayer.setOutput(midiDevices[value])
        break
      case "gmreset":
        this.midiFilePlayer.reset()
        break
      case "humanize":
        value = Number.parseFloat(value)
        this.midiFilePlayer.setHumanize(value)
        break
      case "scalename":
        this.midiFilePlayer.setScaleName(value)
        break
      case "scaleroot":
        value = Number.parseInt(value, 10)
        this.midiFilePlayer.setScaleRoot(value)
        break
      case "drunk":
        value = Number.parseFloat(value)
        this.midiFilePlayer.setDrunk(value)
        break
      case "modwheel":
      case "pitchbend":
        value = Number.parseInt(value, 10)
        this.midiFilePlayer.setLiveController(id, value)
        break
      default:
        console.warn('MIDIPlayer has no parameter with id "%s".', id)
    }

    // This should be the only place we modify transientParams.
    if (isTransient) {
      this.transientParams[id] = value
    } else {
      delete this.transientParams[id]
      this.params[id] = value
    }
  }

  _loadSoundfont(filename) {
    this.muteAudioDuringCall(this.audioNode, () => {
      const err = this.core.ccall(
        "tp_load_soundfont",
        "number",
        ["string"],
        [filename],
      )
      if (err === -1) {
        // A clean, synchronous failure return -- not a WASM trap -- likely
        // means tp_load_soundfont() couldn't allocate for this one (see the
        // leak documented in loadSoundfont() below). Unlike a genuine
        // memory-out-of-bounds trap, this signal is reliable: same call
        // site every time, no async boundary to lose it across. Emitted
        // through the same event mechanism as playerStateUpdate (Player
        // extends Emitter) -- ChiptuneProcessor.js's "*" listener forwards
        // it to the main thread the same way. MediaPlayer.js's "crashed"
        // handler surfaces this as a toast -- that's the visible signal
        // now, no console line needed alongside it.
        this.emit("crashed", { message: "Error loading soundfont." })
      }
    })
  }

  async loadSoundfont(value) {
    this.updateSoundfontParamDefs()

    const filename = `${SOUNDFONT_MOUNTPOINT}/${value}`

    if (this.worklet) {
      await this.FS.write(filename, new Uint8Array(this.soundfontBuffer))
      // await this.FS.ensureFile(filename, this.soundfontBuffer)
    } else {
      await this.FS.ensureFile(filename, `${SOUNDFONT_URL_PATH}/${value}`, {
        sync: true,
      })
    }

    this.core._tp_set_ch10_melodic(false)

    // Swapping the soundfont changes the instrument/voice mapping notes
    // currently sounding were using -- same stuck-note risk as transpose,
    // release everything first.
    this.midiFilePlayer.allNotesOff()

    // Tried calling the exported-but-never-used tp_unload_soundfont() here
    // to release FluidSynth's own retained soundfont memory before loading
    // the next one (tp_load_soundfont() appears to add rather than
    // replace). Confirmed via direct WASM binary inspection that it takes
    // zero arguments, exactly as called -- not a signature mistake. But
    // live testing showed it hangs the whole tab after several
    // load/unload cycles, with no console error, which is worse than the
    // original OOM crash it was meant to fix. Reverted; whatever it does
    // internally isn't safe to call from here without the actual C
    // source. If this becomes a real problem, the practical workaround is
    // avoiding many switches between very large soundfonts in one session.
    this._loadSoundfont(filename)

    // Emscripten's virtual FS never frees files on its own -- every
    // distinct soundfont ever selected during the session would otherwise
    // stay mounted (and taking up WASM heap memory) forever. Unlink AFTER
    // the new one has finished loading (tp_load_soundfont already copied
    // what it needs into FluidSynth's own structures), so there's no
    // window where the old file could still be needed.
    if (
      this.currentSoundfontFilename &&
      this.currentSoundfontFilename !== filename
    ) {
      try {
        this.core.FS.unlink(this.currentSoundfontFilename)
      } catch (err) {
        console.warn(
          `Failed to unlink old soundfont file: ${this.currentSoundfontFilename}`,
          err,
        )
      }
    }
    this.currentSoundfontFilename = filename
  }
}
