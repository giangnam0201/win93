import { MIDIEvents } from "../../../../../42/formats/midi/MIDIFile.js"
import "./helpers.js"

const BUFFER_AHEAD = 33
const DELAY_MS_PER_CC_EVENT = 2
const DELAY_MS_PER_SYSEX_BYTE = 0.5
const DELAY_MS_PER_XG_SYSTEM_EVENT = 500

const CC_SUSTAIN_PEDAL = 64
const CC_ALL_SOUND_OFF = 120
const CC_RESET_ALL_CONTROLLERS = 121
const CC_ALL_NOTES_OFF = 123
const SYSEX_GM_RESET = [0x7e, 0x7f, 0x09, 0x01, 0xf7]

const CC_MODWHEEL = 1
const LIVE_CONTROLLER_DEFAULTS = {
  modwheel: 0,
  pitchbend: 8192,
}
const sysexMasterVolume = (lsb, msb) => [0x7f, 0x7f, 0x04, 0x01, lsb, msb, 0xf7]
const HUMANIZE_MAX_TIMING_MS = 40
const SEQUENCED_CONTROLLERS = new Set([6, 38, 96, 97, 98, 99, 100, 101])
export const SCALES = {
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Ionian: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  "Major Blues": [0, 2, 3, 4, 7, 9],
  "Minor Blues": [0, 3, 5, 6, 7, 10],
  Diminish: [0, 2, 3, 6, 8, 9],
  "Combination Diminish": [0, 3, 4, 6, 7, 9, 10],
  "Major Pentatonic": [0, 2, 4, 7, 9],
  "Minor Pentatonic": [0, 3, 5, 7, 10],
  "Raga Bhairav": [0, 2, 4, 5, 7, 9, 10],
  "Raga Gamanasrama": [0, 2, 3, 5, 7, 8, 10],
  "Raga Todi": [0, 1, 3, 5, 7, 9, 10],
  "Spanish Scale": [0, 1, 3, 4, 5, 7, 8, 10],
  "Gypsy Scale": [0, 2, 3, 6, 7, 9, 10],
  "Arabian Scale": [0, 2, 3, 5, 7, 9, 10],
  "Egyptian Scale": [0, 2, 5, 7, 9, 10],
  "Hawaiian Scale": [0, 2, 4, 7, 9],
  "Bali Island Pelog": [0, 1, 2, 5, 7],
  "Japanese Miyakobushi": [0, 2, 4, 7, 9],
  "Ryukyu Scale": [0, 2, 4, 7, 9, 11],
  Wholetone: [0, 2, 4, 6, 8, 10],
  "minor 3rd Interval": [0, 3],
  "3rd Interval": [0, 4],
  "4th Interval": [0, 5],
  "5th Interval": [0, 7],
  "Octave Interval": [0],
}
const META_LABELS = {
  [MIDIEvents.EVENT_META_TEXT]: "Text",
  [MIDIEvents.EVENT_META_COPYRIGHT_NOTICE]: "Copyright",
  [MIDIEvents.EVENT_META_TRACK_NAME]: "Track",
  [MIDIEvents.EVENT_META_INSTRUMENT_NAME]: "Instrument",
  [MIDIEvents.EVENT_META_LYRICS]: "Lyrics",
  [MIDIEvents.EVENT_META_MARKER]: "Marker",
  [MIDIEvents.EVENT_META_CUE_POINT]: "Cue point",
}

export class MIDIFilePlayer {
  constructor(options = {}) {
    this.output = options.output || null
    this.synth = options.synth || null
    this.programChangeCb = options.programChangeCb
    this.speed = 1
    this.skipSilence = options.skipSilence || false
    this.lastProcessPlayTimestamp = 0
    this.lastSendTimestamp = 0
    this.events = []
    this.transpose = 0
    this.paused = true
    this.useWebMIDI = false
    this.useOplPolyphonyLimit = false
    this.masterVolume = 1
    this.polyphonyLimit = Infinity
    this.activeNotes = []
    this.humanizeAmount = 0
    this.scaleName = "Chromatic"
    this.scaleRoot = 9
    this.drunkAmount = 0
    this.liveControllers = { ...LIVE_CONTROLLER_DEFAULTS }
    this.quantizedNoteMap = new Map()
    this.sampleRate = options.sampleRate || 44_100

    this.channelsInUse = []
    this.channelMask = []
    this.channelProgramNums = []
    this.textInfo = []

    globalThis.addEventListener?.("pagehide", () => this.stop())
  }

