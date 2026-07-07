export { }
let audioContext = new AudioContext()

const masterGain = audioContext.createGain()
masterGain.gain.value = 0.2
masterGain.connect(audioContext.destination)

const chord = document.querySelector("#chord")
const notes = document.querySelectorAll(".notes button")
const types = document.querySelectorAll(".types button")

// prettier-ignore
const notesInOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// prettier-ignore
const chordsMap = {
  'Ma': ['C', 'E', 'G'],
  'Ma7': ['C', 'E', 'G', 'B'],
  'm': ['C', 'D#', 'G'],
  'm7': ['C', 'D#', 'G', 'A#'],
  '7': ['C', 'E', 'G', 'A#'],
  'm7(b5)': ['C', 'D#', 'F#', 'A#'],
  'dim': ['C', 'D#', 'F#'],
  'aug': ['C', 'E', 'G#'],
  'sus2': ['C', 'D', 'G'],
  'sus4': ['C', 'F', 'G'],
  '9': ['C', 'E', 'G', 'A#', 'D'],
  'm9': ['C', 'D#', 'G', 'A#', 'D'],
  '6': ['C', 'E', 'G', 'A'],
  'm6': ['C', 'D#', 'G', 'A'],
  'maj9': ['C', 'E', 'G', 'B', 'D'],
  '7sus4': ['C', 'F', 'G', 'A#'],
  '11': ['C', 'E', 'G', 'A#', 'D', 'F'],
  '13': ['C', 'E', 'G', 'A#', 'D', 'F', 'A'],
  'maj7(b5)': ['C', 'E', 'G#', 'B'],
  'mMaj7': ['C', 'D#', 'G', 'B'],
  'C6/9': ['C', 'E', 'G', 'A', 'D'],
  'maj7': ['C', 'E', 'G', 'B'],
  '7(b9)': ['C', 'E', 'G', 'A#', 'D#'],
  'm7(b9)': ['C', 'D#', 'G', 'A#', 'D#'],
  // scales
  'Chromatic': ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  'Ionian': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'Dorian': ['C', 'D', 'D#', 'F', 'G', 'A', 'A#'],
  'Phrygian': ['C', 'C#', 'D#', 'F', 'G', 'G#', 'A#'],
  'Lydian': ['C', 'D', 'E', 'F#', 'G', 'A', 'B'],
  'Mixolydian': ['C', 'D', 'E', 'F', 'G', 'A', 'A#'],
  'Aeolian': ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#'],
  'Locrian': ['C', 'C#', 'D#', 'F', 'F#', 'G#', 'A#'],
  'Major Blues': ['C', 'D', 'D#', 'E', 'G', 'A'],
  'Minor Blues': ['C', 'D#', 'F', 'F#', 'G', 'A#'],
  'Diminish': ['C', 'D', 'D#', 'F#', 'G#', 'A'],
  'Combination Diminish': ['C', 'D#', 'E', 'F#', 'G', 'A', 'A#'],
  'Major Pentatonic': ['C', 'D', 'E', 'G', 'A'],
  'Minor Pentatonic': ['C', 'D#', 'F', 'G', 'A#'],
  'Raga Bhairav': ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
  'Raga Gamanasrama': ['C', 'D', 'D#', 'F', 'G', 'G#', 'Bb'],
  'Raga Todi': ['C', 'C#', 'D#', 'F', 'G', 'A', 'Bb'],
  'Spanish Scale': ['C', 'C#', 'D#', 'E', 'F', 'G', 'G#', 'A#'],
  'Gypsy Scale': ['C', 'D', 'D#', 'F#', 'G', 'A', 'A#'],
  'Arabian Scale': ['C', 'D', 'D#', 'F', 'G', 'A', 'A#'],
  'Egyptian Scale': ['C', 'D', 'F', 'G', 'A', 'A#'],
  'Hawaiian Scale': ['C', 'D', 'E', 'G', 'A'],
  'Bali Island Pelog': ['C', 'C#', 'D', 'F', 'G'],
  'Japanese Miyakobushi': ['C', 'D', 'E', 'G', 'A'],
  'Ryukyu Scale': ['C', 'D', 'E', 'G', 'A', 'B'],
  'Wholetone': ['C', 'D', 'E', 'F#', 'G#', 'A#'],
  'minor 3rd Interval': ['C', 'D#'],
  '3rd Interval': ['C', 'E'],
  '4th Interval': ['C', 'F'],
  '5th Interval': ['C', 'G'],
  'Octave Interval': ['C'],
};

