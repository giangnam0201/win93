import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { fileIndex } from "../../../../../42/api/fileIndex.js"
import { App } from "../../../../../42/api/os/App.js"
import { audioMetadata } from "../../../../../42/formats/metadata/audioMetadata.js"
import { updateSvg } from "../../../../libs/jdenticon/3.3/jdenticon.js"

import { BoostNode } from "../../../../../42/lib/audio/effect/BoostNode.js"
import { ConvoReverbNode } from "../../../../../42/lib/audio/effect/ConvoReverbNode.js"
import { DJFilterNode } from "../../../../../42/lib/audio/effect/DJFilterNode.js"
import { ThreeBandEqualizerNode } from "../../../../../42/lib/audio/effect/ThreeBandEqualizerNode.js"

const app = new App()

document.querySelector("#openFile").onclick = () => {
  app.openFile()
}

app.on("decode", async (fileAgent) => {
  initSong(fileAgent.path, await fileAgent.getBlob())
})

if (!app.file) {
  // app.loadFile("/c/programs/audio/voices/VirtuaDJ/examples/morusque.mp3")
  // app.loadFile("/c/programs/audio/voices/VirtuaDJ/examples/audio.mp3")
  app.openFile()
}

const audioContext = new AudioContext()

const preAmpGain = new GainNode(audioContext)
const equalizer = new ThreeBandEqualizerNode(audioContext)
const djFilter = new DJFilterNode(audioContext)
const reverb = new ConvoReverbNode(audioContext)
const boost = new BoostNode(audioContext)
const masterGain = new GainNode(audioContext)
let granulator

preAmpGain
  .connect(boost)
  .connect(equalizer)
  .connect(djFilter)
  .connect(reverb)
  .connect(masterGain)
  .connect(audioContext.destination)

preloadSFX()

let isPlaying = false
let reverse = false
let isLoaded = false

let audioSource
let oiduaSource
let decodedAudio
let reversedBuffer
let currentSource

let position = 0

let audioPause = 0
let audioStart = 0
let oiduaPause = 0
let oiduaStart = 0

function reverseAudioBuffer(audioBuffer) {
  const { length, numberOfChannels } = audioBuffer
  const reversedBuffer = audioContext.createBuffer(
    numberOfChannels,
    length,
    audioBuffer.sampleRate,
  )
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    const reversedChannelData = reversedBuffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      reversedChannelData[i] = channelData[length - 1 - i]
    }
  }

  return reversedBuffer
}

const labelEl = document.querySelector("#label")
const labelSvgEl = labelEl.querySelector("svg")
const labelImgEl = labelEl.querySelector("img")

async function initSong(path, blob) {
  const metadata = await audioMetadata(blob.stream())
  const cover = metadata.getCover()

  if (cover) {
    labelSvgEl.classList.toggle("hide", true)
    labelImgEl.classList.toggle("hide", false)
    labelImgEl.src = cover.src
  } else {
    labelSvgEl.classList.toggle("hide", false)
    labelImgEl.classList.toggle("hide", true)
    updateSvg(labelSvgEl, path)
  }

  if (!granulator) {
    granulator = new GranulatorNode(audioContext)
    granulator.connect(djFilter)
  }

  if (audioSource) {
    try {
      audioSource.stop()
      audioSource.disconnect()
    } catch (err) {
      console.log("Error stopping audioSource:", err)
    }
  }

  if (oiduaSource) {
    try {
      oiduaSource.stop()
      oiduaSource.disconnect()
    } catch (err) {
      console.log("Error stopping oiduaSource:", err)
    }
  }

  position = 0
  audioPause = audioContext.currentTime
  oiduaPause = audioContext.currentTime
  oiduaStart = audioContext.currentTime
  audioStart = audioContext.currentTime

  decodedAudio = await audioContext.decodeAudioData(await blob.arrayBuffer())
  audioSource = audioContext.createBufferSource()
  granulator.setAudioSource(audioSource)
  audioSource.buffer = decodedAudio
  reversedBuffer = reverseAudioBuffer(decodedAudio)
  document.querySelector("#playFile ui-picto").setAttribute("value", "play")
  isLoaded = true
  isPlaying = false
  document
    .querySelector("#playFile")
    .setAttribute("aria-pressed", isPlaying ? "true" : "false")
  document.querySelector("#pitch").value = 1
  pitchRate = 1
  if (currentSource) {
    currentSource.playbackRate.value = 1
  }

  reverse = false
  document.querySelector("#reverse").setAttribute("aria-pressed", reverse)
  updatePosition()

  const canvas = document.querySelector("#vue")
  drawBuffer(
    canvas.width,
    canvas.height,
    canvas.getContext("2d"),
    audioSource.buffer,
  )
  position = 0

  discAngle = 0
  labelEl.style.transform = `rotate(${discAngle}deg)`
  resetSong()
  document.querySelector("#master").valueAsNumber = 1
  masterGain.gain.setValueAtTime(1, audioContext.currentTime)
}

