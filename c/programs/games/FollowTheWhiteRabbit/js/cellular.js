import { seedToNumber } from "./seedGenerator.js"

/**
 * Cellular automata for cave-like organic shapes.
 * @param {number} width
 * @param {number} height
 * @param {string|number|null} seed
 * @returns {number[][]}
 */
export function generateCellular(width, height, seed = null) {
  let numSeed = Date.now()
  if (typeof seed === "number") {
    numSeed = seed
  } else if (typeof seed === "string") {
    numSeed = seedToNumber(seed)
  }

  // Simple pseudo-random generator based on seed
  let currentSeed = numSeed
  const nextRandom = () => {
    currentSeed = (currentSeed * 9301 + 49_297) % 233_280
    return currentSeed / 233_280
  }

  // Use nextRandom() instead of Math.random() for deterministic generation
  let grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => (nextRandom() > 0.45 ? 1 : 0)),
  )

  const getNeighbors = (g, x, y) => {
    let count = 0
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue
        const nx = x + j
        const ny = y + i
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          count++ // edges act as walls
        } else {
          count += g[ny][nx]
        }
      }
    }
    return count
  }

  // Run a few smoothing steps
  for (let step = 0; step < 4; step++) {
    const next = grid.map((arr) => [...arr])
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const neighbors = getNeighbors(grid, x, y)
        if (neighbors > 4) next[y][x] = 1
        else if (neighbors < 4) next[y][x] = 0
      }
    }
    grid = next
  }

  // Convert 0/1 back to noise-like values to fit our threshold logic (1 -> water/0.9, 0 -> dirt/0.1)
  // To make it interesting, we'll invert some or just map directly.
  return grid.map((row) => row.map((v) => (v === 1 ? 0.8 : 0.2)))
}
