import { App } from "../../../../../42/api/os/App.js"
import { render } from "../../../../../42/api/gui/render.js"
import { debounce } from "../../../../../42/lib/timing/debounce.js"
import * as WebPd from "../../../../libs/webpd/1.0/webpd.js"
import { randomPatch } from "./js/randomDrone.js"
import { History } from "../../../../../42/lib/structure/History.js"
import { fadeIn, fadeOut } from "../../../../../42/lib/audio/algo/fading.js"

/** @import { NumericInput } from "../../../../../42/lib/type/element/setControlData.js" */

// @ts-ignore
const { pdfu } = window

const audioContext = await WebPd.init()

const history = new History()

let webpdNode
let gainNode

let isPaused = false
let playPauseBtn
let undoEl
let redoEl

async function runPatch(pdJson, fading = 0.15, patchUrl, options) {
  const prevWebpdNode = webpdNode
  const prevGainNode = gainNode

  const res = await WebPd.build(audioContext, pdJson, patchUrl)
  // console.log(res.metadata)

  isPaused = options?.paused ?? false
  updatePlayPause()

  webpdNode = res.webpdNode

  if (prevWebpdNode) {
    fadeOut(prevGainNode, fading * 2).then(() => {
      prevGainNode.disconnect()
      prevWebpdNode.disconnect()
      prevWebpdNode.destroy()
    })
  }

  // webpdNode.port.onmessage = (e) => {
  //   console.log(e)
  // }

  gainNode = new GainNode(audioContext, { gain: 0 })
  const amp = new GainNode(audioContext, { gain: 0.65 })
  webpdNode //
    .connect(gainNode)
    .connect(amp)
    .connect(audioContext.destination)

  if (!isPaused) await fadeIn(gainNode, fading)
}

function updatePlayPause() {
  if (isPaused) {
    playPauseBtn.title = "Fade in"
    playPauseBtn.firstChild.value = "play"
  } else {
    playPauseBtn.title = "Fade out"
    playPauseBtn.firstChild.value = "pause"
  }
}

function updateUndoRedo() {
  undoEl.disabled = !history.canUndo()
  redoEl.disabled = !history.canRedo()
}

function randomize(options) {
  const patchStr = pdfu.renderPd(randomPatch(workspaceEl))
  history.add(patchStr)
  updateUndoRedo()
  playPatch(patchStr, fadingEl.valueAsNumber, undefined, options)
}

async function playPatch(patchStr, fading, patchUrl = "noop.pd", options) {
  textareaEl.value = patchStr
  const pdJson = WebPd.parse(patchStr)
  viewEl.innerHTML = pdfu.renderSvg(pdfu.parse(patchStr), { svgFile: false })
  return runPatch(pdJson, fading, patchUrl, options)
}

/** @type {NumericInput} */
let fadingEl
/** @type {HTMLTextAreaElement} */
let textareaEl
let workspaceEl
let viewEl
let asideEl

const plan = {
  tag: ".rows.fit.gap-xxs",
  content: [
    {
      tag: ".cols.gap-xxs",
      created(el) {
        workspaceEl = el
      },
      content: [
        {
          id: "view",
          class: "inset center-content font-mono selection-false",
          created(el) {
            viewEl = el
          },
        },
        {
          tag: "aside.hide",
          content: {
            tag: "textarea.font-mono",
            oninput: debounce(({ target }) => {
              playPatch(target.value)
            }),
            created(el) {
              textareaEl = el
            },
          },
          created(el) {
            asideEl = el
          },
        },
      ],
    },
    {
      tag: ".cols.shrink",
      content: [
        {
          tag: "button",
          title: "Fade out",
          picto: "pause",
          created(el) {
            playPauseBtn = el
          },
          action: () => {
            if (isPaused) {
              isPaused = false
              fadeIn(gainNode, fadingEl.valueAsNumber)
            } else {
              isPaused = true
              fadeOut(gainNode, fadingEl.valueAsNumber)
            }
            updatePlayPause()
          },
        },
        {
          tag: "button",
          title: "Click to go back",
          // picto: "arrow-left",
          picto: "undo",
          disabled: true,
          created(el) {
            undoEl = el
          },
          onclick: () => {
            const str = history.undo()
            if (!str) return
            updateUndoRedo()
            playPatch(str, fadingEl.valueAsNumber)
          },
        },
        {
          tag: "button",
          title: "Click to go forward",
          // picto: "arrow-right",
          picto: "redo",
          disabled: true,
          created(el) {
            redoEl = el
          },
          onclick: () => {
            const str = history.redo()
            if (!str) return
            updateUndoRedo()
            playPatch(str, fadingEl.valueAsNumber)
          },
        },
        {
          tag: "button.grow",
          title: "Random drone",
          picto: "dice-3",
          onclick: () => randomize(),
        },
      ],
    },
    {
      tag: "#toolbar.cols.shrink.hide",
      content: [
        {
          tag: "number",
          title: "Fading (in seconds)",
          min: 0.1,
          max: 120,
          value: 5,
          step: 0.1,
          created(el) {
            fadingEl = el
          },
        },
        {
          tag: "button",
          title: "View Code",
          picto: "code",
          on: {
            click(e, target) {
              const hidden = asideEl.classList.toggle("hide")
              target.ariaPressed = !hidden
            },
          },
        },
      ],
    },
  ],
}

render(plan, document.body)

const app = new App()

app
  .on("encode", () => textareaEl.value)
  .on("decode", async (fileAgent) => {
    const { href } = new URL(fileAgent.path, import.meta.url)
    const patchStr = await fileAgent.getText()
    history.add(patchStr)
    updateUndoRedo()
    playPatch(patchStr, undefined, href)
  })
  .on("state", (state) => {
    if ("viewCode" in state) {
      asideEl.classList.toggle("hide", !state.viewCode)
    }
  })

if (!app.file) {
  // app.loadFile("/c/programs/audio/voices/Hillageizer/hillageizer.pd")
  // app.loadFile("/c/programs/audio/voices/Gremlins3/gremlins3.pd")
  // app.loadFile("/c/programs/audio/voices/Droids3/droids3.pd")
  // app.loadFile("/c/programs/audio/voices/Jazzman/Jazzman.pd")
  // app.loadFile("/c/programs/audio/voices/PukeData/examples/derp.pd")
  // playPatch(pdfu.renderPd(randomPatch(viewEl)), fadingEl.valueAsNumber)
  randomize({ paused: !app.config.play })
}