function resetSong() {
  document.querySelector("#bass").valueAsNumber = 0.5
  document.querySelector("#mid").valueAsNumber = 0.5
  document.querySelector("#high").valueAsNumber = 0.5
  equalizer.update({ low: 0.5, mid: 0.5, high: 0.5 })

  document.querySelector("#filter").valueAsNumber = 0.5
  djFilter.update(0.5)

  document.querySelector("#reverb").valueAsNumber = 0
  reverb.update(0)

  document.querySelector("#boost").valueAsNumber = 0
  boost.update(0)

  document.querySelector("#granulator").valueAsNumber = 0
  granulator.update(0)
}

function playSource() {
  const pitchValue = pitchRate
  if (reverse) {
    oiduaSource = audioContext.createBufferSource()
    oiduaSource.buffer = reversedBuffer
    oiduaSource.connect(preAmpGain)
    oiduaSource.playbackRate.value = pitchValue
    oiduaSource.start(0, reversedBuffer.duration - position)
    currentSource = oiduaSource
    oiduaStart = audioContext.currentTime
  } else {
    audioSource = audioContext.createBufferSource()
    audioSource.buffer = decodedAudio
    audioSource.connect(preAmpGain)
    audioSource.playbackRate.value = pitchValue
    audioSource.start(0, position)
    currentSource = audioSource
    audioStart = audioContext.currentTime
  }
}

function stopSource() {
  if (currentSource) {
    try {
      currentSource.stop()
      currentSource.disconnect()
    } catch {}

    currentSource = null
  }
}

document.querySelector("#playFile").onclick = () => {
  if (!isLoaded) return
  if (isPlaying) {
    stopSource()
  } else {
    playSource()
  }

  isPlaying = !isPlaying
  const picto = isPlaying ? "pause" : "play"
  document.querySelector("#playFile ui-picto").setAttribute("value", picto)
  document
    .querySelector("#playFile")
    .setAttribute("aria-pressed", isPlaying ? "true" : "false")
}

function updatePosition() {
  const { currentTime } = audioContext
  if (reverse) {
    if (oiduaSource !== undefined) {
      oiduaPause = currentTime - oiduaStart
      position -= oiduaPause * pitchRate
      position = Math.max(position, 0)
      oiduaStart = currentTime
    }
  } else if (audioSource !== undefined) {
    audioPause = currentTime - audioStart
    position += audioPause * pitchRate
    position = Math.min(position, decodedAudio.duration)
    audioStart = currentTime
  }
}

document.querySelector("#reverse").onclick = () => {
  if (!isLoaded) return
  updatePosition()
  reverse = !reverse
  if (isPlaying) {
    stopSource()
    playSource()
  }

  const reverseButton = document.querySelector("#reverse")
  const isPressed = reverseButton.getAttribute("aria-pressed") === "true"
  reverseButton.setAttribute("aria-pressed", isPressed ? "false" : "true")
}

document.querySelector("#reset").onclick = () => {
  if (!isLoaded) return
  resetSong()
}

document.querySelector("#rewind").onclick = () => {
  if (!isLoaded) return
  document.querySelector("#pitch").value = 1
  pitchRate = 1

  position = 0
  stopSource()
  if (isPlaying) playSource()

  updatePosition()
  if (reverse) {
    const reverseButton = document.querySelector("#reverse")
    const isPressed = reverseButton.getAttribute("aria-pressed") === "true"
    reverseButton.setAttribute("aria-pressed", isPressed ? "false" : "true")
    reverse = false
  }
}