let synthType = document.querySelector("#waveform").value

const customWaves = {}
function addCustomWave(name, realValues) {
  const real = new Float32Array(realValues)
  const imag = new Float32Array(realValues.length)
  customWaves[name] = audioContext.createPeriodicWave(real, imag)
}

addCustomWave("cosinus", [0, 1, 0.5, 0.25])
addCustomWave("harmonic-rich", [0, 1, 0.8, 0.6, 0.4, 0.2])
addCustomWave("soft-bell", [0, 1, 0.3, 0.1])
addCustomWave("deep-bass", [0, 1, 0.3, 0.1, 0.05, 0.02])
addCustomWave("hollow", [0, 0, 1, 0, 0.5, 0])
addCustomWave("buzz", [0, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3])
addCustomWave("soft-string", [0, 1, 0.2, 0.1, 0.05, 0.01])
addCustomWave("robotic", [0, 1, 0, 1, 0, 1, 0, 1])
addCustomWave("water-drop", [0, 1, 0.4, 0.1, 0.05, 0.02, 0.01])
addCustomWave("wind", [0, 0.3, 0.5, 0.7, 0.9, 1])
addCustomWave("weird", [0, 0.2, 0.8, 0.4, 0.1, 0.05])

document.querySelector("#waveform").addEventListener("change", function () {
  synthType = this.value
})

function transposeChord(chordType, tonic, defaultOctave = 4) {
  const chord = chordsMap[chordType]
  if (!chord) {
    return []
  }

  const tonicIndex = notesInOrder.indexOf(tonic)
  if (tonicIndex === -1) {
    console.error("Tonique invalide")
    return []
  }

  function getNoteWithOctave(note, tonicIndex) {
    const noteIndex = notesInOrder.indexOf(note)
    const transposedIndex = (noteIndex + tonicIndex) % notesInOrder.length

    const octaveShift = Math.floor(
      (noteIndex + tonicIndex) / notesInOrder.length,
    )
    return {
      note: notesInOrder[transposedIndex],
      octave: defaultOctave + octaveShift,
    }
  }

  return chord.map((note) => {
    const { note: transposedNote, octave } = getNoteWithOctave(note, tonicIndex)
    return transposedNote + octave
  })
}

function handleButtonClick(event, section) {
  section.forEach((button) => {
    button.setAttribute("aria-pressed", "false")
  })

  const button = event.target.closest("button")

  if (button.parentElement.classList.value == "types") {
    document.querySelector("#scaleSelect").value = "none"
  }

  button.setAttribute("aria-pressed", "true")
  const note = document.querySelector(
    '.notes button[aria-pressed="true"]',
  ).textContent
  const typeSelector = document.querySelector(
    '.types button[aria-pressed="true"]',
  )
  let type
  if (typeSelector != null) {
    type = document.querySelector(
      '.types button[aria-pressed="true"]',
    ).textContent

    const chordValue = `${note}${type}`
    chord.textContent = chordValue
    const chordNotes = transposeChord(type, note)
    const allKeys = document.querySelectorAll(".piano .key")
    const displayChord = document.querySelector("#scaleSelect").value == "none"
    allKeys.forEach((key) => {
      key.classList.remove("selected")
      // key.classList.remove('correct');
    })

    //

    chordNotes.forEach((n) => {
      if (displayChord) {
        polySynth.noteOn(n, synthType, 0.1, 0.5)
      }
      const key = document.querySelector(`.piano .key[title="${n}"]`)
      if (key && displayChord) {
        key.classList.add("selected")
      }
    })
    /*
    chordNotes.forEach(n => {
      const baseNote = n.replace(/\d+/g, '');
      document.querySelectorAll(`.piano .key`).forEach(key => {
        if (key.title.replace(/\d+/g, '') === baseNote && !chordNotes.includes(key.title)) {
          key.classList.add('correct');
        }
      });
    });
    */
  }

  setScaleDisplay()
}

