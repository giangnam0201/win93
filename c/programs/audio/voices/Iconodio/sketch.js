/*
  p5js meets sys42 <3
  Mouse to draw and Space to keep recording
  Created by Jankenpopp.com
  March 7th, 2025
*/

const blobs = []
const icons = []
mouseReleasedTime = 0
mouseDownTime = 0
let isMouseHeld = false
let fb = false

/** @type {HTMLSelectElement} */
const scalesEl = document.querySelector("#scales")
/** @type {HTMLSelectElement} */
const tonicEl = document.querySelector("#tonic")
/** @type {HTMLElement} */
let interfaceEl = document.querySelector("#interface")
/** @type {HTMLElement} */
let preloadEl = document.querySelector("#preload")
preloadEl.onmousedown = (e) => {
  e.stopImmediatePropagation()
  e.stopPropagation()
}

function preload() {
  for (let i = 0; i < window.iconsURL.length; i++) {
    icons[i] = loadImage(window.iconsURL[i])
  }
}

function setup() {
  createCanvas(800, 600)
  windowResized()
  rectMode(CENTER)
  imageMode(CENTER)
  pixelDensity(1)
  noSmooth()
  preloadEl.remove()
  preloadEl = undefined
  interfaceEl.classList.remove("hide")
  interfaceEl = undefined
}

function draw() {
  clear()
  if (mouseIsPressed && !isMouseHeld) {
    mouseDownTime = millis()
    isMouseHeld = true
  } else if (!mouseIsPressed && isMouseHeld && !keyIsDown(32)) {
    isMouseHeld = false
  }
  for (let i = 0; i < blobs.length; i++) {
    blobs[i].update()
    blobs[i].draw()
  }
  killBlobs()
}

function getPanFromX(x) {
  return mapper(x, 0, window.width, -1, 1)
}

function getPitchFromY(y) {
  let pitch = mapper(y, 0, window.height, 0, 127)
  pitch = constrain(pitch, 0, 127)
  pitch = 127 - Math.round(pitch)
  return pitch
}

function distanceSquared2D(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  return dx * dx + dy * dy
}

function mapper(value, start1, stop1, start2, stop2) {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1))
}

function blob(x, y) {
  this.x = x
  this.y = y
  this.creationTime = millis()
  this.color = color(random(255), random(255), random(255))
  this.size = 16 * random(2, height / 127)
  this.image = icons[floor(random(icons.length))]
  this.pitch = getPitchFromY(this.y)
  this.isDying = false
  this.deathStartTime = 0
  this.pan = getPanFromX(this.x)
  this.oscillator = null
  this.decay = 50
  if (blobs.length > 0) {
    this.decay =
      50 +
      floor(
        distanceSquared2D(
          this.x,
          this.y,
          blobs[blobs.length - 1].x,
          blobs[blobs.length - 1].y,
        ) / 20,
      )
    if (this.decay > 500) {
      this.decay = 500
    }
  }
  if (!fb) {
    fb = true
    this.decay = 50
  }
  this.oscillator = synth(this.pitch, this.decay, "square", this.pan)
  this.update = function () {
    this.x += random(-3, 3)
    this.y += random(-3, 3)
    if (!isMouseHeld && !this.isDying) {
      const delayBeforeDeath = this.creationTime - mouseDownTime
      this.deathStartTime = millis() + delayBeforeDeath
      this.isDying = true
    }
  }
  this.draw = function () {
    image(this.image, this.x, this.y, this.size, this.size)
  }
  this.stopSound = function () {
    if (this.oscillator) {
      this.oscillator.stop()
      this.oscillator.disconnect()
      this.oscillator = null
    }
  }
}

function killBlobs() {
  for (let i = blobs.length - 1; i >= 0; i--) {
    if (blobs[i].isDying && millis() - blobs[i].deathStartTime > 0) {
      synth(blobs[i].pitch, blobs[i].decay, "triangle", blobs[i].pan)
      blobs.splice(i, 1)
    }
  }
}

