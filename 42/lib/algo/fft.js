import { log2 } from "./bits.js"

const { sqrt } = Math

/**
 * @license 0BSD
 * @copyright 2013 Mikola Lysenko
 * @copyright 1993 Paul Bourke. Public domain
 * @source https://github.com/mikolalysenko/ndfft
 */

/**
 * In place 1D FFT.
 * @param {number} dir
 * @param {number[] | Float64Array | Float32Array} x
 * @param {Float64Array | number[] | Float32Array} y
 */
export function fft(dir, x, y, m = log2(x.length)) {
  let i1
  let k
  let l1
  let l2
  let c1
  let c2
  let tx
  let ty
  let t1
  let t2
  let u1
  let u2
  let z

  /* Calculate the number of points */
  const nn = 1 << m

  /* Do the bit reversal */
  const i2 = nn >> 1
  let j = 0

  for (let i = 0; i < nn - 1; i++) {
    if (i < j) {
      tx = x[i]
      ty = y[i]
      x[i] = x[j]
      y[i] = y[j]
      x[j] = tx
      y[j] = ty
    }

    k = i2
    while (k <= j) {
      j -= k
      k >>= 1
    }

    j += k
  }

  /* Compute the FFT */
  c1 = -1
  c2 = 0
  l2 = 1
  for (let l = 0; l < m; l++) {
    l1 = l2
    l2 <<= 1
    u1 = 1
    u2 = 0
    for (let j = 0; j < l1; j++) {
      for (let i = j; i < nn; i += l2) {
        i1 = i + l1
        t1 = u1 * x[i1] - u2 * y[i1]
        t2 = u1 * y[i1] + u2 * x[i1]
        x[i1] = x[i] - t1
        y[i1] = y[i] - t2
        x[i] += t1
        y[i] += t2
      }

      z = u1 * c1 - u2 * c2
      u2 = u1 * c2 + u2 * c1
      u1 = z
    }

    c2 = sqrt((1 - c1) / 2)
    if (dir === 1) {
      c2 = -c2
    }

    c1 = sqrt((1 + c1) / 2)
  }

  /* Scaling for forward transform */
  if (dir === -1) {
    const scaleF = 1 / nn
    for (let i = 0; i < nn; i++) {
      x[i] *= scaleF
      y[i] *= scaleF
    }
  }
}

// Cached buffers
let x0 = new Float64Array(4096)
let y0 = new Float64Array(4096)
function realloc(n) {
  if (x0.length < n) {
    x0 = new Float64Array(n)
    y0 = new Float64Array(n)
  }
}

/**
 * In place 2D FFT.
 * @param {number} dir
 * @param {number[][]} x
 * @param {number[][]} y
 */
export function fft2(
  dir, //
  x,
  y,
  m = log2(x[0].length),
  n = log2(x.length),
) {
  realloc(x.length)
  for (let i = 0; i < x.length; ++i) {
    fft(dir, x[i], y[i], m)
  }

  for (let j = 0; j < x[0].length; ++j) {
    for (let i = 0; i < x.length; ++i) {
      x0[i] = x[i][j]
      y0[i] = y[i][j]
    }

    fft(dir, x0, y0, n)
    for (let i = 0; i < x.length; ++i) {
      x[i][j] = x0[i]
      y[i][j] = y0[i]
    }
  }
}

/**
 * In place 3D FFT.
 * @param {number} dir
 * @param {number[][][]} x
 * @param {number[][][]} y
 */
export function fft3(
  dir,
  x,
  y,
  m = log2(x[0][0].length),
  n = log2(x[0].length),
  p = log2(x.length),
) {
  realloc(Math.max(x.length, x[0].length))
  for (let i = 0; i < x.length; ++i) {
    const rx = x[i]
    const ry = y[i]
    for (let j = 0; j < rx.length; ++j) {
      fft(dir, rx[j], ry[j], m)
    }

    for (let j = 0; j < rx[0].length; ++j) {
      for (let k = 0; k < rx.length; ++k) {
        x0[k] = rx[k][j]
        y0[k] = ry[k][j]
      }

      fft(dir, x0, y0, n)
      for (let k = 0; k < rx.length; ++k) {
        rx[k][j] = x0[k]
        ry[k][j] = y0[k]
      }
    }
  }

  for (let i = 0; i < x[0].length; ++i) {
    for (let j = 0; j < x[0][0].length; ++j) {
      for (let k = 0; k < x.length; ++k) {
        x0[k] = x[k][i][j]
        y0[k] = y[k][i][j]
      }

      fft(dir, x0, y0, p)
      for (let k = 0; k < x.length; ++k) {
        x[k][i][j] = x0[k]
        y[k][i][j] = y0[k]
      }
    }
  }
}
