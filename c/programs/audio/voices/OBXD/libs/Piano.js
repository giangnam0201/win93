/*
 * Qwerty Hancock keyboard library v0.4.3
 * The web keyboard for now people.
 * Copyright 2012-14, Stuart Memo
 *
 * Licensed under the MIT License
 * http://opensource.org/licenses/mit-license.php
 *
 * http://stuartmemo.com/qwerty-hancock
 */

const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const midimap = {
  90: 0,
  88: 2,
  67: 4,
  86: 5,
  66: 7,
  78: 9,
  77: 11,
  44: 12,
  46: 14,
  45: 16,
  83: 1,
  68: 3,
  71: 6,
  72: 8,
  74: 10,
  76: 13,
  246: 15,
  81: 12,
  87: 14,
  69: 16,
  82: 17,
  84: 19,
  89: 21,
  85: 23,
  73: 24,
  79: 26,
  80: 28,
  229: 29,
  50: 13,
  51: 15,
  53: 18,
  54: 20,
  55: 22,
  57: 25,
  48: 27,
}
function getMidiKey(keyCode) {
  return midimap[keyCode]
}

const version = "0.4.3"
let settings = {}
let mouse_is_down = false
const keysDown = {}
const key_map = {
  65: "Cl",
  87: "C#l",
  83: "Dl",
  69: "D#l",
  68: "El",
  70: "Fl",
  84: "F#l",
  71: "Gl",
  89: "G#l",
  90: "G#l",
  72: "Al",
  85: "A#l",
  74: "Bl",
  75: "Cu",
  79: "C#u",
  76: "Du",
  80: "D#u",
  59: "Eu",
  186: "Eu",
  222: "Fu",
  221: "F#u",
  220: "Gu",
}
let keyDownCallback
let keyUpCallback

/**
 * Calculate width of white key.
 * @returns {number} Width of a single white key in pixels.
 */
const getWhiteKeyWidth = function (number_of_white_keys) {
  // JJK return Math.floor((settings.width - number_of_white_keys) / number_of_white_keys);
  return (settings.width - 2) / number_of_white_keys
}

/**
 * Merge user settings with defaults.
 * @param {object} user_settings
 */
const init = function (us) {
  let container

  const user_settings = us || {}

  settings = {
    id: user_settings.id || "keyboard",
    octaves: user_settings.octaves || 3,
    width: user_settings.width,
    height: user_settings.height,
    startNote: user_settings.startNote || "A3",
    whiteKeyColour: user_settings.whiteKeyColour || "#fff",
    blackKeyColour: user_settings.blackKeyColour || "#000",
    activeColour: user_settings.activeColour || "yellow",
    borderColour: user_settings.borderColour || "#000",
    keyboardLayout: user_settings.keyboardLayout || "en",
  }

  // JJK
  // container = document.getElementById(settings.id);
  settings.container = user_settings.container
  settings.margin = user_settings.margin
  settings.oct = user_settings.oct

  if (settings.width === undefined) {
    settings.width = settings.container.offsetWidth
  }

  if (settings.height === undefined) {
    settings.height = settings.container.offsetHeight
  }

  settings.startOctave = Number.parseInt(settings.startNote.charAt(1), 10)

  createKeyboard()
  addListeners.call(this, settings.container)
}

/**
 * Get frequency of a given note.
 * @param {string} note Musical note to convert into hertz.
 * @returns {number} Frequency of note in hertz.
 */
const getFrequencyOfNote = function (note) {
  const notes = [
    "A",
    "A#",
    "B",
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
  ]
  let key_number
  let octave

  octave = note.length === 3 ? note.charAt(2) : note.charAt(1)

  key_number = notes.indexOf(note.slice(0, -1))

  key_number =
    key_number < 3
      ? key_number + 12 + (octave - 1) * 12 + 1
      : key_number + (octave - 1) * 12 + 1

  return 440 * 2 ** ((key_number - 49) / 12)
}

/**
 * Lighten up man. Change the colour of a key.
 * @param {HTMLElement} el DOM element to change colour of.
 */
const lightenUp = function lightenUp(el) {
  // JJK
  if (el !== null && el.localName == "li") {
    el.style.backgroundColor = settings.activeColour
  }
}

/**
 * Revert key to original colour.
 * @param {HTMLElement} el DOM element to change colour of.
 */
const darkenDown = function darkenDown(el) {
  if (el !== null && el.localName === "li") {
    // JJK
    el.style.backgroundColor =
      el.getAttribute("data-note-type") === "white"
        ? settings.whiteKeyColour
        : settings.blackKeyColour
  }
}

/**
 * Order notes into order defined by starting key in settings.
 * @param {Array} notes_to_order Notes to be ordered.
 * @returns {Array} Ordered_notes Ordered notes.
 */