function mouseDragged() {
  blobs[blobs.length] = new blob(mouseX, mouseY)
}

function mousePressed(e) {
  if (e.target.id != "defaultCanvas0") return
  blobs[blobs.length] = new blob(mouseX, mouseY)
}

function mouseReleased(e) {
  fb = false
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)()

const scales = {
  "Chromatic": [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 69]],
  "Ionian": [[0, 2, 4, 5, 7, 9, 11], 24],
  "Dorian": [[0, 2, 3, 5, 7, 9, 10], 24],
  "Phrygian": [[0, 1, 3, 5, 7, 8, 10], 24],
  "Lydian": [[0, 2, 4, 6, 7, 9, 11], 24],
  "Mixolydian": [[0, 2, 4, 5, 7, 9, 10], 24],
  "Aeolian": [[0, 2, 3, 5, 7, 8, 10], 24],
  "Locrian": [[0, 1, 3, 5, 6, 8, 10], 24],
  "Major Blues": [[0, 2, 3, 4, 7, 9], 12],
  "Minor Blues": [[0, 3, 5, 6, 7, 10], 12],
  "Diminish": [[0, 2, 3, 6, 8, 9], 24],
  "Combination Diminish": [[0, 3, 4, 6, 7, 9, 10], 24],
  "Major Pentatonic": [[0, 2, 4, 7, 9], 12],
  "Minor Pentatonic": [[0, 3, 5, 7, 10], 12],
  "Raga Bhairav": [[0, 2, 4, 5, 7, 9, 10], 24],
  "Raga Gamanasrama": [[0, 2, 3, 5, 7, 8, 10], 24],
  "Raga Todi": [[0, 1, 3, 5, 7, 9, 10], 24],
  "Spanish Scale": [[0, 1, 3, 4, 5, 7, 8, 10], 24],
  "Gypsy Scale": [[0, 2, 3, 6, 7, 9, 10], 24],
  "Arabian Scale": [[0, 2, 3, 5, 7, 9, 10], 24],
  "Egyptian Scale": [[0, 2, 5, 7, 9, 10], 24],
  "Hawaiian Scale": [[0, 2, 4, 7, 9], 12],
  "Bali Island Pelog": [[0, 1, 2, 5, 7], 12],
  "Japanese Miyakobushi": [[0, 2, 4, 7, 9], 12],
  "Ryukyu Scale": [[0, 2, 4, 7, 9, 11], 12],
  "Wholetone": [[0, 2, 4, 6, 8, 10], 24],
}

function getNote(midiNote, scale) {
  const scaleNotes = scales[scale][0]
  let closestNote = null
  let smallestDiff = Infinity
  const octaveRange = 2
  const minOctave = Math.floor(midiNote / 12) - octaveRange
  const maxOctave = Math.floor(midiNote / 12) + octaveRange
  for (let octave = minOctave; octave <= maxOctave; octave++) {
    for (let i = 0; i < scaleNotes.length; i++) {
      const noteInScale = scaleNotes[i] + octave * 12
      const diff = Math.abs(midiNote - noteInScale)

      if (diff < smallestDiff) {
        smallestDiff = diff
        closestNote = noteInScale
      }
    }
  }
  return closestNote
}

function synth(midinote, decay, type, pan = 0) {
  let note = midinote
  const mode = scalesEl.value
  note = getNote(note, mode)
  const tuning = 440
  const frequency = tuning * 2 ** ((note - Number(tonicEl.value)) / 12)
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  const pannerNode = audioContext.createStereoPanner()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
  pannerNode.pan.setValueAtTime(pan, audioContext.currentTime)
  gainNode.gain.setValueAtTime(0.25, audioContext.currentTime)
  oscillator.connect(gainNode)
  gainNode.connect(pannerNode)
  pannerNode.connect(audioContext.destination)
  oscillator.start()
  gainNode.gain.linearRampToValueAtTime(
    0,
    audioContext.currentTime + decay / 1000,
  )
  oscillator.stop(audioContext.currentTime + decay / 1000)
  return oscillator
}
