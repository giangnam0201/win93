/** @type {OffscreenCanvas} */
let canvas
/** @type {OffscreenCanvasRenderingContext2D} */
let ctx

let imgData
let oPixels
let pixels

let opCount = 0
let opX
let opY
let opOR
let yBuf
let offsets
let yOffsets

const fx = [
  { value: 0, amp: 10, inc: 0.01, offset: 0 },
  { value: 0, amp: 10, inc: 0, offset: 0 },
]

const maxAmplitude = 25
const shadow = -150
const highlight = 1

function initPixels(img) {
  const w = canvas.width
  const h = canvas.height

  ctx.drawImage(
    img,
    Math.floor((w - img.width) / 2),
    maxAmplitude,
    img.width,
    img.height,
  )
  imgData = ctx.getImageData(0, 0, w, h)
  pixels = imgData.data
  oPixels = pixels.slice()
  ctx.clearRect(0, 0, w, h)

  opCount = 0
  for (let oR = 3; oR < oPixels.length; oR += 4) {
    if (oPixels[oR] > 0) opCount++
  }
  opX = new Uint16Array(opCount)
  opY = new Uint16Array(opCount)
  opOR = new Uint32Array(opCount)

  let idx = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const oR = (y * w + x) * 4
      if (oPixels[oR + 3] > 0) {
        opX[idx] = x
        opY[idx] = y
        opOR[idx] = oR
        idx++
      }
    }
  }

  yBuf = new Float64Array(w)
  offsets = new Int32Array(w)
  yOffsets = new Int32Array(w)
}

function siny() {
  const w = canvas.width
  const h = canvas.height
  const l = fx.length
  const oldvalue = []

  let maxSlope = 0
  for (let j = 0; j < l; j++) maxSlope += fx[j].amp * Math.abs(fx[j].inc)
  const currentMaxSlope = Math.max(0.74, maxSlope)

  for (let j = 0; j < l; j++) oldvalue[j] = fx[j].value

  for (let i = 0; i < w; i++) {
    let prov = 0
    for (let j = 0; j < l; j++) prov += Math.sin(fx[j].value) * fx[j].amp
    yBuf[i] = prov
    for (let j = 0; j < l; j++) fx[j].value += fx[j].inc
  }
  for (let j = 0; j < l; j++) fx[j].value = oldvalue[j] + fx[j].offset

  for (let i = 0; i < w; i++) {
    const slope = i === 0 ? 0 : yBuf[i] - yBuf[i - 1]
    const normalizedSlope = Math.max(-1, Math.min(1, slope / currentMaxSlope))
    let offset = -64
    offset +=
      normalizedSlope > 0
        ? normalizedSlope * (highlight + 64)
        : normalizedSlope * -(shadow + 64)
    offsets[i] = offset
    yOffsets[i] = Math.round(yBuf[i])
  }

  pixels.fill(0)

  for (let i = 0; i < opCount; i++) {
    const x = opX[i]
    const presentY = opY[i] - yOffsets[x]

    if (presentY >= 0 && presentY < h) {
      const oR = opOR[i]
      const r = (presentY * w + x) * 4
      const offset = offsets[x] + 15

      pixels[r] = oPixels[oR] + offset
      pixels[r + 1] = oPixels[oR + 1] + offset
      pixels[r + 2] = oPixels[oR + 2] + offset
      pixels[r + 3] = oPixels[oR + 3]
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

function tick() {
  if (fx[1].inc < 1) fx[1].inc += 0.0008
  if (fx[0].amp < 10) {
    fx[0].amp += 0.1
    fx[1].amp += 0.1
  }
  if (fx[0].offset > -0.05) {
    fx[0].offset -= 0.01
    fx[1].offset += 0.01
  }
  siny()
}

// const logo = "/c/users/windows93/pictures/logo/windows93-white-vectoriel.png"
const logo =
  "data:image/png;base64,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"

export async function setup(init) {
  canvas = init.canvas
  // img = init.image
  ctx = canvas.getContext("2d")

  const response = await fetch(logo)
  const blob = await response.blob()
  const img = await createImageBitmap(blob, {
    resizeWidth: 208,
    resizeHeight: 180,
  })

  initPixels(img)
  setInterval(tick, 16)
}
