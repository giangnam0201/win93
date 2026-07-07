import { compileBytebeat } from "../../../../../../42/lib/audio/generator/ByteBeat/compileBytebeat.js"

let formula
let mode = "bytebeat"
let sampleRate = 8000

/** @type {Function} */
let generator = () => 0

function normalizeMode(nextMode = "bytebeat") {
  return nextMode.toLowerCase()
}

function resolveInput(t) {
  return mode === "funcbeat" ? [t / sampleRate, sampleRate] : [t]
}

function toByte(value) {
  const output = Array.isArray(value) ? value[0] : value

  if (mode === "floatbeat" || mode === "funcbeat") {
    return Math.max(0, Math.min(255, Math.round((output + 1) * 127.5)))
  }

  return output & 0xff
}

function compile(formula) {
  const res = compileBytebeat(formula, {
    mode,
    sampleRate,
    fallback: generator,
  })
  if (Array.isArray(res)) return

  generator = (t) => {
    const out = res(...resolveInput(t))
    return Array.isArray(out) ? out[0] : out
  }
}

self.onmessage = (e) => {
  const nextMode = normalizeMode(e.data.mode ?? mode)
  const nextSampleRate = e.data.sampleRate ?? sampleRate
  const shouldRecompile =
    formula !== e.data.formula ||
    nextMode !== mode ||
    nextSampleRate !== sampleRate

  mode = nextMode
  sampleRate = nextSampleRate

  if (shouldRecompile) compile(e.data.formula)
  formula = e.data.formula

  const { width, section } = e.data
  const imageData = new ImageData(width, 256)
  const { data, height } = imageData
  let offset = section * width

  const centerX = width / 2

  let x = 0
  let y = 0
  let h = height

  if (width % 2) {
    const centerY = height / 2
    y = -centerY
    h = centerY
  }

  let p = 0

  if (section === 0) {
    for (; y < h; y++) {
      for (x = -centerX; x < centerX; x++) {
        const c = x > 0 ? toByte(generator(height * (x + offset) + y)) : 0x00
        data[p++] = c
        data[p++] = c
        data[p++] = c
        data[p++] = 0xff
      }
    }
  } else {
    for (; y < h; y++) {
      for (x = -centerX; x < centerX; x++) {
        const t = height * (x + offset) + y
        const c = toByte(generator(t))
        data[p++] = c
        data[p++] = c
        data[p++] = c
        data[p++] = 0xff
      }
    }
  }

  offset++

  self.postMessage({ section, imageData, offset }, [imageData.data.buffer])
}
