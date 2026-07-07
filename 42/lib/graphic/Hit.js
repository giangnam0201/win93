const PIXEL_RATIO = globalThis.devicePixelRatio || 1

/**
 * Hit constructor.
 * @param {object} config
 * @param {number} [config.width] - Canvas width in pixels.
 * @param {number} [config.height] - Canvas height in pixels.
 */

export class Hit {
  constructor(config) {
    if (!config) {
      config = {}
    }

    this.width = 0
    this.height = 0
    this.contextType = config.contextType || "2d"
    this.canvas = document.createElement("canvas")
    this.canvas.className = "concrete-hit-canvas"
    this.canvas.style.display = "none"
    this.canvas.style.position = "relative"
    this.context = this.canvas.getContext(this.contextType, {
      // have to add preserveDrawingBuffer so that we can pick colors with readPixels for hit detection
      preserveDrawingBuffer: true,
      // solve webgl antialiasing picking issue
      antialias: false,
    })

    // this.hitColorIndex = 0;
    // this.keyToColor = {};
    // this.colorToKey = {};
    if (config.width && config.height) {
      this.setSize(config.width, config.height)
    }
  }

  /**
   * Set hit size.
   * @param {number} width
   * @param {number} height
   * @returns {Hit}
   */
  setSize(width, height) {
    this.width = width
    this.height = height
    this.canvas.width = width * PIXEL_RATIO
    this.canvas.style.width = width + "px"
    this.canvas.height = height * PIXEL_RATIO
    this.canvas.style.height = height + "px"
    return this
  }

  /**
   * Clear hit.
   * @returns {Hit}
   */
  clear() {
    const { context } = this
    if (this.contextType === "2d") {
      // @ts-ignore
      context.clearRect(
        0,
        0,
        this.width * PIXEL_RATIO,
        this.height * PIXEL_RATIO,
      )
    }

    // webgl or webgl2
    else {
      context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT)
    }

    return this
  }

  /**
   * Get key associated to coordinate.  This can be used for mouse interactivity.
   * @param {number} x
   * @param {number} y
   * @returns {number} Integer - returns -1 if no pixel is there.
   */
  getIntersection(x, y) {
    const { context } = this
    let data

    x = Math.round(x)
    y = Math.round(y)

    // if x or y are out of bounds return -1
    if (x < 0 || y < 0 || x > this.width || y > this.height) {
      return -1
    }

    // 2d
    // if (this.contextType === "2d") {
    if (context instanceof CanvasRenderingContext2D) {
      data = context.getImageData(x, y, 1, 1).data

      if (data[3] < 255) {
        return -1
      }
    }

    // webgl
    else {
      data = new Uint8Array(4)
      context.readPixels(
        x * PIXEL_RATIO,
        (this.height - y - 1) * PIXEL_RATIO,
        1,
        1,
        context.RGBA,
        context.UNSIGNED_BYTE,
        data,
      )

      if (data[0] === 255 && data[1] === 255 && data[2] === 255) {
        return -1
      }
    }

    return this.rgbToInt(data)
  }

  /**
   * Get canvas formatted color string from data index.
   * @param {number} index
   * @returns {string}
   */
  getColorFromIndex(index) {
    const rgb = this.intToRGB(index)
    return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")"
  }

  /**
   * Converts rgb array to integer value.
   * @param {[number, number, number] | Uint8ClampedArray | Uint8Array} rgb - [r,g,b].
   * @returns {number}
   */
  rgbToInt(rgb) {
    const r = rgb[0]
    const g = rgb[1]
    const b = rgb[2]
    return (r << 16) + (g << 8) + b
  }

  /**
   * Converts integer value to rgb array.
   * @param {number} number - Positive number between 0 and 256*256*256 = 16,777,216.
   * @returns {[number, number, number]}
   */
  intToRGB(number) {
    const r = (number & 16_711_680) >> 16
    const g = (number & 65_280) >> 8
    const b = number & 255
    return [r, g, b]
  }
}