const orderNotes = function (notes_to_order) {
  let i
  let keyOffset = 0
  const number_of_notes_to_order = notes_to_order.length
  const ordered_notes = []

  for (i = 0; i < number_of_notes_to_order; i++) {
    if (settings.startNote.charAt(0) === notes_to_order[i]) {
      keyOffset = i
      break
    }
  }

  for (i = 0; i < number_of_notes_to_order; i++) {
    ordered_notes[i] =
      i + keyOffset > number_of_notes_to_order - 1
        ? notes_to_order[i + keyOffset - number_of_notes_to_order]
        : notes_to_order[i + keyOffset]
  }

  return ordered_notes
}

/**
 * Add styling to individual white key.
 * @param {HTMLElement} el White key DOM element.
 */
const styleWhiteKey = function (key) {
  key.el.style.backgroundColor = settings.whiteKeyColour
  key.el.style.border = "1px solid " + settings.borderColour
  key.el.style.borderRight = 0
  key.el.style.height = settings.height + "px"
  key.el.style.width = key.width + "px"
  key.el.style.borderRadius = "0 0 3px 3px"
}

/**
 * Add styling to individual black key.
 * @param {HTMLElement} el Black key DOM element.
 */
const styleBlackKey = function (key) {
  const white_key_width = getWhiteKeyWidth(getTotalWhiteKeys())
  const black_key_width = Math.floor(white_key_width / 2)

  key.el.style.backgroundColor = settings.blackKeyColour
  key.el.style.border = "1px solid " + settings.borderColour
  key.el.style.position = "absolute"
  // JJK key.el.style.left = Math.floor(((white_key_width + 1) * (key.noteNumber + 1)) - (black_key_width / 2)) + 'px';
  key.el.style.left =
    white_key_width * (key.noteNumber + 1) - black_key_width / 2 + "px"
  key.el.style.width = black_key_width + "px"
  key.el.style.height = settings.height / 1.5 + "px"
  key.el.style.borderRadius = "0 0 3px 3px"
}

/**
 * Add styling to individual key on keyboard.
 * @param {object} key Element of key.
 */
const styleKey = function (key) {
  key.el.style.display = "inline-flex"
  key.el.style.userSelect = "none"
  key.el.style.boxSizing = "border-box"

  if (key.colour === "white") {
    styleWhiteKey(key)
  } else {
    styleBlackKey(key)
  }
}

/**
 * Reset styles on keyboard container and list element.
 * @param {HTMLElement} keyboard Keyboard container DOM element.
 */
const styleKeyboard = function (keyboard) {
  const styleElement = function (el) {
    el.style.cursor = "default"
    el.style.fontSize = "0px"
    el.style.position = "relative"
    el.style.listStyle = "none"
    el.style.userSelect = "none"
  }

  styleElement(keyboard.container)
  styleElement(keyboard.el)
  // JJK
  keyboard.el.style.margin = 0
  keyboard.el.style.marginLeft = settings.margin + "px"
  keyboard.el.style.padding = 0
  keyboard.el.style.width = settings.width + "px"
  keyboard.el.style.height = settings.height + "px"
  keyboard.el.style.boxSizing = "border-box"
}

function name2note(name) {
  const oct = name.slice(-1)
  name = name.slice(0, Math.max(0, name.length - 1))
  const i = notes.indexOf(name)
  const note = i + oct * 12
  return note
}

/**
 * Call user's mouseDown event.
 */
const mouseDown = function (element, callback) {
  mouse_is_down = true
  lightenUp(element)
  callback(name2note(element.title), element.title)
}

/**
 * Call user's mouseUp event.
 */
const mouseUp = function (element, callback) {
  mouse_is_down = false
  darkenDown(element)
  callback(name2note(element.title), element.title)
}

/**
 * Call user's mouseDown if required.
 */
const mouseOver = function (element, callback) {
  if (mouse_is_down) {
    lightenUp(element)
    callback(name2note(element.title), element.title)
  }
}

/**
 * Call user's mouseUp if required.
 */
const mouseOut = function (element, callback) {
  if (mouse_is_down) {
    darkenDown(element)
    callback(name2note(element.title), element.title)
  }
}

/**
 * Create key DOM element.
 * @returns {object} Key DOM element.
 */
const createKey = function (key) {
  key.el = document.createElement("li")
  key.el.id = key.id
  key.el.title = key.id
  key.el.setAttribute("data-note-type", key.colour)

  styleKey(key)

  return key
}

var getTotalWhiteKeys = function () {
  return settings.octaves * 7
}

const createKeys = function () {
  const that = this
  let i
  let key
  const keys = []
  let note_counter = 0
  let octave_counter = settings.startOctave
  const total_white_keys = getTotalWhiteKeys()

  for (i = 0; i < total_white_keys; i++) {
    if (i % this.whiteNotes.length === 0) {
      note_counter = 0
    }

    const bizarre_note_counter = this.whiteNotes[note_counter]

    if (bizarre_note_counter === "C" && i !== 0) {
      octave_counter++
    }

    key = createKey({
      colour: "white",
      octave: octave_counter,
      width: getWhiteKeyWidth(total_white_keys),
      id: this.whiteNotes[note_counter] + octave_counter,
      noteNumber: i,
    })

    keys.push(key.el)

    if (i !== total_white_keys - 1) {
      this.notesWithSharps.forEach((note, index) => {
        if (note === that.whiteNotes[note_counter]) {
          key = createKey({
            colour: "black",
            octave: octave_counter,
            width: getWhiteKeyWidth(total_white_keys) / 2,
            id: that.whiteNotes[note_counter] + "#" + octave_counter,
            noteNumber: i,
          })

          keys.push(key.el)
        }
      })
    }

    note_counter++
  }

  return keys
}

