import "../../../../../42/ui/control/code.js"
import { App } from "../../../../../42/api/os/App.js"
import { ByteBeatNode } from "../../../../../42/lib/audio/generator/ByteBeatNode.js"
import { render } from "../../../../../42/api/gui/render.js"
import { menu } from "../../../../../42/ui/layout/menu.js"
import { BytebeatVisuals } from "./BytebeatVisuals.js"
import { noop } from "../../../../../42/lib/type/function/noop.js"

let mode
let sampleRate
let visualMode

// const formula = "(t&t>>t*t/(t%10000>5000?5:12))>>4"
// const formula = "t * t >> ((t / 0.5) >> (t & 16 ? 11 : 3))"
//const formula = "(t & t>>8) - (t * 0.0000000000000000002)"
const formula = "t"

const theme = {
  variant: "dark",
  settings: {
    background: "#1e0059",
    foreground: "#a575ff",
    caret: "#ffffff",
    selection: "#fff5",
    lineHighlight: "#8a91991a",
    gutterBackground: "rgba(0, 0, 0, 0)",
    gutterForeground: "#7d6cfe",
  },
  styles: [
    { tag: "comment", color: "#7d6cfe" },
    { tag: "variableName", color: "#ffffff" },
    { tag: ["string", "special.brace"], color: "#fec806" },
    { tag: ["number", "null"], color: "#ff649a" },
    { tag: "bool", color: "#5c6166" },
    { tag: "keyword", color: "#00ff91" },
    { tag: "operator", color: "#00ff91" },
    { tag: "className", color: "#00ffee" },
    { tag: "definition.typeName", color: "#ffffff" },
    { tag: "typeName", color: "#8bfe62" },
    { tag: "angleBracket", color: "#2ed5ff" },
    { tag: "tagName", color: "#2ed5ff" },
    { tag: "attributeName", color: "#8aadff" },
  ],
}

const VISUAL_MODES = ["both", "diagram", "wave"]

const BYTEBEAT_HEADER_RE = /^\/\*!\s*({[\S\s]*?})\s*\*\/\s*/

function normalizeVisualMode(value) {
  return VISUAL_MODES.includes(value) ? value : "both"
}