notes.forEach((button) => {
  button.addEventListener("click", (event) => handleButtonClick(event, notes))
})

types.forEach((button) => {
  button.addEventListener("click", (event) => handleButtonClick(event, types))
})

// prettier-ignore
const noteFrequencies = {
  'C0': 16.35, 'C#0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'E0': 20.6, 'F0': 21.83, 'F#0': 23.12, 'G0': 24.5, 'G#0': 25.96, 'A0': 27.5, 'A#0': 29.14, 'B0': 30.87,
  'C1': 32.7, 'C#1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'E1': 41.2, 'F1': 43.65, 'F#1': 46.25, 'G1': 49, 'G#1': 51.91, 'A1': 55, 'A#1': 58.27, 'B1': 61.74,
  'C2': 65.41, 'C#2': 69.3, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.5, 'G2': 98, 'G#2': 103.83, 'A2': 110, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185, 'G3': 196, 'G#3': 207.65, 'A3': 220, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392, 'G#4': 415.3, 'A4': 440, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.26, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880, 'A#5': 932.33, 'B5': 987.77,
  'C6': 1046.5, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760, 'A#6': 1864.66, 'B6': 1975.53,
  'C7': 2093, 'C#7': 2217.46, 'D7': 2349.32, 'D#7': 2499.02, 'E7': 2637.02, 'F7': 2793.83, 'F#7': 2959.96, 'G7': 3135.96, 'G#7': 3322.44, 'A7': 3520, 'A#7': 3729.31, 'B7': 3951.07,
  'C8': 4186.01
};

class PolySynth {
  constructor(audioContext) {
    this.audioContext = audioContext
    this.oscillators = {}
    this.gainNodes = {}
    this.maxPolyphony = 16
    this.activeNotes = new Set()
    this.fadeOutInProgress = {}
    this.timeouts = {}
  }
  noteOn(note, type = "square", fadeInDuration = 0.05, duration = null) {
    if (this.audioContext.state === "closed") {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.audioContext = audioContext
    }

    if (midiChosen) {
      midiSelect.selectedIndex = midiOutputSelected
      midiChosen = false
    }

    if (midiOutput) {
      const midiNote = noteToMidi(note)
      sendMidiNote(note, 127, true)
    }
    if (this.activeNotes.has(note)) {
      const gainNode = this.gainNodes[note]
      if (this.fadeOutInProgress[note]) {
        return
      }
      gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.5,
        this.audioContext.currentTime + fadeInDuration,
      )
    } else {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      const frequency = noteFrequencies[note]
      if (!frequency) {
        return
      }
      oscillator.connect(gainNode)
      gainNode.connect(masterGain)
      oscillator.frequency.setValueAtTime(
        frequency,
        this.audioContext.currentTime,
      )
      if (
        type == "sawtooth" ||
        type == "square" ||
        type == "triangle" ||
        type == "sine"
      ) {
        oscillator.type = type
      } else if (type != "no-sound") {
        oscillator.setPeriodicWave(customWaves[type])
      }
      if (type != "no-sound") {
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
        oscillator.start()
        gainNode.gain.setValueAtTime(0.0001, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(
          0.5,
          this.audioContext.currentTime + fadeInDuration,
        )
        this.oscillators[note] = oscillator
        this.gainNodes[note] = gainNode
        this.activeNotes.add(note)
      }
      if (duration !== null) {
        if (this.timeouts[note]) clearTimeout(this.timeouts[note])
        this.timeouts[note] = setTimeout(
          () => this.noteOff(note, 1),
          duration * 1000,
        )
      }
    }
  }
  noteOff(note, fadeDuration = 0.1) {
    if (midiOutput) {
      const midiNote = noteToMidi(note)
      sendMidiNote(note, 0, false)
    }
    if (this.oscillators[note]) {
      const gainNode = this.gainNodes[note]
      gainNode.gain.setValueAtTime(
        gainNode.gain.value,
        this.audioContext.currentTime,
      )
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioContext.currentTime + fadeDuration,
      )
      this.oscillators[note].stop(this.audioContext.currentTime + fadeDuration)
      delete this.oscillators[note]
      delete this.gainNodes[note]
      this.activeNotes.delete(note)
      if (this.timeouts[note]) {
        clearTimeout(this.timeouts[note])
        delete this.timeouts[note]
      }
    }
  }
}

