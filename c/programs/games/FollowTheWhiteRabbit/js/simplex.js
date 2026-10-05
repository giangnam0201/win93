import { seedToNumber } from "./seedGenerator.js"

/**
 * Simple Value Noise / Simplex implementation mapped to [0, 1].
 * @param {number} width
 * @param {number} height
 * @param {string|number|null} seed
 * @returns {number[][]}
 */
export function generateSimplex(width, height, seed = null) {
  const scale = 0.1
  const grid = []

  let numSeed = 0
  if (typeof seed === "number") {
    numSeed = seed
  } else if (typeof seed === "string") {
    numSeed = seedToNumber(seed)
  }

  const hash = (x, y) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + numSeed * 13.13) * 43_758.5453
    return n - Math.floor(n)
  }

  const interpolate = (a, b, t) => a + (b - a) * (3 * t * t - 2 * t * t * t)

  const noise = (x, y) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy

    const v1 = hash(ix, iy)
    const v2 = hash(ix + 1, iy)
    const v3 = hash(ix, iy + 1)
    const v4 = hash(ix + 1, iy + 1)

    const i1 = interpolate(v1, v2, fx)
    const i2 = interpolate(v3, v4, fx)

    return interpolate(i1, i2, fy)
  }

  for (let y = 0; y < height; y++) {
    const row = []
    for (let x = 0; x < width; x++) {
      // multiple octaves for detail
      let val =
        Number(noise(x * scale, y * scale)) +
        0.5 * noise(x * scale * 2, y * scale * 2) +
        0.25 * noise(x * scale * 4, y * scale * 4)
      val /= 1 + 0.5 + 0.25
      row.push(val)
    }
    grid.push(row)
  }
  return grid
}