const addKeysToKeyboard = function (keyboard) {
  keyboard.keys.forEach((key) => {
    keyboard.el.append(key)
  })
}

const setKeyPressOffset = function (sorted_white_notes) {
  settings.keyPressOffset = sorted_white_notes[0] === "C" ? 0 : 1
}

var createKeyboard = function () {
  const keyboard = {
    container: settings.container, // JJK document.getElementById(settings.id),
    el: document.createElement("ul"),
    whiteNotes: orderNotes(["C", "D", "E", "F", "G", "A", "B"]),
    notesWithSharps: orderNotes(["C", "D", "F", "G", "A"]),
  }

  keyboard.keys = createKeys.call(keyboard)

  setKeyPressOffset(keyboard.whiteNotes)
  styleKeyboard(keyboard)

  // Add keys to keyboard, and keyboard to container.
  addKeysToKeyboard(keyboard)

  keyboard.container.append(keyboard.el)

  return keyboard
}

const getKeyPressed = function (keyCode) {
  return key_map[keyCode]
    .replace(
      "l",
      Number.parseInt(settings.startOctave, 10) + settings.keyPressOffset,
    )
    .replace(
      "u",
      (
        Number.parseInt(settings.startOctave, 10) +
        settings.keyPressOffset +
        1
      ).toString(),
    )
}

/**
 * Handle a keyboard key being pressed.
 * @param {object} key The keyboard event of the currently pressed key.
 * @param {callback} callback The user's noteDown function.
 */
const keyboardDown = function (key, callback) {
  if (key.keyIdentifier) {
    const unicode = key.keyIdentifier.slice(2)
    var i = Number.parseInt(unicode, 16)
  } else var i = key.keyCode

  if (Number.isNaN(i)) return

  let midinote = getMidiKey(i)
  if (midinote == undefined) return
  midinote += settings.oct * 12

  if (midinote in keysDown) return
  keysDown[midinote] = true

  const keyname = notes[midinote % 12] + ((midinote / 12) | 0)
  callback(midinote, keyname)
  lightenUp(document.getElementById(keyname))
}

/**
 * Handle a keyboard key being released.
 * @param {HTMLElement} key The DOM element of the key that was released.
 * @param {callback} callback The user's noteDown function.
 */
const keyboardUp = function (key, callback) {
  if (key.keyIdentifier) {
    const unicode = key.keyIdentifier.slice(2)
    var i = Number.parseInt(unicode, 16)
  } else var i = key.keyCode

  if (Number.isNaN(i)) return

  let midinote = getMidiKey(i)
  if (midinote == undefined) return
  midinote += settings.oct * 12

  delete keysDown[midinote]

  const keyname = notes[midinote % 12] + ((midinote / 12) | 0)
  callback(midinote, keyname)
  darkenDown(document.getElementById(keyname))
}

/**
 * Add event listeners to keyboard.
 * @param {HTMLElement} keyboard_element
 */
function addListeners(keyboard_element) {
  // Key is pressed down on keyboard.
  window.addEventListener("keydown", (key) => {
    keyboardDown(key, this.keyDown)
  })

  // Key is released on keyboard.
  window.addEventListener("keyup", (key) => {
    keyboardUp(key, this.keyUp)
  })

  // Mouse is clicked down on keyboard element.
  keyboard_element.addEventListener("mousedown", (event) => {
    mouseDown(event.target, this.keyDown)
  })

  // Mouse is released from keyboard element.
  keyboard_element.addEventListener("mouseup", (event) => {
    mouseUp(event.target, this.keyUp)
  })

  // Mouse is moved over keyboard element.
  keyboard_element.addEventListener("mouseover", (event) => {
    mouseOver(event.target, this.keyDown)
  })

  // Mouse is moved out of keyvoard element.
  keyboard_element.addEventListener("mouseout", (event) => {
    mouseOut(event.target, this.keyUp)
  })

  // Device supports touch events.
  if ("ontouchstart" in document.documentElement) {
    keyboard_element.addEventListener("touchstart", (event) => {
      mouseDown(event.target, this.keyDown)
    })

    keyboard_element.addEventListener("touchend", (event) => {
      mouseUp(event.target, this.keyUp)
    })

    keyboard_element.addEventListener("touchleave", (event) => {
      mouseOut(event.target, this.keyUp)
    })

    keyboard_element.addEventListener("touchcancel", (event) => {
      mouseOut(event.target, this.keyUp)
    })
  }
}

/**
 * Qwerty Hancock constructor.
 * @param {object} settings Optional user settings.
 */
export function Piano(settings) {
  this.version = version

  this.keyDown = function () {
    // Placeholder function.
  }

  this.keyUp = function () {
    // Placeholder function.
  }

  init.call(this, settings)
}
