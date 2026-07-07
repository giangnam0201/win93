import Pool from "../core/Pool.js"
import { uid } from "../chance.js"

const PROP_BLACKLIST = [
  "alpha",
  "canvas",
  "image",
  "color",
  "font",
  "fill",
  "display",
  "childs",
  "center",
  "width",
  "height",
  "shift",
]

const patternsCache = new WeakMap()

export default class Visual {
  constructor(options = {}) {
    this.options = options
    this.setup(options)
  }

  config() {
    return Object.entries(this.options).reduce((acc, [key, val]) => {
      if (!PROP_BLACKLIST.includes(key)) acc[key] = val
      return acc
    }, {})
  }

  setup(options) {
    const config = this.config()

    if (options.canvas) {
      this.canvas = options.canvas
    } else {
      this.canvas = document.createElement("canvas")
      if (options.width) this.canvas.width = options.width
      if (options.height) this.canvas.height = options.height
    }

    this.ctx = this.canvas.getContext("2d", { alpha: options.alpha !== false })
    if (!this.options.smoothing) this.ctx.imageSmoothingEnabled = false

    if (options.color) this.color = options.color
    if (options.font) this.font = options.font

    Object.assign(this, config)

    if (!this.name) this.name = uid()

    this.w = this.canvas.width
    this.h = this.canvas.height

    this.auto()
    if (this.options.center && this.center) this.center()
  }

  auto() {
    if (this.options.fill && !this.options.text) this.fill()
    if (this.options.image) this.ctx.drawImage(this.options.image, 0, 0)
  }

  get el() {
    return this.canvas
  }

  set color(val) {
    this.setColor(val)
  }
  get color() {
    return this.ctx.fillStyle
  }
  setColor(val = this.ctx.fillStyle) {
    this.ctx.fillStyle = val
    return this
  }

  save() {
    this.tmp = { fillStyle: this.ctx.fillStyle }
  }
  restore() {
    Object.assign(this.ctx, this.tmp)
    this.auto()
  }

  set width(val) {
    this.setWidth(val)
  }
  get width() {
    return this.w
  }
  setWidth(val) {
    this.save()
    this.canvas.width = Math.max(1, (this.w = val))
    this.restore()
    return this
  }

  set height(val) {
    this.setHeight(val)
  }
  get height() {
    return this.w
  }
  setHeight(val) {
    this.save()
    this.canvas.height = Math.max(1, (this.h = val))
    this.restore()
    return this
  }

  reset() {
    this.clear()
    this.ctx.globalCompositeOperation = "source-over"
    return this
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (!this.options.smoothing) this.ctx.imageSmoothingEnabled = false
    return this
  }

  fill(w = this.w, h = this.h) {
    this.ctx.fillRect(0, 0, w, h)
    // this.ctx.fill();
    return this
  }

  rect(x, y, w = this.w, h = this.h) {
    this.ctx.fillRect(x, y, w, h)
    return this
  }

  pixel(x, y) {
    this.ctx.fillRect(x, y, 1, 1)
    return this
  }

  draw(img, x = 0, y = 0) {
    this.ctx.drawImage(img, x, y)
    return this
  }

  shift(img, x = 0, y = 0, nocache) {
    let pattern
    if (img instanceof CanvasPattern) {
      pattern = img
    } else if (nocache !== true && patternsCache.has(img)) {
      pattern = patternsCache.get(img)
    } else {
      const clone = this.clone()
      clone.clear().draw(img)
      pattern = this.ctx.createPattern(clone.canvas, "repeat")
      clone.recycle()
      patternsCache.set(img, pattern)
    }
    this.ctx.save()
    this.ctx.fillStyle = pattern
    this.ctx.translate(x, y)
    this.ctx.fillRect(-x, -y, this.w, this.h)
    this.ctx.restore()
    return this
  }

  // bresenham line
  // https://github.com/madbence/node-bresenham/blob/master/LICENSE

  line(x0, y0, x1, y1, size = 1) {
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
        this.ctx.fillRect(x, y, size, size)
        eps += ady
        if (eps << 1 >= adx) {
          y += sy
          eps -= adx
        }
      }
    } else {
      for (; sy < 0 ? y >= y1 : y <= y1; y += sy) {
        this.ctx.fillRect(x, y, size, size)
        eps += adx
        if (eps << 1 >= ady) {
          x += sx
          eps -= ady
        }
      }
    }
    return this
  }

  toPattern() {
    let pattern
    if (patternsCache.has(this)) {
      pattern = patternsCache.get(this)
    } else {
      pattern = this.ctx.createPattern(this.canvas, "repeat")
      patternsCache.set(this, pattern)
    }
    return pattern
  }

  clone() {
    const c = clone(this.canvas)
    // c.ctx.globalCompositeOperation = this.ctx.globalCompositeOperation;
    // c.ctx.globalAlpha = this.ctx.globalAlpha;
    return c
  }

  recycle() {
    Visual.pool.recycle(this)
    return this
  }

  static clone(canvas) {
    return clone(canvas)
  }
}

Visual.pool = new Pool(Visual)

export const clone = (img) => {
  const a = Visual.pool.get()
  a.canvas.width = img.width
  a.canvas.height = img.height
  a.ctx.drawImage(img, 0, 0)
  return a
}