document.querySelector("#stop").onclick = () => {
  if (!isLoaded) return
  document.querySelector("#pitch").value = 1
  pitchRate = 1
  if (currentSource) {
    currentSource.playbackRate.value = 1
  }

  position = 0
  updatePosition()
  stopSource()
  isPlaying = false
  const picto = isPlaying ? "pause" : "play"
  document.querySelector("#playFile ui-picto").setAttribute("value", picto)
  document
    .querySelector("#playFile")
    .setAttribute("aria-pressed", isPlaying ? "true" : "false")
  if (reverse) {
    const reverseButton = document.querySelector("#reverse")
    const isPressed = reverseButton.getAttribute("aria-pressed") === "true"
    reverseButton.setAttribute("aria-pressed", isPressed ? "false" : "true")
    reverse = false
    position = 0
  } else {
    position = 0
  }
}

let pitchRate = 1
const pitchSlider = document.querySelector("#pitch")
pitchSlider.addEventListener("input", (event) => {
  if (!isLoaded) return
  updatePosition()
  pitchRate = Number(event.target.value)
  if (currentSource) {
    currentSource.playbackRate.value = pitchRate
  }
})

document.querySelector("#pitch").addEventListener("contextmenu", (e) => {
  e.preventDefault()
  if (!isLoaded) return
  e.target.value = 1
  pitchRate = 1
  if (currentSource) {
    currentSource.playbackRate.value = pitchRate
  }
})

let pitchRateState = 1
let reverseState = false
let isScratching = false
const scratchSlider = document.querySelector("#scratch")
scratchSlider.addEventListener("input", (event) => {
  if (!isLoaded) return
  updatePosition()
  const value = Math.abs(Number(event.target.value) - 2)
  if (Number(event.target.value) >= 2) {
    if (reverse !== true) {
      reverse = true
      if (isPlaying || isScratching) {
        stopSource()
        playSource()
      }
    }
  } else if (reverse !== false) {
    reverse = false
    if (isPlaying || isScratching) {
      stopSource()
      playSource()
    }
  }

  pitchRate = value
  if (currentSource) {
    currentSource.playbackRate.value = value
  }
})

scratchSlider.addEventListener("mousedown", () => {
  if (!isLoaded) return
  pitchRateState = Number(document.querySelector("#pitch").value)
  reverseState = reverse
  if (!isPlaying) {
    stopSource()
    playSource()
  }

  isScratching = true
})

scratchSlider.addEventListener("change", () => {
  document.querySelector("#scratch").value = 2
  if (!isLoaded) return
  updatePosition()
  if (reverse !== reverseState) {
    reverse = reverseState
    if (isPlaying || isScratching) {
      stopSource()
      playSource()
    }
  }

  document.querySelector("#pitch").value = pitchRateState
  pitchRate = pitchRateState
  if (currentSource) {
    currentSource.playbackRate.value = pitchRateState
  }

  if (isScratching && !isPlaying) {
    stopSource()
  }

  isScratching = false
})

let discScratching = false
const scratchDiscPosition = { x: 0, y: 0 }
const discScratcher = document.querySelector("#disc")

discScratcher.addEventListener("mousedown", () => {
  if (!isLoaded) return
  discScratching = true
  const rect = discScratcher.getBoundingClientRect()
  const iframeRect = window.frameElement.getBoundingClientRect()
  scratchDiscPosition.x = iframeRect.left + rect.left + rect.width / 2
  scratchDiscPosition.y = iframeRect.top + rect.top + rect.height / 2
  lastMouseDiscAngle = mouseDiscAngle
  pitchRateState = Number(document.querySelector("#pitch").value)
  reverseState = reverse
  if (!isPlaying) {
    stopSource()
    playSource()
  }

  isScratching = true
})

