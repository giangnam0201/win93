// @thanks https://github.com/Ameobea/web-synth/blob/main/src/visualizations/LineSpectrogram/LineSpectrogram.worker.ts

import { untilNextTask } from "../../../lib/timing/untilNextTask.js"

const { Transfer } = globalThis

const supportSAB = globalThis.SharedArrayBuffer !== undefined
const supportWaitAsync = typeof Atomics.waitAsync === "function"

/** @type {OffscreenCanvas} */
let canvas
/** @type {OffscreenCanvasRenderingContext2D} */
let ctx

/** @type {Int32Array<SharedArrayBuffer>} */
let frameI32

/** @type {Float32Array | Uint8Array} */
let data

let scope

const config = {}

export function setup(init) {
  canvas = init.canvas
  ctx = canvas.getContext("2d")
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

export function resize(width, height) {
  canvas.width = width
  canvas.height = height
  ctx.fillStyle = "#000"
  scope.resize()
  scope.render()

  return Transfer.void
}

export function carry(data) {
  scope.data.set(data)
  scope.render()

  return Transfer.void
}

export function configure(init) {
  Object.assign(config, init)

  h = config.fill ? canvas.height : 1

  if (!init.mode) return

  if (init.mode === "spectroscope") {
    if (supportSAB) {
      data = new Uint8Array(init.dataSAB)
      frameI32 = new Int32Array(init.frameSAB)
      loop()
    } else {
      data = new Uint8Array(init.frequencyBinCount)
    }

    scope = new Spectroscope(ctx, data)
  } else {
    if (supportSAB) {
      data = new Float32Array(init.dataSAB)
      frameI32 = new Int32Array(init.frameSAB)
      loop()
    } else {
      data = new Float32Array(init.frequencyBinCount)
    }

    scope = new Oscilloscope(ctx, data)
  }

  return Transfer.void
}

let lastFrame = -1
async function loop() {
  if (supportWaitAsync) {
    while (true) {
      await Atomics.waitAsync(frameI32, 0, lastFrame).value
      lastFrame = Atomics.load(frameI32, 0)
      scope.render()
    }
  } else {
    while (true) {
      const res = Atomics.wait(frameI32, 0, lastFrame, 8)
      await untilNextTask()
      if (res === "timed-out") continue
      lastFrame = Atomics.load(frameI32, 0)
      scope.render()
    }
  }
}

/*  */

const { abs } = Math
let h = 1

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function line(x0, y0, x1, y1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const adx = abs(dx)
  const ady = abs(dy)
  const sx = dx > 0 ? 1 : -1
  const sy = dy > 0 ? 1 : -1
  let eps = 0
  let x = x0
  let y = y0

  if (adx > ady) {
    for (; sx < 0 ? x >= x1 : x <= x1; x += sx) {
      ctx.clearRect(x, y, 1, h)
      eps += ady
      if (eps << 1 >= adx) {
        y += sy
        eps -= adx
      }
    }
  } else {
    for (; sy < 0 ? y >= y1 : y <= y1; y += sy) {
      ctx.clearRect(x, y, 1, h)
      eps += adx
      if (eps << 1 >= ady) {
        x += sx
        eps -= ady
      }
    }
  }
}

// MARK: Oscilloscope
// ------------------
class Oscilloscope {
  constructor(ctx, data) {
    this.ctx = ctx
    this.canvas = ctx.canvas
    this.data = data
    this.scale = 0.45
    this.tmp = []
    this.resize()
  }

  resize() {
    const { width } = this.canvas
    this.len = Math.min(this.data.byteLength, width * 2)
    this.step = 1
    if (this.len > width) this.step = this.len / width
  }

  //! Copyright (c) 2020 jariseon. MIT License.
  // @src https://github.com/jariseon/web-audio-blocks/blob/master/widgets/wab-scope.js
  sync() {
    const { data } = this

    // Find zero-crossings
    const c = this.tmp
    c.length = 0

    let max = 0
    for (let n = 1, l = data.length - 1; n < l; n++) {
      const abs = Math.abs(data[n])
      if (abs > max) max = abs
      if (data[n + 1] * data[n - 1] <= 0 && data[n + 1] !== 0) {
        c.push([n, data[n + 1]])
        n += 5
      }
    }

    this.scale = config.autoScale ? (1 / Math.max(max, 0.001)) * 0.4 : 0.4

    if (!this.crossings) {
      this.crossings = c
      return c[0] ? c[0][0] : 0
    }

    if (c.length === 0) return 0

    // Find closest match with previous frame
    let min = Number.MAX_SAFE_INTEGER
    let hit = 0

    for (let i = 1, l = Math.min(c.length, this.crossings.length); i < l; i++) {
      const d1 = c[i][0] - c[i - 1][0]
      let er = 0
      for (let j = 1; j < 2; j++) {
        const d2 = this.crossings[j][0] - this.crossings[j - 1][0]
        er += Math.abs(d1 - d2)
      }

      if (er < min) {
        min = er
        hit = i - 1
      }
    }

    if (c[hit][1] < 0) hit++
    this.crossings = c.slice(hit)
    return c[hit] ? c[hit][0] : 0
  }

  render() {
    const { data, ctx, scale } = this
    const { width, height } = this.canvas

    const pos = this.sync()

    ctx.fillRect(0, 0, width, height)

    let i = pos
    let x = -4
    let y = 0

    const step = 2

    let prevX = -4
    let prevY = 0

    const xStep = this.step * step

    for (let l = pos + this.len + xStep; i < l; i += xStep) {
      y = Math.round((height - 1) * (0.5 - data[i | 0] * scale))
      x += step
      line(prevX, prevY, x, y)
      prevX = x
      prevY = y

      if (x > width + xStep) break
    }

    if (i < data.length - 1) {
      y = Math.round((height - 1) * (0.5 - data[i + 1] * scale))
    }

    line(prevX, prevY, width, y)
  }
}

// MARK: Spectroscope
// ------------------
class Spectroscope {
  constructor(ctx, data) {
    this.ctx = ctx
    this.canvas = ctx.canvas
    this.data = data

    this.xPos = new Float32Array(data.length)
    this.nyquist = config.nyquist
    this.maxLog = Math.log10(config.nyquist) - 1

    this.resize()
  }

  resize() {
    const { nyquist, maxLog } = this
    const { width } = this.canvas

    this.xPos[0] = -10

    for (let i = 1, l = this.xPos.length; i < l; i++) {
      const freq = (i / l) * nyquist
      this.xPos[i] = Math.floor(((Math.log10(freq) - 1) / maxLog) * width)
    }
  }

  render() {
    const { data, ctx } = this
    const { width, height } = this.canvas

    const yScale = this.canvas.height / 255

    ctx.fillRect(0, 0, width, height)

    const path = new Path2D()
    path.moveTo(0, height)

    for (let i = 0; i < data.length; i++) {
      const y = Math.floor(height - data[i] * yScale)
      path.lineTo(this.xPos[i], y)
    }

    path.lineTo(width, height)

    ctx.globalCompositeOperation = "destination-out"
    ctx.stroke(path)
    ctx.fill(path)
    ctx.globalCompositeOperation = "source-over"
  }
}
