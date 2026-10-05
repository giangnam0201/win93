// @thanks https://stackoverflow.com/a/25838151/1289275

import { repaintThrottle } from "../../timing/repaintThrottle.js"
import { Graphic } from "./Graphic.js"

export class WaveformGraphic extends Graphic {
  #pos = 0
  #zoom = 1
  scale = 1
  zoomPos = 1

  /**
   * @param {AudioBuffer} audioBuffer
   * @param {{
   *   width?: number
   *   height?: number
   *   color?: string | CanvasGradient | CanvasPattern
   *   style?: Record<string, any>
   * }} [options]
   */
  constructor(audioBuffer, options = {}) {
    options.width ??= 600 // 512
    options.height ??= 220 // 192
    options.style ??= {
      position: "static",
      pointerEvents: "auto",
    }

    super(options)
    this.color(options?.color ?? "#fff")
    this.audioBuffer = audioBuffer
    this.maxZoom = this.audioBuffer.length / this.canvas.width

    this.render = repaintThrottle(() => {
      const channel = this.audioBuffer.getChannelData(0)
      this.autoPos()
      this.renderChannel(channel.slice(this.start, this.end))
    })

    this.render()
  }

  autoPos() {
    const { length } = this.audioBuffer
    const { width } = this.canvas
    const zoomLength = length / this.#zoom
    this.zoomLength = zoomLength

    this.scale = zoomLength / length

    this.start = Math.max(0, length * this.#pos - zoomLength * this.#pos)
    this.end = Math.min(length, this.start + zoomLength)

    this.pixelPerSample = width / zoomLength
    this.beforePixel = this.start * this.pixelPerSample
    this.totalPixel = length * this.pixelPerSample
  }

  get pos() {
    return this.#pos
  }
  set pos(val) {
    if (val > 1) val = 1
    else if (val < 0) val = 0
    if (this.#pos === val) return
    this.#pos = val
    this.render()
  }

  get zoom() {
    return this.#zoom
  }
  set zoom(val) {
    if (val < 1) val = 1
    else if (val > this.maxZoom) val = this.maxZoom
    if (this.#zoom === val) return
    this.#zoom = val
    this.render()
  }

  renderChannel(channel) {
    const { width, height } = this.canvas

    const step = channel.length / width
    const amp = height / 2

    let prevX
    let prevY

    prevX = 0
    prevY = amp

    this.clear()

    for (let x = 0; x < width; x++) {
      let min = 1
      let max = -1
      for (let j = 0; j < step; j++) {
        const val = channel[j + ((x * step) | 1)]
        if (val < min) min = val
        if (val > max) max = val
      }

      const y = ((1 + min) * amp) | 1
      const h = ((max - min) * amp) | 1

      if (step < 16) {
        this.line(prevX, prevY, x, y)
        this.draw(x, y, 1, h)
        prevX = x
        prevY = y
      } else {
        this.draw(x, y, 1, h)
      }
    }
  }
}
