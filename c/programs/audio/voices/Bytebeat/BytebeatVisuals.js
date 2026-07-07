import { compileBytebeat } from "../../../../../42/lib/audio/generator/ByteBeat/compileBytebeat.js"
import { Shader } from "../../../../../42/lib/graphic/webgl/Shader.js"
import { debounce } from "../../../../../42/lib/timing/debounce.js"
import { watchResize } from "../../../../../42/lib/type/element/watchResize.js"

const frag = await (await fetch("./visuals/diagram.glsl")).text()

/** @import {BytebeatApp} from "./bytebeatApp.js" */

const emptyGenerator = () => 0

function normalizeMode(mode = "bytebeat") {
  return mode.toLowerCase()
}

export class BytebeatVisuals {
  paused = true
  displayMode = "both"

  /** @type {Function} */
  generator = emptyGenerator

  /**
   * @param {BytebeatApp} app
   */
  constructor(app) {
    this.app = app
    this.displayMode = app.visualMode ?? "both"

    /** @type {CanvasRenderingContext2D} */
    this.wave = this.app.canvas2d.getContext("2d")

    this.section = 0
    this.sectionWorker = new Worker("./visuals/diagram.w.js", {
      type: "module",
    })
    this.sectionWorker.onmessage = ({ data }) => {
      if (data.section === this.section) this.section1 = data
      else if (data.section === this.section + 1) this.section2 = data
      if (this.paused && this.app.byteBeatNode) this.render()
    }

    this.waveWorker = new Worker("./visuals/wave.w.js", { type: "module" })
    this.waveWorker.onmessage = () => {
      const canvas = this.app.canvasWave.transferControlToOffscreen()
      const message = new MessageChannel()
      this.waveWorkerPort = message.port1
      this.waveWorker.postMessage(
        {
          formula: this.app.formula,
          mode: this.app.mode,
          sampleRate: this.app.sampleRate,
          dataPort: message.port2,
          canvas,
        },
        [canvas, message.port2],
      )
    }

    /** @type {CanvasRenderingContext2D} */
    this.context = this.app.canvas2d.getContext("2d")

    /** @type {WebGL2RenderingContext} */
    this.gl = this.app.canvasWebgl.getContext("webgl2")
    this.shader = new Shader(this.gl)

    this.width = this.app.canvasWave.width

    this.resizeSections = debounce(() => {
      this.section1 = undefined
      this.section2 = undefined
      this.createSection(this.section)
      this.createSection(this.section + 1)
    })

    watchResize(this.app.canvasWave, { firstCall: false }, ({ width }) => {
      this.width = width
      this.app.canvasWebgl.width = width
      this.app.canvas2d.width = width

      this.waveWorkerPort?.postMessage({ width })

      if (this.isShaderDiagram) {
        this.shader.setSize(width)
      } else {
        this.resizeSections()
      }

      if (this.paused) {
        this.waveWorkerPort?.postMessage({ render: true })
        this.render()
      }
    })

    this.updateVisibility()
  }

  setDisplayMode(mode) {
    if (mode === this.displayMode) return
    this.displayMode = mode
    this.updateVisibility()
  }

  updateVisibility() {
    const showDiagram =
      this.displayMode === "both" || this.displayMode === "diagram"
    const showWave = this.displayMode === "both" || this.displayMode === "wave"
    const waveOnly = this.displayMode === "wave"

    this.app.visuEl.classList.toggle("wave-only", waveOnly)
    this.app.canvasWave.classList.toggle("invisible", !showWave)
    this.app.canvasWebgl.classList.toggle(
      "hide",
      !(showDiagram && this.isShaderDiagram),
    )
    this.app.canvas2d.classList.toggle(
      "hide",
      !(showDiagram && !this.isShaderDiagram),
    )
  }

  compile(formula, mode = this.app.mode) {
    mode = normalizeMode(mode)

    if (formula === this.formula && mode === this.mode) return

    const res = compileBytebeat(formula, {
      mode,
      sampleRate: this.app.sampleRate,
      fallback: this.generator,
    })
    if (Array.isArray(res)) {
      return res[0]
    }

    this.formula = formula
    this.mode = mode
    this.generator = res
    this.waveWorkerPort?.postMessage({
      formula,
      mode,
      sampleRate: this.app.sampleRate,
    })

    try {
      if (mode === "funcbeat") {
        throw new Error("Funcbeat cannot be rendered as a shader")
      }
      this.shader.compile(`#define FORMULA ${formula}\n\n${frag}`)
      this.isShaderDiagram = true
      this.updateVisibility()
      return
    } catch {
      this.isShaderDiagram = false
      this.updateVisibility()
    }

    this.section1 = undefined
    this.section2 = undefined
    this.createSection(this.section)
    this.createSection(this.section + 1)
  }

  createSection(section) {
    this.sectionWorker.postMessage({
      section,
      width: this.width,
      formula: this.formula,
      mode: this.mode,
      sampleRate: this.app.sampleRate,
    })
  }

  reset() {
    this.waveWorkerPort?.postMessage({
      mode: this.mode,
      sampleRate: this.app.sampleRate,
      render: true,
    })
    this.render()

    if (this.isShaderDiagram) return

    this.section1 = undefined
    this.section2 = undefined
    this.createSection(this.section)
    this.createSection(this.section + 1)
  }

  render() {
    this.t =
      (this.app.byteBeatNode.t * this.app.byteBeatNode.sampleRate.value) /
      this.app.audioContext.sampleRate

    this.app.tEl.valueAsNumber = this.app.byteBeatNode.t
    if (this.waveWorkerPort) this.waveWorker.postMessage(this.t)

    if (this.isShaderDiagram) {
      this.shader.uniforms.t.value = this.t
      this.shader.render()
      return
    }

    const x = Math.round(this.t / 256)

    this.section = Math.floor(x / this.width)

    const isCurrentSection = this.section === this.section1?.section
    const isNextSection = this.section === this.section2?.section

    if (isCurrentSection || isNextSection) {
      let sectionX
      if (this.section1?.imageData) {
        sectionX = this.section1.offset - x
        this.context.putImageData(this.section1.imageData, sectionX, 0)
      }

      if (sectionX < 0 && this.section2?.imageData) {
        sectionX += this.width
        this.context.putImageData(this.section2.imageData, sectionX, 0)
        if (sectionX < 0) {
          this.section1 = this.section2
          this.createSection(this.section + 1)
        }
      }
    }
  }

  loop() {
    this.render()
    this.rafId = requestAnimationFrame(() => this.loop())
  }

  play() {
    if (!this.paused) return
    this.paused = false
    this.loop()
    this.waveWorkerPort?.postMessage({ paused: false })
  }

  pause() {
    if (this.paused) return
    this.paused = true
    cancelAnimationFrame(this.rafId)
    this.waveWorkerPort?.postMessage({ paused: true })
  }

  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }
}
