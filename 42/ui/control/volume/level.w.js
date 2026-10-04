import * as ease from "../../../lib/algo/ease.js"
import { repaintThrottle } from "../../../lib/timing/repaintThrottle.js"
import { scale } from "../../../lib/type/number/math.js"

const { Transfer } = globalThis

/** @type {OffscreenCanvas} */
let canvas
/** @type {OffscreenCanvasRenderingContext2D} */
let ctx
/** @type {{peak: number, rms: number}[]} */
let volumes

let max = 6
let min = -70
let hold = true
const heldPeaks = []
const heldDuration = 2500

const gainToDb = (floatVal) => Math.log10(floatVal) * 20

export function setup(data) {
  canvas = data.canvas
  ctx = canvas.getContext("2d")

  if ("min" in data) min = data.min
  if ("max" in data) max = data.max
  if ("hold" in data) hold = data.hold

  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  render()
}

export function resize(width, height) {
  canvas.width = width
  canvas.height = height
  render()

  return Transfer.void
}

export function carry(data) {
  if (data.levelNode) {
    data.levelNode.onmessage = repaintThrottle(({ data }) => {
      volumes = data
      render()
    })
  }

  if ("min" in data) min = data.min
  if ("max" in data) max = data.max

  return Transfer.void
}

function render() {
  if (!volumes) return

  if (volumes.length !== heldPeaks.length) {
    heldPeaks.length = volumes.length
    for (let i = 0, l = heldPeaks.length; i < l; i++) {
      heldPeaks[i] = {
        top: 0,
        now: 0,
      }
    }
  }

  const { width, height } = canvas

  ctx.clearRect(0, 0, width, height)

  const w = Math.ceil(width / volumes.length)

  for (let i = 0, l = volumes.length; i < l; i++) {
    const peak = gainToDb(volumes[i].peak)
    const rms = gainToDb(volumes[i].rms)

    const peakTop = Math.round(scale(peak, min, max, 0, height))
    const rmsTop = Math.round(scale(rms, min, max, 0, height))

    const x = i * w
    ctx.fillStyle = "#000" // "#20282f"
    ctx.fillRect(x, 0, w, height - peakTop)
    ctx.fillStyle = "#00000080" // "#20282f80"
    ctx.fillRect(x, 0, w, height - rmsTop)

    if (!hold) continue

    const heldPeak = heldPeaks[i]
    const now = performance.now()

    if (peakTop > heldPeak.top) {
      heldPeak.now = now
      heldPeak.top = peakTop
    } else if (now - heldPeak.now > 500) {
      const elapsed = now - heldPeak.now
      const progress = Math.min(elapsed / heldDuration, 1)
      const easedProgress = ease.easeInExpo(progress)
      const y = ~~(easedProgress * canvas.height)
      heldPeak.top -= y
    }

    ctx.clearRect(x, height - heldPeak.top, w, 1)
  }
}