function formatNoteDisplay(note) {
  return note.includes("#") ? note : note[0] + "-" + note.slice(1)
}

const polySynth = new PolySynth(audioContext)

let mouseDown = false
const isKeyActive = {}

document.addEventListener("mousedown", () => {
  mouseDown = true
})

document.addEventListener("mouseup", () => {
  mouseDown = false
  Object.keys(isKeyActive).forEach((note) => {
    if (isKeyActive[note]) {
      polySynth.noteOff(note, 0.5)
      isKeyActive[note] = false
    }
  })
})

const keys = document.querySelectorAll(".key")

keys.forEach((key) => {
  const note = key.title
  key.addEventListener("mousedown", () => {
    if (!isKeyActive[note]) {
      document.querySelector("#note").innerText = formatNoteDisplay(note)
      polySynth.noteOn(note, synthType)
      isKeyActive[note] = true
    }
    key.classList.add("played")
  })
  key.addEventListener("mouseup", () => {
    polySynth.noteOff(note)
    isKeyActive[note] = false
    key.classList.remove("played")
  })
  key.addEventListener("mouseout", () => {
    if (mouseDown) {
      polySynth.noteOff(note)
      isKeyActive[note] = false
      key.classList.remove("played")
    }
  })
  key.addEventListener("mouseover", () => {
    if (mouseDown && !isKeyActive[note]) {
      document.querySelector("#note").innerText = formatNoteDisplay(note)
      polySynth.noteOn(note, synthType)
      isKeyActive[note] = true
      key.classList.add("played")
    }
  })
})

const keyMap = {
  KeyZ: "C4",
  KeyS: "C#4",
  KeyX: "D4",
  KeyD: "D#4",
  KeyC: "E4",
  KeyV: "F4",
  KeyG: "F#4",
  KeyB: "G4",
  KeyH: "G#4",
  KeyN: "A4",
  KeyJ: "A#4",
  KeyM: "B4",
  Comma: "C5",
  KeyQ: "C5",
  Digit2: "C#5",
  KeyW: "D5",
  Digit3: "D#5",
  KeyE: "E5",
  KeyR: "F5",
  Digit5: "F#5",
  KeyT: "G5",
  Digit6: "G#5",
  KeyY: "A5",
  Digit7: "A#5",
  KeyU: "B5",
  KeyI: "C6",
}

// prettier-ignore
const noteToKeyId = {
  "C4": "C", "C#4": "C-sharp", "D4": "D", "D#4": "D-sharp", "E4": "E",
  "F4": "F", "F#4": "F-sharp", "G4": "G", "G#4": "G-sharp", "A4": "A",
  "A#4": "A-sharp", "B4": "B", "C5": "C2", "C#5": "C-sharp2", "D5": "D2",
  "D#5": "D-sharp2", "E5": "E2", "F5": "F2", "F#5": "F-sharp2", "G5": "G2",
  "G#5": "G-sharp2", "A5": "A2", "A#5": "A-sharp2", "B5": "B2"
};