document.addEventListener("mouseup", () => {
  if (discScratching && isLoaded) {
    document.querySelector("#scratch").value = 2
    if (!isLoaded) return
    updatePosition()
    if (reverse !== reverseState) {
      reverse = reverseState
      if (isPlaying || isScratching) {
        stopSource()
        playSource()
      }
    }

    document.querySelector("#pitch").value = pitchRateState
    pitchRate = pitchRateState
    if (currentSource) {
      currentSource.playbackRate.value = pitchRateState
    }

    if (isScratching && !isPlaying) {
      stopSource()
    }

    isScratching = false
    discScratching = false
    lastDiscMove = 0
  }
})

function calculateAngle(center, point) {
  const deltaX = point.x - center.x
  const deltaY = point.y - center.y
  const radians = Math.atan2(deltaY, deltaX)
  const degrees = (radians * 180) / Math.PI
  return degrees >= 0 ? degrees : degrees + 360
}

let mouseDiscAngle = 0
document.addEventListener("mousemove", (e) => {
  if (discScratching && isLoaded) {
    const iframeRect = window.frameElement.getBoundingClientRect()
    mouseDiscAngle = calculateAngle(scratchDiscPosition, {
      x: iframeRect.left + e.x,
      y: iframeRect.top + e.y,
    })
  }
})

let lastMouseDiscAngle = 0

function getAngleDifference(lastAngle, currentAngle) {
  let diff = currentAngle - lastAngle
  if (diff > 180) {
    diff -= 360
  } else if (diff < -180) {
    diff += 360
  }

  return diff
}

let lastDiscMove = 0

// eslint-disable-next-line complexity
function interfaceUpdate() {
  if (!isLoaded) return
  if (
    (isPlaying &&
      !isScratching &&
      !reverse &&
      position >= audioSource.buffer.duration) ||
    (isPlaying && !isScratching && reverse && position <= 0)
  ) {
    updatePosition()
    stopSource()
    isPlaying = false
    const picto = isPlaying ? "pause" : "play"
    document.querySelector("#playFile ui-picto").setAttribute("value", picto)
    document
      .querySelector("#playFile")
      .setAttribute("aria-pressed", isPlaying ? "true" : "false")
    if (reverse) {
      const reverseButton = document.querySelector("#reverse")
      const isPressed = reverseButton.getAttribute("aria-pressed") === "true"
      reverseButton.setAttribute("aria-pressed", isPressed ? "false" : "true")
      reverse = false
      position = 0
    } else {
      position = 0
    }
  }

  if (discScratching) {
    let discMove = getAngleDifference(lastMouseDiscAngle, mouseDiscAngle)
    if (lastDiscMove !== discMove) {
      lastDiscMove += (discMove - lastDiscMove) / 5
      lastMouseDiscAngle = mouseDiscAngle
      updatePosition()
      if (discMove !== 0) {
        if (discMove > 4) {
          discMove = 4
        }

        if (discMove < -4) {
          discMove = -4
        }

        pitchRate = Math.abs(discMove / 2)
      }

      if (discMove < 0 && !reverse) {
        reverse = true
      }

      if (discMove > 0 && reverse) {
        reverse = false
      }

      stopSource()
      playSource()
    }
  }

  if (!isPlaying) return
  updatePosition()
}

function drawBuffer(width, height, context, buffer) {
  const data = buffer.getChannelData(0)
  const step = Math.ceil(data.length / width)
  const amp = (height - 8) / 2
  context.clearRect(0, 0, width, height)
  // context.fillStyle = "#000"
  // context.fillRect(0, 0, width, height)
  context.fillStyle = "#fff"
  // context.fillStyle = getComputedStyle(
  //   document.documentElement,
  // ).getPropertyValue("--accent-color")
  for (let i = 0; i < width; i++) {
    let min = 1
    let max = -1
    for (let j = 0; j < step; j++) {
      const datum = data[i * step + j]
      if (datum < min) min = datum
      if (datum > max) max = datum
    }

    context.fillRect(i, 4 + (1 + min) * amp, 1, Math.max(1, (max - min) * amp))
  }
}

const vuePos = document.querySelector("#vuePos")
const vueC = document.querySelector("#vue")
function vueUpdate() {
  const positionRatio = position / audioSource.buffer.duration
  const newPos = Math.round(positionRatio * vueC.offsetWidth)
  vuePos.style.translate = `${newPos}px 0px`
}

