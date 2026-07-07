/** @type {HTMLCanvasElement} */
const canvas = document.querySelector("#scene")
const ctx = canvas.getContext("2d")
const playButton = document.querySelector("#play")
const baseSelect = document.querySelector("#base")
const modeSelect = document.querySelector("#mode")
const volumeKnob = document.querySelector("#volume")

let audioContext

const points = []

for (let i = 0; i < 48; i++) {
  points[i] = /** @type {any} */ ({})
  points[i].angle = 180 // 0:punch 180:no punch
  points[i].width = canvas.height / 2 / points.length
  points[i].widthModel = canvas.height / 2 / points.length
  points[i].trig = false
}

function pointFromPointAngleRadius(myPoint, myAngle, myRadius) {
  const newPoint = [0, 0]
  newPoint[0] =
    myPoint[0] + Math.cos((myAngle * 3.14) / 180) * Math.floor(myRadius)
  newPoint[1] =
    myPoint[1] + Math.sin((myAngle * 3.14) / 180) * Math.floor(myRadius)
  return newPoint
}

function updateSize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  for (let i = 0; i < 48; i++) {
    points[i].width = canvas.height / 2 / points.length
    points[i].widthModel = canvas.height / 2 / points.length
  }
}
window.onresize = updateSize

function canvasClear(z) {
  ctx.beginPath()
  ctx.rect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "rgba(0,0,0," + z + ")"
  ctx.fill()
}

function intersect(rect1, rect2) {
  const [x1, y1, w1, h1] = rect1
  const [x2, y2, w2, h2] = rect2
  if (x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1) {
    return false
  }
  return true
}

function draw() {
  const speed = document.querySelector("#speed").valueAsNumber
  const decay = document.querySelector("#decay").valueAsNumber
  const clear = 1
  // clear = 1 - Number(document.getElementById('clear').value);
  canvasClear(clear)
  const type = document.querySelector("#type").value
  ctx.beginPath()
  ctx.fillStyle = "#ccc"
  const width = canvas.height / 2 / points.length
  const head = [
    canvas.width / 2,
    canvas.height / 2 - width / 2,
    canvas.width / 2,
    width * 2,
  ]
  head[1] = speed > 0 ? canvas.height / 2 : canvas.height / 2 - width * 2
  // ctx.rect(canvas.width / 2, canvas.height / 2 - width / 2, canvas.width / 2, 1);
  ctx.fill()
  for (let i = 0; i < points.length; i++) {
    ctx.beginPath()
    const hue = (i / (points.length - 1)) * 360
    ctx.fillStyle = "hsl(" + hue + ", 100%, 50%)"
    points[i].width += (points[i].widthModel - points[i].width) / 5
    const { width } = points[i]
    const radius = (i + 1) * (canvas.height / 2 / points.length) + width / 2
    // if (document.getElementById('reverse').checked) { radius = (points.length - i) * ((canvas.height / 2) / points.length) + width / 2}
    const point = pointFromPointAngleRadius(
      [canvas.width / 2, canvas.height / 2],
      points[i].angle,
      radius,
    )
    let posY = point[1] - canvas.height / 2 / points.length / 2
    if (speed < 0) {
      posY = point[1] + canvas.height / 2 / points.length / 2
    }
    if (intersect(head, [point[0] - width, posY, width, width])) {
      if (points[i].trig === false) {
        synth(i, decay, type)
        points[i].trig = true
        points[i].widthModel = (canvas.height / 2 / points.length) * 15
      } else {
        points[i].widthModel = canvas.height / 2 / points.length
      }
      ctx.fillStyle = "#fff"
    } else {
      points[i].widthModel = canvas.height / 2 / points.length
      points[i].trig = false
    }
    ctx.rect(point[0] - width, point[1] - width / 2, width, width)
    ctx.fill()
  }
  if (
    document.querySelector("#play ui-picto").getAttribute("value") === "pause"
  ) {
    for (let i = 0; i < points.length; i++) {
      points[i].angle += (points.length - i) * speed
    }
  }
  requestAnimationFrame(draw)
}

const scales = {
  "Chromatic": [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 60],
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

function isScale(scaleName) {
  return scales.hasOwnProperty(scaleName)
}

function getNote(midiNote, scale) {
  const scaleNotes = scales[scale][0]
  const octaveLength = scaleNotes.length
  const noteInScale = scaleNotes[midiNote % octaveLength]
  const octaveOffset = Math.floor(midiNote / octaveLength) * 12
  return noteInScale + octaveOffset
}

const customWaves = {}
function addCustomWave(name, realValues) {
  const real = new Float32Array(realValues)
  const imag = new Float32Array(realValues.length)
  customWaves[name] = audioContext.createPeriodicWave(real, imag)
}

function synth(midinote, decay, type) {
  let frequency
  let note = midinote + Number(baseSelect.value)
  const mode = modeSelect.value
  const volume = volumeKnob.valueAsNumber
  if (isScale(mode)) {
    note = getNote(note, document.querySelector("#mode").value)
    let tuning = 440
    if (document.querySelector("#tuning")?.checked) tuning = 432 // hippie mode
    frequency = tuning * 2 ** ((note - 69) / 12)
  }
  if (mode === "55hz") {
    frequency = 55 * (midinote + note + 1)
  }
  if (mode === "20hz") {
    frequency = 20 * (midinote + note + 1)
  }
  if (mode === "48hz") {
    frequency = 48 * (midinote + note + 1)
  }
  if (mode === "100hz") {
    frequency = 100 * (midinote + note + 1)
  }
  const oscillator = audioContext.createOscillator()
  if (
    type === "sawtooth" ||
    type === "square" ||
    type === "triangle" ||
    type === "sine"
  ) {
    oscillator.type = type
  } else if (type !== "no-sound") {
    oscillator.setPeriodicWave(customWaves[type])
  }
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
  const gainNode = audioContext.createGain()
  const now = audioContext.currentTime
  gainNode.gain.cancelScheduledValues(now)
  gainNode.gain.setValueAtTime(0, now)
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.005)
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  oscillator.start()
  gainNode.gain.linearRampToValueAtTime(0, now + decay / 1000)
  oscillator.stop(audioContext.currentTime + decay / 1000)
}

function updateMode() {
  const mode = document.querySelector("#mode").value
  const baseSelect = document.querySelector("#base")
  if (isScale(mode)) {
    const baseNote = scales[mode][1]
    baseSelect.value = baseNote
  } else {
    baseSelect.value = 0
  }
}

playButton.onclick = () => {
  const picto = playButton.querySelector("ui-picto")
  const icon = playButton.querySelector("use")
  const isPlay = picto.getAttribute("value") === "play"
  playButton.setAttribute("aria-label", isPlay ? "Pause" : "Play")
  picto.setAttribute("value", isPlay ? "pause" : "play")
  icon.setAttribute("href", isPlay ? "#picto-pause" : "#picto-play")
}

function start() {
  audioContext = new AudioContext()
  updateSize()
  draw()
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
}

start()
updateSize()

export {}
