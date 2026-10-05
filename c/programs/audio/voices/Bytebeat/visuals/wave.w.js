import { compileBytebeat } from "../../../../../../42/lib/audio/generator/ByteBeat/compileBytebeat.js"
// import { line } from "../../../../../../42/lib/geometry/line.js"

/** @type {HTMLCanvasElement} */
let canvas
let ctx
let t = 0
let formula
let offsetX
let mode = "bytebeat"
let sampleRate = 8000

const leftColor = "#f00"
const rightColor = "#0ff"

let paused = false

/** @type {Function} */
let generator = () => 0

function normalizeMode(nextMode = "bytebeat") {
  return nextMode.toLowerCase()
}

function resolveInput(t) {
  return mode === "funcbeat" ? [t / sampleRate, sampleRate] : [t]
}

function toWaveY(value) {
  if (mode === "floatbeat" || mode === "funcbeat") {
    return 128 - Math.max(Math.min(value, 1), -1) * 128
  }

  return 256 - (value & 255)
}

function compile(formula) {
  const res = compileBytebeat(formula, {
    mode,
    sampleRate,
    fallback: generator,
  })
  if (!Array.isArray(res)) generator = res
}

self.onmessage = (e) => {
  const { dataPort } = e.data

  dataPort.onmessage = ({ data }) => {
    if ("formula" in data) {
      if (
        formula === data.formula &&
        (!("mode" in data) || mode === normalizeMode(data.mode)) &&
        (!("sampleRate" in data) || sampleRate === data.sampleRate)
      ) {
        return
      }

      formula = data.formula
      compile(data.formula)
    }

    if ("mode" in data) {
      const nextMode = normalizeMode(data.mode)
      if (nextMode !== mode) {
        mode = nextMode
        compile(formula)
      }
    }

    if ("sampleRate" in data && data.sampleRate !== sampleRate) {
      sampleRate = data.sampleRate
      compile(formula)
    }

    if ("width" in data) {
      canvas.width = data.width
      ctx.strokeStyle = leftColor
      offsetX = (canvas.width % 256) / 2
    }

    if ("render" in data) {
      render()
    }

    if ("paused" in data) {
      if (paused && data.paused === false) {
        paused = data.paused
        loop()
      }

      paused = data.paused
    }
  }

  canvas = e.data.canvas
  offsetX = (canvas.width % 256) / 2
  ctx = canvas.getContext("2d")

  ctx.strokeStyle = leftColor
  ctx.fillStyle = leftColor
  ctx.imageSmoothingEnabled = false

  formula = e.data.formula
  mode = normalizeMode(e.data.mode)
  sampleRate = e.data.sampleRate ?? sampleRate
  compile(formula)

  self.onmessage = ({ data }) => {
    t = data - (data % 256)
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, 256)

    // let value
    // let prevX = 0
    // let prevY = 0

    // for (let y, x = -offsetX; x <= canvas.width; x++) {
    //   ctx.strokeStyle = "#0ff"
    //   value = generator(x + t)
    //   y = 256 - (value & 255)

    //   for (const l of line(prevX, prevY, x + offsetX, y)) {
    //     ctx.fillRect(l.x, l.y, 1, 1)
    //   }

    //   prevX = x + offsetX
    //   prevY = y
    // }

    if (Array.isArray(generator(...resolveInput(0)))) {
      const left = []

      ctx.strokeStyle = rightColor
      ctx.beginPath()

      for (let x = -offsetX; x <= canvas.width; x++) {
        const res = generator(...resolveInput(x + t))
        ctx.lineTo(x + offsetX, toWaveY(res[1]))
        left.push([x + offsetX, toWaveY(res[0])])
      }

      ctx.stroke()

      ctx.strokeStyle = leftColor
      ctx.beginPath()
      for (const [x, y] of left) ctx.lineTo(x, y)
      ctx.stroke()
    } else {
      ctx.beginPath()

      for (let x = -offsetX; x <= canvas.width; x++) {
        const value = generator(...resolveInput(x + t))
        ctx.lineTo(x + offsetX, toWaveY(value))
      }

      ctx.stroke()
    }
  }

  function loop() {
    if (paused) return
    render()

    // requestAnimationFrame(loop)
    setTimeout(loop, 32)
  }

  loop()
}

self.postMessage("loaded")
