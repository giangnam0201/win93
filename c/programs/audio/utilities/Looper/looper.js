import { mixer } from "/42/lib/audio/mixer.js"
import { LooperNode } from "./LooperNode.js"

const FADE_SECONDS = 0.01

function applyEdgeFade(data, sampleRate) {
  const fadeSamples = Math.min(
    Math.floor(FADE_SECONDS * sampleRate),
    Math.floor(data.length / 2),
  )
  for (let i = 0; i < fadeSamples; i++) {
    const gain = i / fadeSamples
    data[i] *= gain
    data[data.length - 1 - i] *= gain
  }
}

function toBuffer(data, sampleRate) {
  const buffer = new AudioBuffer({
    length: data.length,
    numberOfChannels: 1,
    sampleRate,
  })
  buffer.copyToChannel(data, 0)
  return buffer
}

const STATUS_LABELS = {
  empty: "Empty",
  recording: "Recording…",
  looping: "Looping",
  overdubbing: "Overdubbing…",
  stopped: "Stopped",
}

export async function renderApp(app) {
  const { signal } = app
  const { context } = mixer

  const inputGain = new GainNode(context)
  app.audioPipe = inputGain

  await LooperNode.load(context)
  const looperNode = new LooperNode(context, { parameterData: { signal } })

  function attachCaptureSource(inp) {
    inp.connect(looperNode)
  }
  function detachCaptureSource(inp) {
    inp.disconnect(looperNode)
  }
  for (const inp of app.audioInputs) attachCaptureSource(inp)
  app.audioInputs.on("add", { signal }, attachCaptureSource)
  app.audioInputs.on("delete", { signal }, detachCaptureSource)

  const playbackGain = new GainNode(context)

  function updatePlaybackDestination() {
    playbackGain.disconnect()
    const usingMain = [...app.audioInputs].some((inp) => inp.isMainTrack)
    playbackGain.connect(usingMain ? mixer.mainTrack : app.track)
  }
  updatePlaybackDestination()
  app.audioInputs.on("change", { signal }, updatePlaybackDestination)

  let state = "empty"
  let loopBuffer = null
  let sourceNode = null
  let loopStartTime = 0
  let overdubActive = false
  let generation = 0

  let recBtn
  let playBtn
  let clearBtn
  let statusEl

  function updateUi() {
    if (recBtn) {
      recBtn.ariaPressed = state === "recording" || state === "overdubbing"
    }
    if (playBtn) {
      playBtn.ariaPressed = state === "looping" || state === "overdubbing"
      playBtn.disabled = !loopBuffer
    }
    if (clearBtn) clearBtn.disabled = !loopBuffer && state !== "recording"
    if (statusEl) statusEl.textContent = STATUS_LABELS[state]
  }

  function startLoop(buffer, startAt) {
    sourceNode = new AudioBufferSourceNode(context, { buffer, loop: true })
    sourceNode.connect(playbackGain)
    sourceNode.start(startAt)
    loopBuffer = buffer
    loopStartTime = startAt
  }

  function swapToBuffer(newBuffer, swapAt) {
    const loopDuration = loopBuffer.duration
    let swapOffsetSeconds = (swapAt - loopStartTime) % loopDuration
    if (swapOffsetSeconds < 0) swapOffsetSeconds += loopDuration

    const oldSource = sourceNode
    const newSource = new AudioBufferSourceNode(context, {
      buffer: newBuffer,
      loop: true,
    })
    newSource.connect(playbackGain)
    newSource.start(swapAt, swapOffsetSeconds)
    oldSource.stop(swapAt)

    sourceNode = newSource
    loopBuffer = newBuffer
    loopStartTime = swapAt - swapOffsetSeconds
  }

  function mergeIntoLoop(recorded, startTime, swapAt) {
    const oldData = loopBuffer.getChannelData(0)
    const newData = oldData.slice()
    const loopDuration = loopBuffer.duration

    let offsetSeconds = (startTime - loopStartTime) % loopDuration
    if (offsetSeconds < 0) offsetSeconds += loopDuration
    const mixOffset = Math.round(offsetSeconds * context.sampleRate)

    for (let i = 0; i < recorded.length; i++) {
      const idx = (mixOffset + i) % newData.length
      newData[idx] = Math.max(-1, Math.min(1, newData[idx] + recorded[i]))
    }
    applyEdgeFade(newData, context.sampleRate)

    swapToBuffer(toBuffer(newData, context.sampleRate), swapAt)
  }

  async function finishFirstRecording(myGeneration) {
    const { recorded } = await looperNode.stopRecording()
    if (myGeneration !== generation) return
    if (recorded.length === 0) {
      state = "empty"
      updateUi()
      return
    }
    applyEdgeFade(recorded, context.sampleRate)
    state = "looping"
    startLoop(toBuffer(recorded, context.sampleRate), context.currentTime)
    updateUi()
  }

  function scheduleOverdubCycle(myGeneration) {
    const loopDuration = loopBuffer.duration
    const now = context.currentTime
    const cyclesElapsed = Math.max(
      1,
      Math.ceil((now - loopStartTime) / loopDuration),
    )
    const cycleEndAt = loopStartTime + cyclesElapsed * loopDuration

    looperNode.startRecording(false, cycleEndAt)
    looperNode.waitForRecording().then(({ recorded, startTime }) => {
      if (myGeneration !== generation) return
      if (recorded.length > 0) mergeIntoLoop(recorded, startTime, cycleEndAt)

      if (overdubActive) {
        scheduleOverdubCycle(myGeneration)
      } else {
        state = "looping"
        updateUi()
      }
    })
  }

  async function stopOverdubNow(myGeneration) {
    const { recorded, startTime } = await looperNode.stopRecording()
    if (myGeneration !== generation) return
    if (recorded.length > 0) {
      mergeIntoLoop(recorded, startTime, context.currentTime)
    }
    state = "looping"
    updateUi()
  }

  function onRecClick() {
    if (state === "empty") {
      state = "recording"
      looperNode.startRecording(true)
      updateUi()
    } else if (state === "recording") {
      finishFirstRecording(generation)
    } else if (state === "looping") {
      state = "overdubbing"
      overdubActive = true
      updateUi()
      scheduleOverdubCycle(generation)
    } else if (state === "overdubbing") {
      overdubActive = false
      stopOverdubNow(generation)
    }
  }

  function onPlayClick() {
    if (!loopBuffer) return
    if (state === "stopped") {
      state = "looping"
      startLoop(loopBuffer, context.currentTime)
      updateUi()
    } else if (state === "looping" || state === "overdubbing") {
      overdubActive = false
      looperNode.stopRecording().catch(() => {})
      sourceNode?.stop()
      sourceNode = null
      state = "stopped"
      updateUi()
    }
  }

  function onClearClick() {
    if (state === "recording") {
      looperNode.clearRecording()
      return
    }
    if (state === "overdubbing") {
      swapToBuffer(
        new AudioBuffer({
          length: loopBuffer.length,
          numberOfChannels: 1,
          sampleRate: context.sampleRate,
        }),
        context.currentTime,
      )
      return
    }
    generation++
    overdubActive = false
    looperNode.stopRecording().catch(() => {})
    sourceNode?.stop()
    sourceNode = null
    loopBuffer = null
    state = "empty"
    updateUi()
  }

  signal.addEventListener("abort", () => {
    sourceNode?.stop()
    looperNode.destroy()
  })

  return {
    tag: "#looper.rows.pa-sm.gap-xs",
    content: [
      {
        tag: ".cols.gap-xs",
        content: [
          {
            tag: "button.grow",
            picto: "mic",
            content: "Rec",
            aria: { pressed: false },
            created: (el) => (recBtn = el),
            on: { click: onRecClick },
          },
          {
            tag: "button.grow",
            picto: "play",
            content: "Play / Stop",
            aria: { pressed: false },
            disabled: true,
            created: (el) => (playBtn = el),
            on: { click: onPlayClick },
          },
          {
            tag: "button.grow",
            picto: "trash",
            content: "Clear",
            disabled: true,
            created: (el) => (clearBtn = el),
            on: { click: onClearClick },
          },
        ],
      },
      {
        tag: ".ta-center.pa-xs.inset.screen",
        created: (el) => (statusEl = el),
        content: STATUS_LABELS.empty,
      },
    ],
  }
}
