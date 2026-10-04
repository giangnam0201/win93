/* eslint-disable complexity */

//! Copyright (c) 2014 Szymon Witamborski. MIT License.
// @src http://brainshave.com/blog/tracing-pixels

export const SVG_NS = "http://www.w3.org/2000/svg"

const MOVES = {
  0b0001: { h: 1 },
  0b0010: { v: 1 },
  0b0011: { h: 1 },
  0b0100: { v: -1 },
  0b0101: { v: -1 },
  0b0110: { junction: 2 },
  0b0111: { v: -1 },
  0b1000: { h: -1 },
  0b1001: { junction: 1 },
  0b1010: { v: 1 },
  0b1011: { h: 1 },
  0b1100: { h: -1 },
  0b1101: { h: -1 },
  0b1110: { v: 1 },
}

class TracedBitmap {
  constructor(paths, width, height, color) {
    this.paths = paths
    this.color = color
    this.height = height
    this.width = width
  }

  get d() {
    return this.paths.join(" ")
  }

  #path
  get path() {
    if (this.#path) return this.#path
    const pathEl = document.createElementNS(SVG_NS, "path")
    pathEl.setAttribute("d", this.paths.join(" "))
    if (this.color) pathEl.setAttribute("fill", this.color)
    this.#path = pathEl
    return pathEl
  }

  #svg
  get svg() {
    if (this.#svg) return this.#svg
    const svgEl = document.createElementNS(SVG_NS, "svg")
    svgEl.setAttribute("xmlns", SVG_NS)
    svgEl.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`)
    svgEl.setAttribute("width", String(this.width))
    svgEl.setAttribute("height", String(this.height))
    svgEl.append(this.path)
    this.#svg = svgEl
    return svgEl
  }
}

class TracedImageData {
  constructor(colors, width, height) {
    this.colors = colors
    this.width = width
    this.height = height
  }

  #svg
  get svg() {
    if (this.#svg) return this.#svg
    const svgEl = document.createElementNS(SVG_NS, "svg")
    svgEl.setAttribute("xmlns", SVG_NS)
    svgEl.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`)
    svgEl.setAttribute("width", String(this.width))
    svgEl.setAttribute("height", String(this.height))
    for (const item of this.colors) svgEl.append(item.path)
    this.#svg = svgEl
    return svgEl
  }
}

const counterclockwise = (move) =>
  move.v === -1
    ? { h: -1 }
    : move.h === -1
      ? { v: 1 }
      : move.v === 1
        ? { h: 1 }
        : { v: -1 }

const isSameSig = (a, b) => a * b > 0

function optimize(moves) {
  const len = moves.length
  const out = []

  for (let i = 1, prev = moves[0]; i < len; ++i) {
    let current = moves[i]
    if (isSameSig(prev.h, current.h)) current = { h: prev.h + current.h }
    else if (isSameSig(prev.v, current.v)) current = { v: prev.v + current.v }
    else out.push(prev)
    prev = current
  }

  return out
}

function pathToString(moves) {
  let out = ""
  for (const move of moves) {
    if ("h" in move) out += "h" + move.h
    else if ("v" in move) out += "v" + move.v
    else out += "M" + move.x + " " + move.y
  }
  return out + "z"
}

function tracePath(w, h, directions, visiteds, pixelHoles) {
  let x = 0
  let y = 0
  let hole
  const stride = w + 1

  // first check if any single pixel hole has been spotted
  main: for (y = 0; y < h; ++y) {
    const rowOffset = y * stride
    for (x = 0; x < w; ++x) {
      if (MOVES[directions[rowOffset + x]] && pixelHoles[rowOffset + x] !== 0) {
        hole = pixelHoles[rowOffset + x]
        pixelHoles[rowOffset + x] = 0
        break main
      }
    }
  }

  if (!hole) {
    // find starting point that hasn't been covered yet.
    main: for (y = 0; y < h; ++y) {
      const rowOffset = y * stride
      for (x = 0; x < w; ++x) {
        if (MOVES[directions[rowOffset + x]] && visiteds[rowOffset + x] === 0) {
          break main
        }
      }
    }
  }

  if (x === w && y === h) return

  const startX = x
  const startY = y
  const moves = [{ x, y }]

  do {
    if (moves.length > 5000) throw new Error("Too many moves")

    const idx = y * stride + x
    let move = hole ? { h: -1 } : MOVES[directions[idx]]
    hole = false

    if (move.junction) {
      if (x === startX && y === startY) {
        move = { h: -1 }
      } else {
        move = counterclockwise(moves.at(-1))
        if (
          visiteds[idx] === 0 &&
          MOVES[directions[idx - 1]]?.junction === 2 &&
          MOVES[directions[idx + stride]]?.junction === 2
        ) {
          pixelHoles[idx] = 1
        }
      }
    }

    moves.push(move)
    visiteds[idx] = 1
    x += move.h | 0
    y += move.v | 0
  } while ((x === startX && y === startY) === false)

  return pathToString(optimize(moves))
}

function tracePaths(w, h, isPixelActive, buffers) {
  const paths = []
  const stride = w + 1
  const size = (h + 1) * stride

  const directions = buffers?.directions ?? new Uint8Array(size)
  const visiteds = buffers?.visiteds ?? new Uint8Array(size)
  const pixelHoles = buffers?.pixelHoles ?? new Uint8Array(size)

  if (buffers) {
    directions.fill(0)
    visiteds.fill(0)
    pixelHoles.fill(0)
  }

  for (let y = 0; y <= h; ++y) {
    const rowOffset = y * stride
    for (let x = 0; x <= w; ++x) {
      const code =
        ((y > 0 && x > 0 && isPixelActive(x - 1, y - 1) ? 1 : 0) << 3) +
        ((y > 0 && x < w && isPixelActive(x, y - 1) ? 1 : 0) << 2) +
        ((y < h && x > 0 && isPixelActive(x - 1, y) ? 1 : 0) << 1) +
        ((y < h && x < w && isPixelActive(x, y) ? 1 : 0) | 0)
      directions[rowOffset + x] = code
    }
  }

  let path

  do {
    if (paths.length > 5000) throw new Error("Too many path")
    path = tracePath(w, h, directions, visiteds, pixelHoles)
    if (path) paths.push(path)
  } while (path)

  return paths
}

/**
 * @param {ImageData} imageData
 */
export function traceBitmap(imageData) {
  const { data, width: w, height: h } = imageData
  const isPixelActive = (x, y) => data[(y * w + x) * 4 + 3] > 0
  const paths = tracePaths(w, h, isPixelActive)
  return new TracedBitmap(paths, w, h)
}

/**
 * @param {ImageData} imageData
 */
export function traceImageData(imageData) {
  const { data, width: w, height: h } = imageData
  const data32 = new Uint32Array(data.buffer)
  const colors = new Map()

  for (let i = 0, len = data32.length; i < len; ++i) {
    const rgba = data32[i]
    if (rgba === 0) continue // skip transparent

    if (!colors.has(rgba)) {
      const offset = i * 4
      const a = data[offset + 3]
      if (a === 0) continue
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      colors.set(
        rgba,
        a === 255 //
          ? `rgb(${r} ${g} ${b})`
          : `rgb(${r} ${g} ${b} / ${a / 255})`,
      )
    }
  }

  const result = []
  const stride = w + 1
  const size = (h + 1) * stride
  const buffers = {
    directions: new Uint8Array(size),
    visiteds: new Uint8Array(size),
    pixelHoles: new Uint8Array(size),
  }

  for (const [rgba, color] of colors) {
    const isPixelActive = (x, y) => data32[y * w + x] === rgba
    const paths = tracePaths(w, h, isPixelActive, buffers)
    if (paths.length > 0) result.push(new TracedBitmap(paths, w, h, color))
  }

  return new TracedImageData(result, w, h)
}