let discAngle = 0
function discUpate() {
  if (!isPlaying && !isScratching) return
  const sens = reverse ? -1 : 1
  discAngle = (discAngle + pitchRate * (sens * 3.9)) % 360
  labelEl.style.transform = `rotate(${discAngle}deg)`
}

function loop() {
  if (isLoaded) {
    vueUpdate()
    discUpate()
    interfaceUpdate()
  }

  requestAnimationFrame(loop)
}

loop()

vueC.addEventListener("click", function (e) {
  if (!isLoaded) return
  const rect = this.getBoundingClientRect()
  let x = (e.pageX - rect.left) / rect.width
  x *= audioSource.buffer.duration
  updatePosition()
  position = x
  if (isPlaying) {
    stopSource()
    playSource()
  }
})

// MARK: EQ 3
document.querySelector("#bass").addEventListener("input", (e) => {
  if (!isLoaded) return
  equalizer.update({ low: e.target.valueAsNumber })
})

document.querySelector("#mid").addEventListener("input", (e) => {
  if (!isLoaded) return
  equalizer.update({ mid: e.target.valueAsNumber })
})

document.querySelector("#high").addEventListener("input", (e) => {
  if (!isLoaded) return
  equalizer.update({ high: e.target.valueAsNumber })
})

// MARK: DJ Filter
document.querySelector("#filter").addEventListener("input", (e) => {
  if (!isLoaded) return
  djFilter.update(e.target.valueAsNumber)
})

// MARK: Convo Reverb
document.querySelector("#reverb").addEventListener("input", (e) => {
  if (!isLoaded) return
  reverb.update(e.target.valueAsNumber)
})

// MARK: Boost
document.querySelector("#boost").addEventListener("input", (e) => {
  if (!isLoaded) return
  boost.update(e.target.valueAsNumber)
})

document.querySelector("#master").addEventListener("input", (e) => {
  if (!isLoaded) return
  masterGain.gain.setValueAtTime(
    e.target.valueAsNumber,
    audioContext.currentTime,
  )
})

// MARK: Granulator

class GranulatorNode extends GainNode {
  constructor(audioContext, options) {
    super(audioContext)
    this.isPlaying = false
    this.value = options?.value ?? 0
    this.volume = options?.volume ?? 0
    this.gain.value = this.volume
    this.granulationTimeout = null
    this.granuleDuration = 0.1
    this.playbackRate = 1
    this.audioSource = null
    this.activeGranules = new Set()
    this.maxGranules = 100
  }
  setAudioSource(audioSource) {
    this.audioSource = audioSource
  }
  startGranulation() {
    if (this.isPlaying || !this.audioSource) return
    this.isPlaying = true
    this.triggerGranule()
  }
  stopGranulation() {
    if (!this.isPlaying) return
    this.isPlaying = false
    clearTimeout(this.granulationTimeout)
    this.activeGranules.forEach((granule) => granule.stop())
    this.activeGranules.clear()
  }
  triggerGranule() {
    if (!this.audioSource) return
    let startOffset =
      position +
      Math.random() *
        (this.audioSource.buffer.duration / 1000 - this.granuleDuration)
    const granuleSource = this.context.createBufferSource()
    granuleSource.buffer = this.audioSource.buffer
    granuleSource.playbackRate.setValueAtTime(
      pitchRate,
      this.context.currentTime,
    )
    const volumeGain = this.context.createGain()
    volumeGain.gain.setValueAtTime(0, this.context.currentTime)
    volumeGain.gain.linearRampToValueAtTime(
      this.volume,
      this.context.currentTime + 0.01,
    )
    volumeGain.gain.setValueAtTime(
      this.volume,
      this.context.currentTime + this.granuleDuration - 0.01,
    )
    volumeGain.gain.linearRampToValueAtTime(
      0,
      this.context.currentTime + this.granuleDuration,
    )
    granuleSource.connect(volumeGain)
    volumeGain.connect(this)
    if (this.activeGranules.size >= this.maxGranules) {
      const oldestGranule = [...this.activeGranules][0]
      oldestGranule.stop()
      this.activeGranules.delete(oldestGranule)
    }

    this.activeGranules.add(granuleSource)
    this.granuleDuration = Math.max(0.005, this.granuleDuration)
    if (startOffset < 0) {
      startOffset = 0
    }

    granuleSource.start(0, startOffset, this.granuleDuration)
    granuleSource.onended = () => {
      this.activeGranules.delete(granuleSource)
      volumeGain.disconnect(this)
    }

    const nextTimeout = (1 - this.value) * 300 * Math.random()
    this.granulationTimeout = setTimeout(() => {
      if (this.isPlaying) this.triggerGranule()
    }, nextTimeout)
  }

