import { ChiptuneNode } from "/c/libs/chip-player-js/ChiptuneNode.js"
import { DEFAULT_SOUNDFONT } from "/c/libs/chip-player-js/soundfonts.js"

export const ENGINES = {
  FLUIDSYNTH: "fluidsynth",
  OPL3: "opl3",
  MIDI_DEVICE: "mididevice",
}

const MIDI_ENGINE_LIBFLUIDLITE = 0
const MIDI_ENGINE_LIBADLMIDI = 1

const DEFAULT_OPL3_BANK = 58

export function createDefaultConfig() {
  return {
    midiChannel: 0,
    engine: ENGINES.FLUIDSYNTH,
    soundfont: DEFAULT_SOUNDFONT,
    opl3Bank: DEFAULT_OPL3_BANK,
    midiOutputId: null,
    program: 0,
  }
}

export function createRouter(context, destination, config) {
  let node = null
  let opl3Banks = []
  let midiOutputs = new Map()
  const heldNotes = new Set()
  let onNoteStateChange
  let onNoteToggle
  let onProgramChange
  let onSoundfontFallback

  function setMidiOutputs(outputs) {
    midiOutputs = new Map(outputs.map((output) => [output.id, output]))
  }

  function setOnNoteStateChange(fn) {
    onNoteStateChange = fn
  }

  function setOnNoteToggle(fn) {
    onNoteToggle = fn
  }

  function setOnProgramChange(fn) {
    onProgramChange = fn
  }

  function setOnSoundfontFallback(fn) {
    onSoundfontFallback = fn
  }

  function getOpl3Banks() {
    return opl3Banks
  }

  function silenceCurrentVoice() {
    if (heldNotes.size === 0) return
    if (
      config.engine === ENGINES.FLUIDSYNTH ||
      config.engine === ENGINES.OPL3
    ) {
      node?.panic()
    } else if (config.engine === ENGINES.MIDI_DEVICE) {
      midiOutputs
        .get(config.midiOutputId)
        ?.send([0xb0 | config.midiChannel, 123, 0])
    }
    const notes = [...heldNotes]
    heldNotes.clear()
    onNoteStateChange?.(false)
    for (const note of notes) onNoteToggle?.(note, false)
  }

  const LIVE_BUFFER_SIZE = 128

  async function ensureNode() {
    if (node) return false
    await ChiptuneNode.load(context)
    node = new ChiptuneNode(context, {
      type: "midi",
      soundfont: config.soundfont,
      bufferSize: LIVE_BUFFER_SIZE,
    })
    node.connect(destination)
    await node.coreReady
    await node.play()
    opl3Banks = (node.opl3Banks ?? []).map((bank) => [
      bank.label,
      String(bank.value),
    ])
    if (node.soundfontFallback) {
      console.warn(
        `[MidiXpander] soundfont "${config.soundfont}" failed to load, fell back to gmgsx-plus.sf2`,
      )
      onSoundfontFallback?.(config.soundfont)
    }
    return true
  }

  async function applySoundfont(soundfontValue) {
    const url = soundfontValue
    console.log(`[MidiXpander] loading soundfont "${soundfontValue}"...`)
    console.time(`[MidiXpander] soundfont "${soundfontValue}"`)
    const { buffer, fellBack } = await node.loadSoundfontBuffer(url)
    console.timeEnd(`[MidiXpander] soundfont "${soundfontValue}"`)
    if (fellBack) {
      console.warn(
        `[MidiXpander] soundfont "${soundfontValue}" failed to load, fell back to gmgsx-plus.sf2`,
      )
      onSoundfontFallback?.(soundfontValue)
    } else {
      console.log(`[MidiXpander] soundfont "${soundfontValue}" ready`)
    }
    const now = context.currentTime
    destination.gain.cancelScheduledValues(now)
    destination.gain.setTargetAtTime(0, now, 0.015)
    await new Promise((resolve) => setTimeout(resolve, 30))
    node.applySoundfontBuffer(url, buffer, fellBack)
    const restoreAt = context.currentTime
    destination.gain.cancelScheduledValues(restoreAt)
    destination.gain.setTargetAtTime(1, restoreAt, 0.015)
  }

  async function updateConfig(patch) {
    const prevEngine = config.engine
    const prevSoundfont = config.soundfont
    const prevMidiChannel = config.midiChannel
    const prevOpl3Bank = config.opl3Bank

    const isSignalPathChange =
      ("engine" in patch && patch.engine !== prevEngine) ||
      ("soundfont" in patch && patch.soundfont !== prevSoundfont) ||
      ("midiChannel" in patch && patch.midiChannel !== prevMidiChannel)
    if (isSignalPathChange) silenceCurrentVoice()

    Object.assign(config, patch)

    if (config.engine === ENGINES.MIDI_DEVICE) return

    const hadNode = Boolean(node)
    const justCreated = await ensureNode()

    if (justCreated || ("engine" in patch && patch.engine !== prevEngine)) {
      node.setSynthEngine(
        config.engine === ENGINES.OPL3
          ? MIDI_ENGINE_LIBADLMIDI
          : MIDI_ENGINE_LIBFLUIDLITE,
      )
    }

    if (config.engine === ENGINES.FLUIDSYNTH) {
      const soundfontSwapNeeded =
        hadNode && "soundfont" in patch && patch.soundfont !== prevSoundfont
      if (soundfontSwapNeeded) await applySoundfont(config.soundfont)
    } else if (config.engine === ENGINES.OPL3) {
      if (
        justCreated ||
        ("opl3Bank" in patch && patch.opl3Bank !== prevOpl3Bank)
      ) {
        node.setOpl3Bank(config.opl3Bank)
      }
    }

    if (
      justCreated ||
      "soundfont" in patch ||
      "opl3Bank" in patch ||
      "program" in patch ||
      "midiChannel" in patch
    ) {
      node.programChange(config.midiChannel, config.program)
    }
  }

  function noteOn(note) {
    const wasSilent = heldNotes.size === 0
    heldNotes.add(note)
    if (wasSilent) onNoteStateChange?.(true)
    onNoteToggle?.(note, true)
  }

  function noteOff(note) {
    heldNotes.delete(note)
    if (heldNotes.size === 0) onNoteStateChange?.(false)
    onNoteToggle?.(note, false)
  }

  function dispatchToSoftsynth(status, data) {
    const channel = config.midiChannel
    switch (status) {
      case 0x90:
        if (data[2] === 0) {
          node.noteOff(channel, data[1])
          noteOff(data[1])
        } else {
          node.noteOn(channel, data[1], data[2])
          noteOn(data[1])
        }
        break
      case 0x80:
        node.noteOff(channel, data[1])
        noteOff(data[1])
        break
      case 0xb0:
        node.controlChange(channel, data[1], data[2])
        break
      case 0xc0:
        node.programChange(channel, data[1])
        config.program = data[1]
        onProgramChange?.(data[1])
        break
      case 0xe0:
        node.pitchBend(channel, (data[2] << 7) + data[1])
        break
    }
  }

  function dispatchToMidiDevice(status, data) {
    const output = midiOutputs.get(config.midiOutputId)
    if (!output) return
    output.send(data)
    if (status === 0x90 && data[2] > 0) noteOn(data[1])
    else if (status === 0x80 || (status === 0x90 && data[2] === 0))
      noteOff(data[1])
  }

  function handleMessage(event) {
    const { data } = event
    const status = data[0] & 0xf0
    const channel = data[0] & 0x0f
    if (channel !== config.midiChannel) return
    if (data.length < 2 && status !== 0x80 && status !== 0x90) return

    if (
      config.engine === ENGINES.FLUIDSYNTH ||
      config.engine === ENGINES.OPL3
    ) {
      if (node) dispatchToSoftsynth(status, data)
    } else if (config.engine === ENGINES.MIDI_DEVICE) {
      dispatchToMidiDevice(status, data)
    }
  }

  function destroy() {
    silenceCurrentVoice()
    node?.disconnect()
    node = null
  }

  return {
    config,
    updateConfig,
    handleMessage,
    setMidiOutputs,
    setOnNoteStateChange,
    setOnNoteToggle,
    setOnProgramChange,
    setOnSoundfontFallback,
    getOpl3Banks,
    destroy,
  }
}