  load(midiFile, useTrackLoops = false) {
    this.stop()
    this.position = 0
    this.elapsedTime = 0
    const tracks = midiFile.tracks.map((_, i) => midiFile.getTrackEvents(i))
    if (useTrackLoops) {
      this.events = midiFile.getLoopedEvents(tracks, 2)
    } else {
      this.events = midiFile.getEvents()
    }
    if (this.transpose !== 0) {
      for (const event of this.events) this.transposeEvent(event, this.transpose)
    }
    this.reapplyLiveControllers()
    this.summarizeMidiEvents()
  }

  transposeEvent(event, delta) {
    if (event.channel === 9) return
    if (
      event.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON ||
      event.subtype === MIDIEvents.EVENT_MIDI_NOTE_OFF ||
      event.subtype === MIDIEvents.EVENT_MIDI_NOTE_AFTERTOUCH
    ) {
      event.param1 = Math.min(127, Math.max(0, event.param1 + delta))
    }
  }

  getTranspose() {
    return this.transpose
  }

  setTranspose(semitones) {
    const delta = semitones - this.transpose
    this.transpose = semitones
    if (delta !== 0) {
      for (const event of this.events) this.transposeEvent(event, delta)
      this.allNotesOff()
    }
  }

  allNotesOff() {
    for (let ch = 0; ch < 16; ch++) {
      if (this.useWebMIDI) {
        this.send([
          (MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch,
          CC_ALL_NOTES_OFF,
          0,
        ])
      } else {
        this.synth.panicChannel(ch)
      }
    }
  }

  doSkipSilence() {
    if (this.useWebMIDI) return

    const firstNote = this.events.find(
      (e) => e.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON,
    )
    if (firstNote && firstNote.playTime > 50) {
      this.setPosition(firstNote.playTime - 50)
    }
  }

  play(endCallback) {
    if (this.position === 0) {
      this.endCallback = endCallback
      this.reset()

      this.lastProcessPlayTimestamp = performance.now()
      if (this.skipSilence) {
        this.doSkipSilence()
      }

      this.resume()
      return 1
    }
    return 0
  }

  processPlaySynth(buffer, bufferSize) {
    this.lastProcessPlayTimestamp = performance.now()
    const bufferStart = buffer
    let bytesWritten = 0
    let batchSize = 64
    let event = null
    const { synth } = this
    const msPerBatch = (this.speed * 1000 * (batchSize / this.sampleRate)) / 2

    for (
      let samplesRemaining = bufferSize * 2;
      samplesRemaining > 0;
      samplesRemaining -= batchSize
    ) {
      if (batchSize > samplesRemaining) batchSize = samplesRemaining

      if (!this.paused) {
        let pos = this.position
        for (
          this.elapsedTime += msPerBatch;
          this.events[pos] && this.elapsedTime >= this.events[pos].playTime;
          pos++
        ) {
          event = this.events[pos]
          switch (event.subtype) {
            case MIDIEvents.EVENT_MIDI_NOTE_ON:
              if (!this.channelMask[event.channel]) break
              if (event.param2 === 0) {
                const offNote = this.transformNoteOff(
                  event.channel,
                  event.param1,
                )
                synth.noteOff(event.channel, offNote)
                if (this.useOplPolyphonyLimit) {
                  this.forgetActiveNote(event.channel, offNote)
                }
              } else {
                const onNote = this.transformNoteOn(event.channel, event.param1)
                if (this.useOplPolyphonyLimit) {
                  this.stealSynthVoiceIfNeeded(event.channel, onNote)
                }
                synth.noteOn(
                  event.channel,
                  onNote,
                  this.humanizeVelocity(event.param2),
                )
              }
              break
            case MIDIEvents.EVENT_MIDI_NOTE_OFF: {
              const note = this.transformNoteOff(event.channel, event.param1)
              synth.noteOff(event.channel, note)
              if (this.useOplPolyphonyLimit) {
                this.forgetActiveNote(event.channel, note)
              }
              break
            }
            case MIDIEvents.EVENT_MIDI_PROGRAM_CHANGE:
              this.handleProgramChange(event.channel, event.param1)
              synth.programChange(event.channel, event.param1)
              break
            case MIDIEvents.EVENT_MIDI_PITCH_BEND:
              synth.pitchBend(event.channel, (event.param2 << 7) + event.param1)
              break
            case MIDIEvents.EVENT_MIDI_CONTROLLER:
              synth.controlChange(event.channel, event.param1, event.param2)
              break
            default:
              break
          }
        }
        this.position = pos
      }

      synth.render(buffer, batchSize)
      buffer += batchSize * 4
      bytesWritten += batchSize
    }

    if (this.position >= this.events.length) {
      let synthStillActive = 0
      const threshold = 0.001
      for (let i = 0; i < bufferSize; i += 8) {
        if (synth.getValue(bufferStart + i, "float") > threshold) {
          synthStillActive = 1
          break
        }
      }
      if (synthStillActive === 0) {
        this.position = 0
        this.paused = true
        return 0
      }
    }

    return bytesWritten
  }

  processPlay() {
    const now = performance.now()
    const deltaTime = (now - this.lastProcessPlayTimestamp) * this.speed
    this.lastProcessPlayTimestamp = now

    if (this.paused) return

    let throttleDelayMs = 0
    let delay = 0
    let message = null

    this.elapsedTime += deltaTime
    let event = this.events[this.position]
    while (
      this.events[this.position] &&
      event.playTime < this.elapsedTime + BUFFER_AHEAD
    ) {
      message = null
      delay = 0
      if (
        event.type === MIDIEvents.EVENT_SYSEX ||
        event.type === MIDIEvents.EVENT_DIVSYSEX
      ) {
        message = [event.type, ...event.data]
        delay =
          event.data && event.data[3] === 0 && event.data[4] === 0
            ? 50
            : event.data.length / 2
      } else {
        switch (event.subtype) {
          case MIDIEvents.EVENT_MIDI_PROGRAM_CHANGE:
            this.handleProgramChange(event.channel, event.param1)
            message = [(event.subtype << 4) + event.channel, event.param1]
            break
          case MIDIEvents.EVENT_MIDI_CHANNEL_AFTERTOUCH:
            message = [(event.subtype << 4) + event.channel, event.param1]
            break
          case MIDIEvents.EVENT_MIDI_NOTE_OFF:
          case MIDIEvents.EVENT_MIDI_NOTE_ON:
          case MIDIEvents.EVENT_MIDI_NOTE_AFTERTOUCH:
          case MIDIEvents.EVENT_MIDI_CONTROLLER:
          case MIDIEvents.EVENT_MIDI_PITCH_BEND:
            if (!this.channelMask[event.channel]) break
            message = [
              (event.subtype << 4) + event.channel,
              event.param1,
              event.param2 || 0x00,
            ]
            break
          default:
        }
      }
      if (message) {
        const scaledPlayTime =
          (event.playTime - this.elapsedTime) / this.speed +
          this.lastProcessPlayTimestamp
        let timestamp = scaledPlayTime + throttleDelayMs
        const isNoteOn =
          event.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON && event.param2 > 0
        const isNoteOff =
          event.subtype === MIDIEvents.EVENT_MIDI_NOTE_OFF ||
          (event.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON &&
            event.param2 === 0)
        if (isNoteOn) {
          message[1] = this.transformNoteOn(event.channel, message[1])
        } else if (isNoteOff) {
          message[1] = this.transformNoteOff(event.channel, message[1])
        }
        if (isNoteOn && this.humanizeAmount > 0) {
          timestamp += this.humanizeTimingOffset()
          message[2] = this.humanizeVelocity(message[2])
        }
        if (this.useWebMIDI) {
          if (isNoteOn) {
            this.stealVoiceIfNeeded(event.channel, message[1], timestamp)
          } else if (isNoteOff) {
            this.forgetActiveNote(event.channel, message[1])
          }
        }
        this.send(message, timestamp)
        throttleDelayMs += delay
        this.lastSendTimestamp = scaledPlayTime
      }
      this.position++
      event = this.events[this.position]
    }

    if (this.position >= this.events.length) {
      setTimeout(this.endCallback, BUFFER_AHEAD + 100)
      this.position = 0
      this.paused = true
    }
  }

  handleProgramChange(channel, program) {
    this.channelProgramNums[channel] = program
    this.programChangeCb()
  }

  togglePause() {
    this.paused = !this.paused
    if (this.paused === true) {
      this.panic()
    }
    return this.paused
  }

  resume() {
    this.paused = false
  }

  stop() {
    this.paused = true
    this.panic()
  }

  send(message, timestamp) {
    try {
      this.output.send(message, timestamp)
    } catch (err) {
      console.warn(err)
      console.warn(message)
    }
  }

  stealVoiceIfNeeded(channel, note, timestamp) {
    if (!Number.isFinite(this.polyphonyLimit)) return
    if (this.activeNotes.length >= this.polyphonyLimit) {
      const oldest = this.activeNotes.shift()
      this.send(
        [(MIDIEvents.EVENT_MIDI_NOTE_OFF << 4) + oldest.channel, oldest.note, 0],
        timestamp,
      )
    }
    this.activeNotes.push({ channel, note })
  }

  stealSynthVoiceIfNeeded(channel, note) {
    if (!Number.isFinite(this.polyphonyLimit)) return
    if (this.activeNotes.length >= this.polyphonyLimit) {
      const oldest = this.activeNotes.shift()
      this.synth.noteOff(oldest.channel, oldest.note)
    }
    this.activeNotes.push({ channel, note })
  }

  forgetActiveNote(channel, note) {
    const i = this.activeNotes.findIndex(
      (n) => n.channel === channel && n.note === note,
    )
    if (i !== -1) this.activeNotes.splice(i, 1)
  }

  setPolyphonyLimit(value) {
    this.polyphonyLimit = value
  }

  setUseOplPolyphonyLimit(value) {
    this.useOplPolyphonyLimit = value
  }

  setHumanize(value) {
    this.humanizeAmount = value
  }

  humanizeTimingOffset() {
    return (Math.random() * 2 - 1) * HUMANIZE_MAX_TIMING_MS * this.humanizeAmount
  }

  humanizeVelocity(velocity) {
    if (this.humanizeAmount <= 0) return velocity
    const randomVelocity = 1 + Math.floor(Math.random() * 127)
    const result = Math.round(
      velocity + (randomVelocity - velocity) * this.humanizeAmount,
    )
    return Math.max(1, Math.min(127, result))
  }

  setScaleName(value) {
    this.scaleName = value
  }

  setScaleRoot(value) {
    this.scaleRoot = value
  }

  quantizeToScale(note) {
    const offsets = SCALES[this.scaleName] ?? SCALES.Chromatic
    if (offsets.length >= 12) return note
    const pitchClass = (((note - this.scaleRoot) % 12) + 12) % 12
    let bestShift = 0
    let bestDist = Infinity
    for (const offset of offsets) {
      for (const candidate of [offset, offset - 12, offset + 12]) {
        const shift = candidate - pitchClass
        const dist = Math.abs(shift)
        if (dist < bestDist) {
          bestDist = dist
          bestShift = shift
        }
      }
    }
    return Math.max(0, Math.min(127, note + bestShift))
  }

  setDrunk(value) {
    this.drunkAmount = value
  }

  setLiveController(id, value) {
    this.liveControllers[id] = value
    this.sendLiveController(id, value)
  }

  sendLiveController(id, value, timestamp) {
    switch (id) {
      case "modwheel":
        this.sendControlChangeAll(CC_MODWHEEL, value, timestamp)
        break
      case "pitchbend":
        this.sendPitchBendAll(value, timestamp)
        break
      default:
        console.warn('MIDIFilePlayer has no live controller "%s".', id)
    }
  }

  reapplyLiveControllers() {
    for (const [id, value] of Object.entries(this.liveControllers)) {
      if (value !== LIVE_CONTROLLER_DEFAULTS[id]) this.sendLiveController(id, value)
    }
  }

  sendControlChangeAll(cc, value, timestamp) {
    for (let ch = 0; ch < 16; ch++) {
      if (this.useWebMIDI) {
        this.send(
          [(MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch, cc, value],
          timestamp,
        )
      } else {
        this.synth.controlChange(ch, cc, value)
      }
    }
  }

  sendPitchBendAll(value, timestamp) {
    for (let ch = 0; ch < 16; ch++) {
      if (this.useWebMIDI) {
        this.send(
          [
            (MIDIEvents.EVENT_MIDI_PITCH_BEND << 4) + ch,
            value & 0x7f,
            (value >> 7) & 0x7f,
          ],
          timestamp,
        )
      } else {
        this.synth.pitchBend(ch, value)
      }
    }
  }

  transformNoteOn(channel, note) {
    if (channel === 9) return note
    let result = note
    if (this.drunkAmount > 0 && Math.random() * 100 < this.drunkAmount) {
      result += Math.floor(Math.random() * 25) - 12
    }
    result = this.quantizeToScale(result)
    result = Math.max(0, Math.min(127, result))
    if (result !== note) {
      this.quantizedNoteMap.set(`${channel}:${note}`, result)
    }
    return result
  }

  transformNoteOff(channel, note) {
    const key = `${channel}:${note}`
    const mapped = this.quantizedNoteMap.get(key)
    if (mapped == null) return note
    this.quantizedNoteMap.delete(key)
    return mapped
  }

  panic() {
    this.activeNotes = []
    this.quantizedNoteMap.clear()
    if (this.useWebMIDI) {
      const sendCleanup = () => {
        for (let ch = 0; ch < 16; ch++) {
          this.send([(MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch, CC_SUSTAIN_PEDAL, 0])
          this.send([(MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch, CC_ALL_SOUND_OFF, 0])
          this.send([
            (MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch,
            CC_RESET_ALL_CONTROLLERS,
            0,
          ])
        }
      }
      sendCleanup()
      setTimeout(sendCleanup, 50)
    } else {
      for (let ch = 0; ch < 16; ch++) {
        this.synth.controlChange(ch, CC_SUSTAIN_PEDAL, 0)
      }
      this.synth.panic()
    }
  }

  reset() {
    if (this.useWebMIDI) {
      this.send([MIDIEvents.EVENT_SYSEX, ...SYSEX_GM_RESET])
      for (let ch = 0; ch < 16; ch++) {
        this.send([(MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch, CC_SUSTAIN_PEDAL, 0])
        this.send([(MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch, CC_ALL_SOUND_OFF, 0])
        this.send([
          (MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch,
          CC_RESET_ALL_CONTROLLERS,
          0,
        ])
      }
    } else {
      this.synth.reset()
    }
  }

  getDuration() {
    if (this.events && this.events.length > 0) {
      return this.events[this.events.length - 1].playTime
    }
    return 0
  }

  getPosition() {
    return this.elapsedTime
  }

  setOutput(output) {
    this.panic()
    this.output = output
    this.setPosition(this.getPosition() - 10)
    this.sendMasterVolume()
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value))
    this.sendMasterVolume()
  }

  sendMasterVolume() {
    if (!this.useWebMIDI) return
    const level = Math.round(this.masterVolume * 0x3fff)
    this.send([
      MIDIEvents.EVENT_SYSEX,
      ...sysexMasterVolume(level & 0x7f, level >> 7),
    ])
  }

  getSpeed() {
    return this.speed
  }
  setSpeed(speed) {
    this.speed = Math.max(0.1, Math.min(10, speed))
  }

  setPositionSynth(eventList) {
    const { synth } = this
    eventList.forEach((event) => {
      switch (event.subtype) {
        case MIDIEvents.EVENT_MIDI_PROGRAM_CHANGE:
          synth.programChange(event.channel, event.param1)
          break
        default:
          synth.controlChange(event.channel, event.param1, event.param2)
          break
      }
    })
  }

  setPositionWebMidi(ms, eventList) {
    const wasPaused = this.paused
    this.paused = true

    let message
    eventList.forEach((event, i) => {
      if (event.subtype === MIDIEvents.EVENT_MIDI_PROGRAM_CHANGE) {
        message = [(event.subtype << 4) + event.channel, event.param1]
      } else if (event.subtype === MIDIEvents.EVENT_MIDI_CONTROLLER) {
        message = [
          (event.subtype << 4) + event.channel,
          event.param1,
          event.param2,
        ]
      }
      this.send(
        message,
        this.lastSendTimestamp + 20 + i * DELAY_MS_PER_CC_EVENT,
      )
    })

    const numEvents = eventList.length
    const messageDelay = numEvents * DELAY_MS_PER_CC_EVENT
    if (!wasPaused) {
      setTimeout(() => this.resume(), messageDelay)
    }
  }

  setPosition(ms) {
    if (ms < 0 || ms > this.getDuration()) return

    this.lastProcessPlayTimestamp = performance.now()
    this.panic()
    const eventMap = {}
    let eventList = []
    let pos = this.position

    if (ms < this.elapsedTime) {
      pos = 0
    }

    while (this.events[pos] && this.events[pos].playTime < ms) {
      const event = this.events[pos]
      if (event.subtype === MIDIEvents.EVENT_MIDI_PROGRAM_CHANGE) {
        this.handleProgramChange(event.channel, event.param1)
        eventMap[`${event.subtype}-${event.channel}`] = event
      } else if (event.subtype === MIDIEvents.EVENT_MIDI_CONTROLLER) {
        if (SEQUENCED_CONTROLLERS.has(event.param1)) {
          eventList.push(event)
        } else {
          eventMap[`${event.subtype}-${event.channel}-${event.param1}`] = event
        }
      }
      pos++
    }

    eventList = Object.values(eventMap).concat(eventList)

    if (this.useWebMIDI) {
      this.setPositionWebMidi(ms, eventList)
    } else {
      this.setPositionSynth(eventList)
    }

    this.elapsedTime = ms
    this.position = pos
  }

  getChannelInUse(ch) {
    return Boolean(this.channelsInUse[ch])
  }

  getChannelProgramNum(ch) {
    return this.channelProgramNums[ch]
  }

  summarizeMidiEvents() {
    this.textInfo = []
    const { channelsInUse } = this
    const { channelProgramNums } = this
    const { channelMask } = this
    for (let i = 0; i < 16; i++) {
      channelsInUse[i] = 0
      channelProgramNums[i] = 0
      channelMask[i] = true
    }

    for (let j = 0; j < this.events.length; j++) {
      const event = this.events[j]
      switch (event.subtype) {
        case MIDIEvents.EVENT_MIDI_NOTE_ON:
          channelsInUse[event.channel] = 1
          break
        case MIDIEvents.EVENT_MIDI_PROGRAM_CHANGE:
          if (!channelProgramNums[event.channel]) {
            this.handleProgramChange(event.channel, event.param1)
          }
          break
        case MIDIEvents.EVENT_META_TEXT:
        case MIDIEvents.EVENT_META_COPYRIGHT_NOTICE:
        case MIDIEvents.EVENT_META_TRACK_NAME:
        case MIDIEvents.EVENT_META_LYRICS:
        case MIDIEvents.EVENT_META_MARKER:
        case MIDIEvents.EVENT_META_CUE_POINT: {
          const text = event.data
            .map((c) => String.fromCharCode(c))
            .join("")
            .trim()
          if (text && !text.match(/nstd/i)) {
            this.textInfo.push(`${META_LABELS[event.subtype]}: ${text}`)
          }
          break
        }
        default:
          break
      }
    }
  }

  setChannelMute(ch, isMuted) {
    this.channelMask[ch] = !isMuted
    if (isMuted) {
      if (this.useWebMIDI) {
        const sendCleanup = () => {
          this.send([(MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch, CC_SUSTAIN_PEDAL, 0])
          this.send([(MIDIEvents.EVENT_MIDI_CONTROLLER << 4) + ch, CC_ALL_SOUND_OFF, 0])
        }
        sendCleanup()
        setTimeout(sendCleanup, 50)
      } else {
        this.synth.panicChannel(ch)
      }
    }
  }

  setUseWebMIDI(useWebMIDI) {
    this.useWebMIDI = useWebMIDI
    this.setPosition(this.getPosition() - 10)
    this.sendMasterVolume()
  }
}