  update(value) {
    value = Math.max(0, Math.min(value, 1))
    this.value = value
    this.granuleDuration = 0.005 + (1 - value) * 0.2
    this.volume = value * 0.666
    this.gain.setValueAtTime(this.volume, this.context.currentTime)
    if (value > 0 && !this.isPlaying) {
      this.startGranulation()
    } else if (value === 0 && this.isPlaying) {
      this.stopGranulation()
    }
  }
}

document.querySelector("#granulator").addEventListener("input", (e) => {
  if (!isLoaded) return
  granulator.update(e.target.valueAsNumber)
})

// MARK: SFX

const audioBuffers = []
let isSFXLoaded = false
function preloadSFX() {
  const appPath =
    decodeURI(new URL("./", import.meta.url).pathname.slice(0, -1)) + "/sfx/"
  const soundFiles = fileIndex.readDir(appPath, { absolute: true })
  const loadPromises = soundFiles.map((file, index) =>
    fetch(file)
      .then((response) => response.arrayBuffer())
      .then((data) => audioContext.decodeAudioData(data))
      .then((buffer) => {
        audioBuffers[index] = buffer
      })
      .catch((err) =>
        console.error(`Erreur lors du chargement du fichier ${file} :`, err),
      ),
  )
  Promise.all(loadPromises).then(() => {
    isSFXLoaded = true
  })
  document.querySelector("#sfx").addEventListener("wheel", (e) => {
    sfxIndex = e.deltaY > 0 ? sfxIndex + 1 : sfxIndex - 1
    sfxIndex = (sfxIndex + soundFiles.length) % soundFiles.length
    const label = document.querySelector("#sfxLabel")
    const fileName = soundFiles[sfxIndex].split("/").pop().split(".")[0]
    label.textContent = fileName
  })
  return Promise.all(loadPromises)
}

function playSound(index) {
  if (!isSFXLoaded) return

  if (audioBuffers[index]) {
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffers[index]
    source.connect(equalizer)
    source.start()
  }
}

let sfxIndex = 0
document.querySelector("#sfx").addEventListener("mousedown", () => {
  if (!isLoaded) return
  playSound(sfxIndex)
})

document.querySelector(".sfxButtons").addEventListener("pointerdown", (e) => {
  if (!isLoaded) return
  const button = e.target.closest("button")
  if (button.dataset.index) playSound(button.dataset.index)
  else {
    parent.sys42.toast(
      "On pourrai potentiellement charger d'autre samples avec ce bouton",
    )
  }
})

// MARK: Crossfader

const sendA = document.querySelector("#sendA")
const sendB = document.querySelector("#sendB")

const crossfader = /** @type {HTMLInputElement} */ (
  document.querySelector("#crossfader")
)

const crossfaderChannel = new BroadcastChannel("crossfader")

crossfaderChannel.onmessage = ({ data }) => {
  crossfader.valueAsNumber = data
}

crossfader.valueAsNumber = mixer.crossfaderValue
crossfader.addEventListener("input", () => {
  crossfaderChannel.postMessage(crossfader.valueAsNumber)
})

const track = await app.getAudioTrack()

sendA.addEventListener("click", () => track.toggleXFadeChannel("A"))
sendB.addEventListener("click", () => track.toggleXFadeChannel("B"))

const setXfadeChannel = (channel) => {
  if (channel === "A") {
    sendA.ariaPressed = "true"
    sendB.ariaPressed = "false"
  } else if (channel === "B") {
    sendA.ariaPressed = "false"
    sendB.ariaPressed = "true"
  } else {
    sendA.ariaPressed = "false"
    sendB.ariaPressed = "false"
  }
}

track.on("xfadeChannelChange", setXfadeChannel)
setXfadeChannel(track.xfadeChannel)