function parseBytebeatHeader(text) {
  const match = text.match(BYTEBEAT_HEADER_RE)

  const metadata = { mode: "Bytebeat", sampleRate: 8000 }

  if (!match) return { formula: text, metadata }

  try {
    const json = match[1].replaceAll(
      /([,{]\s*)([$A-Z_a-z][\w$]*)(\s*:)/g,
      '$1"$2"$3',
    )

    Object.assign(metadata, JSON.parse(json))
  } catch {}

  return {
    formula: text.slice(match[0].length).trimStart(),
    metadata,
  }
}

function renderGUI(app) {
  return render({
    tag: "main.scroll-auto.rows.fit.gap-xxs",
    on: {
      "disrupt": true,
      "Ctrl+Space": () => app.togglePause(),
      "Ctrl+Enter": () => {
        app.byteBeatNode.t = 0
        app.visuals.reset()
        app.play()
      },
      "Ctrl+S": () => app.saveFileAs(),
      "Ctrl+O": () => app.openFile(),
      "Ctrl+Home": () => app.file?.adjacents.prev(),
      "Ctrl+End": () => app.file?.adjacents.next(),
    },
    content: [
      {
        tag: ".visu.inset.shrink",
        style: { minHeight: 256, boxSizing: "content-box" },
        created(el) {
          app.visuEl = el
        },
        on: {
          click: () => {
            app.cycleVisualMode()
          },
          contextmenu: (e, target) => {
            e.preventDefault()
            app.showVisualModeMenu(e, target)
          },
        },
        content: [
          { tag: "canvas#canvas2d" },
          { tag: "canvas#canvasWebgl" },
          { tag: "canvas#canvasWave" },
          {
            tag: "img.touts",
            created(el) {
              app.toutsEl = el
            },
          },
          {
            tag: ".error-display.font-mono",
            created(el) {
              app.messageEl = el
            },
          },
        ],
      },
      {
        tag: "ui-code#formula",
        lang: "javascript",
        theme,
        mode: "expression",
        options: { lineWrapping: true },
        created(el) {
          app.formulaEl = el
        },
        on: {
          input: (e, target) => {
            app.compile(target.value)
          },
        },
      },
      {
        tag: ".cols.gap-xs.shrink",
        content: [
          {
            tag: "button",
            title: "Play/Pause (Ctrl+Space)",
            picto: app.config.play || app.file ? "pause" : "play",
            created(el) {
              app.playPauseBtn = el
            },
            on: { click: () => app.togglePause() },
          },

          {
            tag: ".cols.shrink",
            content: [
              {
                tag: "button",
                title: "Prev formula (Ctrl+Home)",
                picto: "backward",
                disabled: true,
                created(el) {
                  app.prevBtn = el
                  app.currentFile?.adjacents.registerPrevButton(el)
                },
                on: { click: () => app.file?.adjacents.prev() },
              },

              {
                tag: "button",
                title: "Next formula (Ctrl+End)",
                picto: "forward",
                disabled: true,
                created(el) {
                  app.nextBtn = el
                  app.currentFile?.adjacents.registerNextButton(el)
                },
                on: { click: () => app.file?.adjacents.next() },
              },
            ],
          },

          {
            tag: "button",
            title: "Open file (Ctrl+O)",
            picto: "eject",
            on: { click: () => app.openFile() },
          },

          {
            tag: "button",
            title: "Save (Ctrl+S)",
            picto: "save",
            on: { click: () => app.saveFileAs() },
          },

          {
            tag: "number.shrink",
            title: "Bits",
            value: 8,
            min: 1,
            max: 31,
            on: {
              input: (e, target) => {
                app.byteBeatNode.bits.value = target.value
              },
            },
          },

          {
            tag: "number.shrink",
            title: "Sample rate",
            min: "8000",
            max: "192000",
            step: "any",
            value: app.sampleRate,
            // content: [
            //   8000, 11_025, 22_050, 32_000, 44_100, 48_000, 96_000, 192_000,
            // ].map(
            //   (n) =>
            //     new Option(
            //       `${(n / 1000) | 0} kHz`,
            //       String(n),
            //       undefined,
            //       n === app.sampleRate,
            //     ),
            // ),
            created(el) {
              app.sampleRateEl = el
            },
            on: {
              input: (e, target) => {
                app.setSampleRate(target.valueAsNumber)
              },
            },
          },

          {
            tag: "select.shrink",
            title: "Mode",
            content: ["Bytebeat", "Signed Bytebeat", "Floatbeat", "Funcbeat"],
            value: app.mode,
            created(el) {
              app.modeEl = el
            },
            on: {
              input: (e, target) => {
                app.setMode(target.value)
              },
            },
          },

          {
            tag: "number#t.ff-mono",
            value: 0,
          },

          {
            tag: "button",
            title: "Rewind (Ctrl+Enter)",
            picto: "arrow-stop-left",
            on: {
              click: () => {
                app.byteBeatNode.t = 0
                app.visuals.reset()
              },
            },
          },
        ],
      },
    ],
  })
}

export class BytebeatApp extends App {
  paused = true
  currentFile
  formulaEl
  prevBtn
  nextBtn
  sampleRateEl
  modeEl
  visuEl

  constructor() {
    super()

    this.audioContext = new AudioContext({
      latencyHint: "balanced",
      sampleRate: 48_000,
    })

    this.formula = "0"
    this.mode = mode ?? "bytebeat"
    this.sampleRate = sampleRate ?? 8000
    this.visualMode = normalizeVisualMode(visualMode)

    this.el = renderGUI(this)
    document.body.append(this.el)

    /** @type {HTMLInputElement} */
    this.tEl = this.el.querySelector("#t")

    /** @type {HTMLCanvasElement} */
    this.canvasWave = this.el.querySelector("#canvasWave")
    /** @type {HTMLCanvasElement} */
    this.canvas2d = this.el.querySelector("#canvas2d")
    /** @type {HTMLCanvasElement} */
    this.canvasWebgl = this.el.querySelector("#canvasWebgl")

    this.canvasWave.width = this.canvasWave.clientWidth
    this.canvasWave.height = this.canvasWave.clientHeight
    this.canvas2d.width = this.canvas2d.clientWidth
    this.canvas2d.height = this.canvas2d.clientHeight
    this.canvasWebgl.width = this.canvasWebgl.clientWidth
    this.canvasWebgl.height = this.canvasWebgl.clientHeight

    this.visuals = new BytebeatVisuals(this)
    this.visuals.setDisplayMode(this.visualMode)
    this.visuals.compile(this.formula)

    let shouldPlay = false

    this.pending = ByteBeatNode.load(this.audioContext).then(() => {
      this.byteBeatNode = new ByteBeatNode(this.audioContext, {
        formula: this.formula,
        mode: this.mode,
        sampleRate: this.sampleRate,
        gain: 0.1,
      })
      this.byteBeatNode.connect(this.audioContext.destination)
      this.byteBeatNode.on("error", (err) => this.displayError(err))

      if (this.file) {
        shouldPlay = true
      } else {
        this.setFormula(formula)
      }
    })

    this.on("decode", async (fileAgent) => {
      await this.pending
      this.currentFile = fileAgent
      if (this.prevBtn && this.nextBtn) {
        this.currentFile.adjacents.registerButtons(this.prevBtn, this.nextBtn)
      }

      const text = await fileAgent.getText()
      const { formula, metadata } = parseBytebeatHeader(text)

      this.loadBytebeat(formula, metadata)

      if (shouldPlay) {
        shouldPlay = false
        this.play()
      }
    }).on("encode", async () => {
      let { value } = app.formulaEl
      value = `/*! { sampleRate: ${app.sampleRate}, mode: "${app.mode}" } */\n${value}`
      return value
    })
  }

  #errorCnt = 0
  #errorTimeoutId
  #lastError
  async displayError(err) {
    if (err && err.message === this.#lastError) return

    clearTimeout(this.#errorTimeoutId)

    if (!err) {
      this.messageEl.textContent = ""
      this.#errorCnt = 0
      this.#lastError = undefined
      app.toutsEl.classList.remove("show")
      return
    }

    this.#errorCnt++
    this.#lastError = err.message
    this.messageEl.textContent = err.message

    if (this.#errorCnt > 4) {
      if (!app.toutsEl.src) {
        app.toutsEl.src = "./iHaveNoIdeaWahtImDoing.png"
        await app.toutsEl.decode().catch(noop)
      }

      await app.toutsEl.classList.add("show")
      this.#errorTimeoutId = setTimeout(() => {
        app.toutsEl.classList.remove("show")
      }, 4000)
      this.#errorCnt = 0
      this.#lastError = undefined
    }
  }

  setFormula(formula) {
    this.formulaEl.ready.then(() => {
      this.formulaEl.value = formula
    })
  }

  loadBytebeat(formula, metadata = {}) {
    formula ||= "0"

    const sampleRate = Number.isFinite(metadata.sampleRate)
      ? metadata.sampleRate
      : this.sampleRate
    const mode = typeof metadata.mode === "string" ? metadata.mode : this.mode

    this.sampleRate = sampleRate
    this.mode = mode

    if (this.sampleRateEl) this.sampleRateEl.valueAsNumber = sampleRate
    if (this.modeEl) this.modeEl.value = mode

    const err = this.visuals.compile(formula, mode)
    this.setFormula(formula)

    if (err) return this.displayError(err)
    this.displayError()

    this.formula = formula

    if (this.byteBeatNode) {
      this.byteBeatNode.sampleRate.value = sampleRate
      this.byteBeatNode.update({ formula, mode, t: 0 })
    }

    this.visuals.reset()
  }

  applyMetadata(metadata) {
    if (!metadata) return

    if (Number.isFinite(metadata.sampleRate)) {
      this.setSampleRate(metadata.sampleRate)
    }

    if (typeof metadata.mode === "string") {
      this.setMode(metadata.mode)
    }

    this.visuals.reset()
  }

  setVisualMode(nextVisualMode) {
    nextVisualMode = normalizeVisualMode(nextVisualMode)

    this.visualMode = nextVisualMode
    visualMode = nextVisualMode
    this.visuals?.setDisplayMode(nextVisualMode)
  }

  cycleVisualMode() {
    const currentIndex = VISUAL_MODES.indexOf(this.visualMode)
    const nextIndex = (currentIndex + 1) % VISUAL_MODES.length
    this.setVisualMode(VISUAL_MODES[nextIndex])
  }

  showVisualModeMenu(event, opener = this.visuEl) {
    return menu(
      VISUAL_MODES.map((value) => ({
        tag: "checkbox",
        label: value[0].toUpperCase() + value.slice(1),
        checked: this.visualMode === value,
        action: () => {
          this.setVisualMode(value)
        },
      })),
      { of: event, opener },
    )
  }

  setSampleRate(sampleRate) {
    if (!Number.isFinite(sampleRate)) return

    this.sampleRate = sampleRate

    if (this.sampleRateEl) this.sampleRateEl.valueAsNumber = sampleRate
    if (this.byteBeatNode) this.byteBeatNode.sampleRate.value = sampleRate

    this.visuals.reset()
  }

  setMode(mode) {
    if (typeof mode !== "string") return

    this.mode = mode

    if (this.modeEl) this.modeEl.value = mode
    if (this.byteBeatNode) this.byteBeatNode.mode = mode

    const err = this.visuals.compile(this.formula, mode)
    this.displayError(err)
  }

  compile(formula) {
    formula = formula.trim()

    if (formula === this.formula) return this.displayError()

    formula ||= "0"

    const err = this.visuals.compile(formula, this.mode)
    if (err) return this.displayError(err)
    this.displayError()

    this.formula = formula
    this.byteBeatNode.port.postMessage({ formula })
  }

  play() {
    if (!this.paused) return
    this.paused = false
    this.byteBeatNode.port.postMessage({ paused: this.paused })
    this.visuals.play()
    this.playPauseBtn.firstChild.value = "pause"
  }

  pause() {
    if (this.paused) return
    this.paused = true
    this.byteBeatNode.port.postMessage({ paused: this.paused })
    this.visuals.pause()
    this.playPauseBtn.firstChild.value = "play"
  }

  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }
}

const app = new BytebeatApp()

await app.ready

if (app.config.play) app.play()
