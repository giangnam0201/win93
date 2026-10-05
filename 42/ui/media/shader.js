import { Component } from "../../api/gui/Component.js"
import { loadText } from "../../api/load/loadText.js"
import { Scene } from "../../lib/graphic/Scene.js"
import { Shader } from "../../lib/graphic/webgl/Shader.js"
import { watchResize } from "../../lib/type/element/watchResize.js"

export class ShaderComponent extends Component {
  static plan = {
    tag: "ui-shader",
    props: {
      src: true,
      srcdoc: true,
    },
  }

  #uniforms
  get uniforms() {
    return this.shader?.uniforms ?? this.#uniforms
  }
  set uniforms(value) {
    this.#uniforms = value
  }

  get src() {
    return this.getAttribute("src")
  }
  set src(value) {
    this.setAttribute("src", value)
  }

  get srcdoc() {
    return this.getAttribute("srcdoc")
  }
  set srcdoc(value) {
    this.setAttribute("srcdoc", value)
  }

  get autoplay() {
    return this.hasAttribute("autoplay")
  }
  set autoplay(value) {
    this.toggleAttribute("autoplay", value)
  }

  resetTime() {
    this.shader?.resetTime()
  }

  resetMouse() {
    this.shader?.resetMouse()
  }

  #setSource(fragment) {
    try {
      if (this.shader) this.shader.compile(fragment)
      else {
        this.shader = new Shader(this.scene.context, fragment, {
          autoplay: this.autoplay,
          uniforms: this.#uniforms,
        })
      }

      this.messageEl.textContent = ""
    } catch (err) {
      if (err.name === "WebglProgramError") {
        this.messageEl.textContent = err.message
      } else {
        throw err
      }
    }
  }

  async updated(key, val) {
    switch (key) {
      case "src": {
        if (!val) return this.#setSource("")
        // @ts-ignore
        const { sys42 } = window
        const indexOfQuery = val.lastIndexOf("?")
        if (indexOfQuery !== -1) val = val.slice(0, indexOfQuery)
        this.#setSource(
          await (sys42?.load ? sys42.load.text(val) : loadText(val)),
        )
        break
      }

      case "srcdoc":
        this.#setSource(val)
        break

      default:
        break
    }
  }

  render() {
    this.messageEl = document.createElement("div")
    this.messageEl.style.maxHeight = "calc(4lh + (var(--pa-x) * 2))"
    this.messageEl.style.minHeight = "auto"
    this.messageEl.className =
      "ui-shader__message message negative txt-pre-wrap scroll-y-auto"

    this.scene = new Scene({ type: "webgl2" })

    if (this.src) this.updated("src", this.src)
    else if (this.srcdoc) this.updated("srcdoc", this.srcdoc)

    return [this.scene.canvas, this.messageEl]
  }

  created() {
    const { signal } = this
    watchResize(this, { signal, firstCall: true }, ({ width, height }) => {
      this.scene.setSize(width, height)
      this.shader?.setSize(width, height)
    })

    let mousePosX = 0
    let mousePosY = 0
    let mouseOriX = 0
    let mouseOriY = 0

    this.scene.canvas.addEventListener(
      "pointerdown",
      (e) => {
        mousePosX = e.offsetX
        mousePosY = this.scene.height - e.offsetY
        mouseOriX = mousePosX
        mouseOriY = mousePosY
        if (!this.shader) return
        this.shader.uniforms.iMouse.value = [
          mousePosX,
          mousePosY,
          mouseOriX,
          mouseOriY,
        ]
      },
      { signal },
    )

    this.scene.canvas.addEventListener(
      "pointermove",
      (e) => {
        if (e.buttons) {
          mousePosX = e.offsetX
          mousePosY = this.scene.height - e.offsetY
          if (!this.shader) return
          this.shader.uniforms.iMouse.value = [
            mousePosX,
            mousePosY,
            mouseOriX,
            mouseOriY,
          ]
        }
      },
      { signal },
    )
  }

  destroyed() {
    this.shader?.destroy?.()
    this.shader = undefined
  }
}

export const shader = Component.define(ShaderComponent)
