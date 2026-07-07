import { loadScript } from "../../../../42/api/load/loadScript.js"
import { alert } from "../../../../42/ui/layout/dialog.js"
import { webcam } from "../../../../42/api/env/device/webcam.js"
import { simulate } from "../../../../42/lib/event/simulate.js"

const icon = new URL("./img/illustration.jpg", import.meta.url).href
const clickSound = new URL("./sounds/click.mp3", import.meta.url).href

const maxHands = 2
let audioBuffer

let dialogEl

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  const { signal } = app

  const wrapper = document.createElement("div")
  wrapper.style.position = "absolute"
  wrapper.style.top = "0"
  wrapper.style.left = "0"
  wrapper.style.zIndex = "999999"
  wrapper.style.width = "100%"
  wrapper.style.pointerEvents = "none"
  wrapper.style.background = "#000"

  const video = document.createElement("video")
  video.style.width = "100%"
  video.autoplay = true
  video.playsInline = true
  video.muted = true
  video.style.position = "relative"
  video.style.top = "0"
  video.style.left = "0"
  video.style.transform = "scaleX(-1)"
  video.style.display = "none"

  const canvas = document.createElement("canvas")
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  canvas.style.width = "100%"
  canvas.style.zIndex = "999999"
  canvas.style.position = "absolute"
  canvas.style.top = "0"
  canvas.style.left = "0"

  wrapper.append(video)
  wrapper.append(canvas)
  document.body.append(wrapper)

  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  let rafId

  const isClicking = []
  const foundClickGesture = []
  const lastClientX = []
  const lastClientY = []
  const lastElements = []

  const audioContext = new AudioContext()
  async function preloadSound() {
    const res = await fetch(clickSound)
    const arrayBuffer = await res.arrayBuffer()
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  }

  function playSound() {
    if (!audioBuffer) return
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)
    source.start()
  }

  function getCorrectedClickCoordinates(avgX, avgY) {
    const canvasRect = canvas.getBoundingClientRect()
    const videoAspect = video.videoWidth / video.videoHeight
    const canvasAspect = canvasRect.width / canvasRect.height

    let offsetX = 0
    let offsetY = 0
    let scale = 1

    if (videoAspect > canvasAspect) {
      scale = canvasRect.height / video.videoHeight
      const fittedWidth = video.videoWidth * scale
      offsetX = (canvasRect.width - fittedWidth) / 2
    } else {
      scale = canvasRect.width / video.videoWidth
      const fittedHeight = video.videoHeight * scale
      offsetY = (canvasRect.height - fittedHeight) / 2
    }

    const clientX = canvasRect.left + offsetX + avgX * video.videoWidth * scale
    const clientY = canvasRect.top + offsetY + avgY * video.videoHeight * scale

    return { clientX, clientY }
  }

  function simulateClick(x, y, isDown, index) {
    const element = document.elementFromPoint(x, y)
    if (!element || element === video || element.id === "desktopFolder") return

    if (isDown) {
      simulate(element, "pointerdown")
      simulate(element, "touchstart")
      simulate(element, "mousedown")
      simulate(element, "focus")
    //} else if (element === lastElements[index]) {
    } else {
      playSound()
      simulate(element, "pointerup")
      simulate(element, "touchend")
      simulate(element, "mouseup")
      simulate(element, "click")
    }
    // lastElements[index] = element
  }

  async function setup() {
    await Promise.all([
      loadScript(new URL("./js/camera_utils.js", import.meta.url)),
      loadScript(new URL("./js/drawing_utils.js", import.meta.url)),
      loadScript(new URL("./js/hands.js", import.meta.url)),
    ])
    await preloadSound()

    const stream = await webcam.request()
    video.srcObject = stream
    await video.play()

    const hands = new Hands({
      locateFile: (file) => new URL(`./js/${file}`, import.meta.url).href,
    })

    hands.setOptions({
      selfieMode: true,
      maxNumHands: maxHands,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    hands.onResults((results) => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (results.multiHandLandmarks) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
          const landmarks = results.multiHandLandmarks[i]
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
            color: "#0f0",
            lineWidth: 2,
          })
          drawLandmarks(ctx, landmarks, { color: "#f00", lineWidth: 1 })

          const thumbTip = landmarks[4]
          const indexTip = landmarks[8]
          const dx = thumbTip.x - indexTip.x
          const dy = thumbTip.y - indexTip.y
          const distance = Math.hypot(dx, dy)

          foundClickGesture[i] = distance < 0.05
          if (foundClickGesture[i]) {
            const avgX = (thumbTip.x + indexTip.x) / 2
            const avgY = (thumbTip.y + indexTip.y) / 2
            const { clientX, clientY } = getCorrectedClickCoordinates(
              avgX,
              avgY,
            )

            if (!isClicking[i]) {
              isClicking[i] = true
              simulateClick(clientX, clientY, true, i)
            }
            lastClientX[i] = clientX
            lastClientY[i] = clientY
          }
        }

        for (let i = 0; i < maxHands; i++) {
          if (!foundClickGesture[i] && isClicking[i]) {
            isClicking[i] = false
            simulateClick(lastClientX[i], lastClientY[i], false, i)
          }
        }
      }
    })

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video })
      },
      width: 1920,
      height: 1080,
      facingMode: "user",
    })

    camera.start()
  }

  signal.addEventListener("abort", () => {
    cancelAnimationFrame(rafId)
    video.pause()
    if (video.srcObject) {
      for (const track of video.srcObject.getTracks()) {
        track.stop()
      }
    }
    wrapper.remove()
  })

  const image = new Image()
  image.className = "inset"
  image.width = 300
  image.src = icon
  await image.decode()

  return new Promise((resolve) => {
    alert(
      {
        tag: ".rows",
        content: [
          image,
          {
            tag: ".pa.center-content-x",
            content: "Activate webcam hand detection then pinch things to click",
          },
        ],
      },
      {
        label: "Manority Report",
        picto: app.getIcon("16x16"),
        on: {
          "ui:dialog.open"(e, target) {
            dialogEl = target
            resolve(dialogEl)
          },
          "ui:dialog.close"() {
            app.destroy()
          },
        },
        dialog: {
          class: `app__${app.manifest.command}`,
          dockable: true,
          minimizable: true,
        },
        decline: {
          content: "Close",
        },
        agree: {
          content: "Activate",
          onclick: () => {
            dialogEl.minimize()
            setup()
          },
        },
      },
    )
  })
}