document.addEventListener("keydown", (event) => {
  if (event.repeat) return
  const note = keyMap[event.code]
  if (note) {
    polySynth.noteOn(note, synthType)

    const keyElement = document.getElementById(noteToKeyId[note])
    if (keyElement) keyElement.classList.add("played")
  }
})

document.addEventListener("keyup", (event) => {
  const note = keyMap[event.code]
  if (note) {
    polySynth.noteOff(note)

    const keyElement = document.getElementById(noteToKeyId[note])
    if (keyElement) keyElement.classList.remove("played")
  }
})

let midiAccess = null
let midiOutput = null
let midiChosen = false
let midiOutputSelected = 0
const midiSelect = document.querySelector("#midiouts")

function handleMidiChange(event) {
  const selectedValue = event.target.closest("button").value
  const outputs = Array.from(midiAccess.outputs.values())
  midiOutput = outputs.find((output) => output.id === selectedValue) || null
  if (midiOutput) {
    // const selectedIndex = outputs.findIndex(
    //   (output) => output.id === selectedValue,
    // )
    midiOutputSelected =
      outputs.findIndex((output) => output.id === selectedValue) + 1
  } else {
    midiOutputSelected = 0
  }
}

function updateMidiOutputs() {
  midiSelect.removeEventListener("change", handleMidiChange)
  midiSelect.innerHTML = "<option>No Midi Out</option>"
  const outputs = Array.from(midiAccess.outputs.values())
  outputs.forEach((output) => {
    const option = document.createElement("option")
    option.value = output.id
    option.textContent = output.name
    midiSelect.append(option)
  })
  midiSelect.addEventListener("change", handleMidiChange)
  midiChosen = true
}

function requestMidiAccess() {
  navigator
    .requestMIDIAccess({ sysex: true })
    .then((midi) => {
      midiAccess = midi
      updateMidiOutputs()
      midiAccess.onstatechange = updateMidiOutputs
    })
    .catch((err) => console.error("MIDI Error :", err))
}

const midiAccessButton = document.querySelector("#midiAccessButton")
midiAccessButton.addEventListener("click", requestMidiAccess)

const noteToMidi = (note) => {
  const notes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ]
  const octave = Number.parseInt(note.slice(-1))
  const pitch = notes.indexOf(note.slice(0, -1))
  return 12 * (octave + 1) + pitch
}

function sendMidiNote(note, velocity, on) {
  if (midiOutput) {
    const channel = Number.parseInt(
      document.querySelector("#midiChannel").value,
      10,
    )
    const status = (on ? 0x90 : 0x80) + (channel - 1)
    const midiNote = noteToMidi(note)
    midiOutput.send([status, midiNote, velocity])
  }
}

function setScaleDisplay() {
  const displayChord = document.querySelector("#scaleSelect").value == "none"
  const allKeys = document.querySelectorAll(".piano .key")
  if (displayChord) {
    allKeys.forEach((key) => {
      key.classList.remove("correct")
    })
    return
  }
  const selectedMode = document.querySelector("#scaleSelect").value
  const pressed = document.querySelector('.types button[aria-pressed="true"]')
  if (pressed != null) {
    document
      .querySelector('.types button[aria-pressed="true"]')
      .setAttribute("aria-pressed", "false")
  }

  const note = document.querySelector(
    '.notes button[aria-pressed="true"]',
  ).textContent
  const scaleNotes = transposeChord(selectedMode, note)

  allKeys.forEach((key) => {
    key.classList.remove("correct")
    if (!displayChord) {
      key.classList.remove("selected")
    }
  })

  if (scaleNotes.length === 0) {
    return
  }

  // console.log(scaleNotes);

  scaleNotes.forEach((n) => {
    const baseNote = n.replaceAll(/\d+/g, "")
    // console.log(baseNote)
    document.querySelectorAll(`.piano .key`).forEach((key) => {
      if (key.title.replaceAll(/\d+/g, "") === baseNote) {
        key.classList.add("correct")
      }
      // console.log(key)
    })
  })
}

document.querySelector("#scaleSelect").addEventListener("change", () => {
  setScaleDisplay()
})
