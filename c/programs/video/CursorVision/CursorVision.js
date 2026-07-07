/*
  Created by Jankenpopp
*/

import { loadScript } from "../../../../42/api/load/loadScript.js"
import { alert } from "../../../../42/ui/layout/dialog.js"
import { webcam } from "../../../../42/api/env/device/webcam.js"

const icon = new URL("./illustration.gif", import.meta.url).href

const cursorEl = new Image()
cursorEl.src = new URL("./img/arrow.png", import.meta.url).href

let size = 1
let threshold = 20
let framesVisible = 10

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  const { signal } = app

  const cursorVision = document.createElement("canvas")
  cursorVision.style.position = "absolute"
  cursorVision.style.zIndex = "1000000"
  cursorVision.style.top = "0"
  cursorVision.style.left = "0"
  cursorVision.style.pointerEvents = "none"
  cursorVision.width = window.innerWidth
  cursorVision.height = window.innerHeight
  const ctx = cursorVision.getContext("2d")
  ctx.imageSmoothingEnabled = false

  const video = document.createElement("video")
  video.width = 640
  video.height = 480
  const canvasOutput = document.createElement("canvas")
  const ctxOutput = canvasOutput.getContext("2d", { willReadFrequently: true })

  let started = false
  let mouseDown = false

  let rafId

  async function start(options) {
    if (started) {
      app.dialogEl.close()
      return
    }

    started = true
    const agreeEl = app.dialogEl.querySelector("button.ui-dialog__agree")
    const declineEl = app.dialogEl.querySelector("button.ui-dialog__decline")

    declineEl.disabled = true
    agreeEl.disabled = true
    agreeEl.textContent = "Loading..."

    await loadScript(new URL("./js/opencv.js", import.meta.url))

    cursorEl.src = new URL("./img/" + cursorsEl.value, import.meta.url).href
    size = sizesEl.value
    threshold = thresholdsEl.value
    framesVisible = framesVisiblesEl.value

    try {
      const stream = await webcam.request()
      video.srcObject = stream
      video.play()
      processVideo()
    } catch (err) {
      if (err.name === "NotFoundError") {
        alert("Webcam not found", { icon: "error" })
      } else alert(err)

      app.dialogEl.close()
      return
    }

    declineEl.disabled = false
    agreeEl.disabled = false
    agreeEl.textContent = "Stop"

    if (options?.minimize) app.dialogEl.minimize()
  }

  function processVideo() {
    const src = new cv.Mat(video.height, video.width, cv.CV_8UC4)
    const gray = new cv.Mat()
    let grayPrev = new cv.Mat()
    const diff = new cv.Mat()
    const binarized = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    let firstFrame = true
    let blobs = []

    function captureFrame() {
      if (signal.aborted) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctxOutput.drawImage(video, 0, 0, video.width, video.height)
        const imageData = ctxOutput.getImageData(
          0,
          0,
          video.width,
          video.height,
        )
        src.data.set(imageData.data)
        cv.flip(src, src, 1)
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
        if (firstFrame) {
          grayPrev = gray.clone()
          firstFrame = false
          rafId = requestAnimationFrame(captureFrame)
          return
        }

        cv.absdiff(gray, grayPrev, diff)
        cv.threshold(diff, binarized, 25, 255, cv.THRESH_BINARY)
        cv.findContours(
          binarized,
          contours,
          hierarchy,
          cv.RETR_CCOMP,
          cv.CHAIN_APPROX_SIMPLE,
        )
        for (let i = 0; i < contours.size(); ++i) {
          const rect = cv.boundingRect(contours.get(i))
          let blobExists = false
          for (let j = 0; j < blobs.length; j++) {
            const blob = blobs[j]
            const dx = blob.x - rect.x
            const dy = blob.y - rect.y
            const distance = Math.hypot(dx, dy)

            if (distance < threshold) {
              blob.x = rect.x
              blob.y = rect.y
              blob.framesVisible = 10
              blobExists = true
              break
            }
          }

          if (!blobExists) {
            blobs.push({ x: rect.x, y: rect.y, framesVisible })
          }
        }

        if (!mouseDown) {
          ctx.clearRect(0, 0, cursorVision.width, cursorVision.height)
        }

        const divider = video.width

        const width = cursorEl.width * size
        const height = cursorEl.height * size
        const soustracter = width / 2

        for (const blob of blobs) {
          if (blob.framesVisible > 0) {
            blob.x += Math.random() * 5 - 3
            blob.y += Math.random() * 5 - 3

            const x = Math.round(
              (blob.x / divider) * cursorVision.width - soustracter,
            )
            const y = Math.round(
              (blob.y / divider) * cursorVision.width - soustracter,
            )

            ctx.drawImage(cursorEl, x, y, width, height)

            blob.framesVisible--
          }
        }

        cv.imshow(canvasOutput, src)
        grayPrev.delete()
        grayPrev = gray.clone()
        blobs = blobs.filter((blob) => blob.framesVisible > 0)
      }

      rafId = requestAnimationFrame(captureFrame)
    }

    rafId = requestAnimationFrame(captureFrame)
  }

  const cursorsEl = document.createElement("select")
  cursorsEl.append(
    new Option("arrow.png"),
    new Option("cd.png"),
    new Option("hand.png"),
    new Option("help.png"),
    new Option("hourglass.png"),
    new Option("move.png"),
    new Option("no.png"),
    new Option("finger.png"),
    new Option("metal.png"),
    new Option("osxHandpointing.png"),
    new Option("Link Select.cur"),
    new Option("macOS/Help Select.cur"),
    new Option("macOS/Location Select.cur"),
    new Option("macOS/Normal Select.cur"),
    new Option("macOS/Move.cur"),
    new Option("macOS/zoomin.png"),
    new Option("macOS/zoomout.png"),
    new Option("macOS/beachball.png"),
    new Option("Amiga/arrow.cur"),
    new Option("Amiga/busy.cur"),
    new Option("Atari/busy.cur"),
  )
  cursorsEl.oninput = () => {
    cursorEl.src = new URL("./img/" + cursorsEl.value, import.meta.url).href
  }

  const sizesEl = document.createElement("select")
  sizesEl.append(
    new Option("1"),
    new Option("2"),
    new Option("3"),
    new Option("4"),
    new Option("5"),
    new Option("6"),
    new Option("7"),
    new Option("8"),
    new Option("9"),
    new Option("10"),
  )
  sizesEl.oninput = () => {
    size = sizesEl.value
  }

  sizesEl.value = size

  const thresholdsEl = document.createElement("select")
  thresholdsEl.append(
    new Option("10"), //
    new Option("15"),
    new Option("20"),
  )
  thresholdsEl.oninput = () => {
    threshold = thresholdsEl.value
  }

  thresholdsEl.value = threshold

  const framesVisiblesEl = document.createElement("select")
  framesVisiblesEl.append(
    new Option("5"),
    new Option("10"),
    new Option("15"),
    new Option("20"),
    new Option("30"),
  )
  framesVisiblesEl.oninput = () => {
    framesVisible = framesVisiblesEl.value
  }

  framesVisiblesEl.value = framesVisible

  async function cursorSetup() {
    let hasWebcam = await webcam.check()

    cursorsEl.style.width = "100%"
    sizesEl.style.width = "100%"
    thresholdsEl.style.width = "100%"
    framesVisiblesEl.style.width = "100%"

    cursorsEl.style.marginBottom = "4px"
    sizesEl.style.marginBottom = "4px"
    thresholdsEl.style.marginBottom = "4px"
    framesVisiblesEl.style.marginBottom = "4px"

    await alert(
      [
        { tag: "strong", content: "Setup Wizard" },
        {
          // tag: "fieldset._aligned",
          // role: "none",
          tag: "div",
          content: [
            { tag: "label.txt-left", content: "Cursor:" },
            cursorsEl,
            { tag: "label.txt-left", content: "Size:" },
            sizesEl,
            { tag: "label.txt-left", content: "Threshold:" },
            thresholdsEl,
            { tag: "label.txt-left", content: "Frames alive:" },
            framesVisiblesEl,
          ],
        },
      ],
      {
        dialog: {
          picto: app.getIcon("16x16"),
          minimizable: true,
          dockable: true,
          // dataset: {
          //   dockable: true,
          // },
          style: {
            position: "absolute",
            width: "180px",
          },
          on: {
            "ui:dialog.open": (e, dialogEl) => {
              app.dialogEl = dialogEl
              app.dialogEl.before(cursorVision)
              cursorVision.style.zIndex = app.dialogEl.style.zIndex
            },
            "ui:dialog.close": () => {
              app.destroy()
            },
            "ui:dialog.activate": () => {
              cursorVision.style.zIndex = app.dialogEl.style.zIndex
            },
          },
        },
        label: "CursorVision",
        img: icon,
        afterContent: hasWebcam
          ? undefined
          : {
              tag: ".message.negative",
              content: [
                "This program needs a webcam, but none has been detected.",
                {
                  tag: ".txt-center.ma-y-xs",
                  content: {
                    tag: "button",
                    content: "Recheck",
                    onclick: async () => {
                      hasWebcam = await webcam.check()
                      if (hasWebcam) {
                        app.dialogEl
                          .querySelector(".message")
                          .replaceWith(document.createElement("br"))
                        const agreeEl = app.dialogEl.querySelector(
                          "button.ui-dialog__agree",
                        )
                        const declineEl = app.dialogEl.querySelector(
                          "button.ui-dialog__decline",
                        )
                        agreeEl.disabled = false
                        declineEl.disabled = false
                      }
                    },
                  },
                },
              ],
            },
        decline: {
          content: "Apply",
          disabled: !hasWebcam,
          onclick: () => {
            if (started) app.dialogEl.minimize()
            else start({ minimize: true })
          },
        },
        agree: {
          disabled: !hasWebcam,
          content: "Start",
          onclick: () => {
            start()
          },
        },
      },
    )
  }

  window.addEventListener("pointerdown", () => {
    mouseDown = true
  })

  window.addEventListener("pointerup", () => {
    mouseDown = false
  })

  window.addEventListener(
    "resize",
    () => {
      cursorVision.width = window.innerWidth
      cursorVision.height = window.innerHeight
    },
    { signal },
  )

  signal.addEventListener("abort", () => {
    cancelAnimationFrame(rafId)
    cursorVision.remove()
    video.pause()
    if (!video.srcObject) return
    for (const track of video.srcObject.getTracks()) track.stop()
  })

  // document.documentElement.append(cursorVision)

  cursorSetup()
}
