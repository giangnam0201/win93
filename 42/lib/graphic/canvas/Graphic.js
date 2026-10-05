import { configure } from "../../../api/configure.js"
import { setStyles } from "../../type/element/setStyles.js"
import { context2DClone } from "./context2DClone.js"
import { canvasEffects } from "./canvasEffects.js"

const DEFAULTS = {
  alpha: true,
  willReadFrequently: true,
  style: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  },
}

export class Graphic {
  /**
   * @param {{
   *   alpha?: boolean
   *   width?: number
   *   height?: number
   *   style?: Record<string, any>
   * }} [options]
   */
  constructor(options) {
    this.canvas = document.createElement("canvas")

    const config = configure(DEFAULTS, options)
    const { width, height, style, ...contextOptions } = config

    this.canvas.width = width ?? globalThis.visualViewport.width
    this.canvas.height = height ?? globalThis.visualViewport.height

    setStyles(this.canvas, style)

    this.context = /** @type {CanvasRenderingContext2D} */ (
      this.canvas.getContext("2d", contextOptions)
    )
    this.context.imageSmoothingEnabled = false
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    return this
  }

  fill() {
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height)
    return this
  }

  getPixel(x, y) {
    return this.context.getImageData(x, y, 1, 1).data
  }

  /**
   * @param {string | CanvasGradient | CanvasPattern} val
   */
  color(val) {
    this.context.fillStyle = val
    return this
  }

  /**
   * @param {CanvasImageSource} image
   * @param {number} [dx]
   * @param {number} [dy]
   */
  image(image, dx = 0, dy = 0) {
    this.context.drawImage(image, dx, dy)
    return this
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [width]
   * @param {number} [height]
   */
  draw(x, y, width = 1, height = 1) {
    this.context.fillRect(x, y, width, height)
    return this
  }

  /**
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   */
  line(x0, y0, x1, y1) {
    const dx = x1 - x0
    const dy = y1 - y0
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    const sx = dx > 0 ? 1 : -1
    const sy = dy > 0 ? 1 : -1
    let eps = 0
    let x = x0
    let y = y0

    if (adx > ady) {
      for (; sx < 0 ? x >= x1 : x <= x1; x += sx) {
        this.draw(x, y, 1, 1)
        eps += ady
        if (eps << 1 >= adx) {
          y += sy
          eps -= adx
        }
      }
    } else {
      for (; sy < 0 ? y >= y1 : y <= y1; y += sy) {
        this.draw(x, y, 1, 1)
        eps += adx
        if (eps << 1 >= ady) {
          x += sx
          eps -= ady
        }
      }
    }

    return this
  }

  effect(fxName, ...args) {
    canvasEffects[fxName](this.context, ...args)
    return this
  }

  clone() {
    return context2DClone(this.context)
  }
}
