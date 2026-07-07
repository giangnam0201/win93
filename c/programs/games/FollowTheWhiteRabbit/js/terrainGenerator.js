/* eslint-disable max-depth */
/* eslint-disable complexity */

/**
 * @typedef {{
 *   x: number, y: number,
 *   type: string,
 *   frame: number,
 *   block: boolean,
 *   variant: string|null
 *   renderParts: {
 *     [key: string]: {
 *       category: string,
 *       dir: string,
 *     }
 *   }
 *   isPath: boolean
 * }} TerrainCell
 */

import { generateSimplex } from "./simplex.js"
import { generateCellular } from "./cellular.js"

export class TerrainGenerator {
  /**
   * @param {number} width
   * @param {number} height
   */
  constructor(width, height) {
    this.width = width
    this.height = height
  }

  generate(opts = {}) {
    const {
      algorithm,
      atlasData,
      baseTerrain = "grass",
      seed = null,
      startX,
      startY,
    } = opts

    // Initialize base grid
    const grid = Array.from({ length: this.height }, (_, y) =>
      Array.from({ length: this.width }, (_, x) => ({
        x,
        y,
        type: baseTerrain,
        frame: 0,
        block: false,
        variant: null,
      })),
    )

    // Generate noise map (0.0 to 1.0)
    const noiseMap =
      algorithm === "cellular"
        ? generateCellular(this.width, this.height, seed)
        : generateSimplex(this.width, this.height, seed)

    const allValues = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        allValues.push(noiseMap[y][x])
      }
    }
    allValues.sort((a, b) => a - b)

    const totalCells = this.width * this.height

    const maxCellsPerType = Math.floor(totalCells * 0.25)
    const minCellsPerType = Math.floor(totalCells * 0.05)

    let dirtThreshold = 0.25
    let waterThreshold = 0.7

    if (totalCells > 0) {
      const maxDirtVal = allValues[Math.min(totalCells - 1, maxCellsPerType)]
      const minDirtVal = allValues[Math.min(totalCells - 1, minCellsPerType)]

      if (dirtThreshold > maxDirtVal) {
        dirtThreshold = maxDirtVal
      }
      if (dirtThreshold < minDirtVal) {
        dirtThreshold = minDirtVal
      }

      const minWaterVal =
        allValues[Math.max(0, totalCells - maxCellsPerType - 1)]
      const maxWaterVal =
        allValues[Math.max(0, totalCells - minCellsPerType - 1)]

      if (waterThreshold < minWaterVal) {
        waterThreshold = minWaterVal
      }
      if (waterThreshold > maxWaterVal) {
        waterThreshold = maxWaterVal
      }
    }

    // Apply biomes based on noise thresholds
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const val = noiseMap[y][x]
        if (val > waterThreshold) {
          grid[y][x].type = "water"
          if (atlasData.terrains.water.solid?.block) {
            grid[y][x].block = true
          }
        } else if (val < dirtThreshold) {
          grid[y][x].type = "dirt"
        } else {
          grid[y][x].variant = this.pickVariant(
            atlasData.terrains.grass.variations,
          )
        }
      }
    }

    // Guarantee a clear spawn area at the given start position or center
    const cx = startX === undefined ? Math.floor(this.width / 2) : startX
    const cy = startY === undefined ? Math.floor(this.height / 2) : startY
    const spawnRadius = 1

    for (
      let y = Math.max(0, cy - spawnRadius);
      y <= Math.min(this.height - 1, cy + spawnRadius);
      y++
    ) {
      for (
        let x = Math.max(0, cx - spawnRadius);
        x <= Math.min(this.width - 1, cx + spawnRadius);
        x++
      ) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= spawnRadius ** 2) {
          if (grid[y][x].type === "water") {
            grid[y][x].type = "grass"
            grid[y][x].block = false
            grid[y][x].variant = null
          }
          grid[y][x].isPath = true // Mark to prevent assets from blocking spawn
        }
      }
    }

    this.computeAutotiles(grid, atlasData)
    return grid
  }

  /**
   * @param {Array<{rarity: number, [key: string]: any}>} variations
   */
  pickVariant(variations) {
    if (!variations || variations.length === 0) return null
    const sorted = [...variations].sort((a, b) => b.rarity - a.rarity)
    if (Math.random() > 0.35) return null

    for (const v of sorted) {
      const roll = Math.random() * 100
      if (roll >= v.rarity) {
        return v
      }
    }

    return null
  }

  /**
   * Evaluates the 8 neighbors of a tile and computes bitmask for autotiling.
   * @param {TerrainCell[][]} grid
   */
  computeAutotiles(grid, atlasData) {
    const isSameType = (tx, ty, type) => {
      if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return true // Out of bounds counts as same type
      return grid[ty][tx].type === type
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = grid[y][x]
        const typeInfo = atlasData.terrains[cell.type]

        // Only paths/water need autotiling corners
        if (
          !typeInfo.inner_corner &&
          !typeInfo.edge &&
          !typeInfo.outer_corner &&
          (!typeInfo.frames ||
            (!typeInfo.frames[0].inner_corner &&
              !typeInfo.frames[0].edge &&
              !typeInfo.frames[0].outer_corner))
        ) {
          continue
        }

        // Neighbors pattern
        const n = isSameType(x, y - 1, cell.type)
        const s = isSameType(x, y + 1, cell.type)
        const e = isSameType(x + 1, y, cell.type)
        const w = isSameType(x - 1, y, cell.type)
        const nw = isSameType(x - 1, y - 1, cell.type)
        const ne = isSameType(x + 1, y - 1, cell.type)
        const sw = isSameType(x - 1, y + 1, cell.type)
        const se = isSameType(x + 1, y + 1, cell.type)

        // Generate rendering parts needed for this cell (4 corners)
        cell.renderParts = {}

        // Helper to determine corner state
        // 0 = Full (center solid), 1 = Outer Corner (convex), 2 = Edge (straight line), 3 = Inner Corner (concave)
        const getCorner = (cardinal1, cardinal2, diagonal) => {
          if (!cardinal1 && !cardinal2) return "outer_corner"
          if (!cardinal1 && cardinal2) return "edge_h" // needs specific logic for edge orientation
          if (cardinal1 && !cardinal2) return "edge_v"
          if (cardinal1 && cardinal2 && !diagonal) return "inner_corner"
          return "solid"
        }

        // NW corner (affected by N, W, NW)
        const nwState = getCorner(n, w, nw)
        if (nwState === "outer_corner") {
          cell.renderParts.topleft = {
            category: "outer_corner",
            dir: "topleft",
          }
        } else if (nwState === "edge_h") {
          cell.renderParts.topleft = { category: "edge", dir: "topleft" }
        } // Left border
        else if (nwState === "edge_v") {
          cell.renderParts.topleft = { category: "edge", dir: "topleft" }
        } // Top border (needs careful mapping based on asset structure, assuming edge top/left logic via 'dir')
        else if (nwState === "inner_corner") {
          cell.renderParts.topleft = {
            category: "inner_corner",
            dir: "topleft",
          }
        }

        // NE corner (N, E, NE)
        const neState = getCorner(n, e, ne)
        if (neState === "outer_corner") {
          cell.renderParts.topright = {
            category: "outer_corner",
            dir: "topright",
          }
        } else if (neState === "inner_corner") {
          cell.renderParts.topright = {
            category: "inner_corner",
            dir: "topright",
          }
        }

        // SW corner (S, W, SW)
        const swState = getCorner(s, w, sw)
        if (swState === "outer_corner") {
          cell.renderParts.bottomleft = {
            category: "outer_corner",
            dir: "bottomleft",
          }
        } else if (swState === "inner_corner") {
          cell.renderParts.bottomleft = {
            category: "inner_corner",
            dir: "bottomleft",
          }
        }

        // SE corner (S, E, SE)
        const seState = getCorner(s, e, se)
        if (seState === "outer_corner") {
          cell.renderParts.bottomright = {
            category: "outer_corner",
            dir: "bottomright",
          }
        } else if (seState === "inner_corner") {
          cell.renderParts.bottomright = {
            category: "inner_corner",
            dir: "bottomright",
          }
        }

        // For edge mapping natively to 32x32: if the corner logic is too specific, we fallback to our 'dir'
        // Terrain.js has 'edge' split into topleft/topright etc. but actually 'edge' usually maps a full border side.
        // Let's explicitly map straight borders if missing cardinal neghbors.
        cell.renderParts = {
          topleft: null,
          topright: null,
          bottomleft: null,
          bottomright: null,
        }

        if (n && e && s && w && nw && ne && sw && se) {
          // Fully surrounded
          cell.renderParts.full = true
        } else {
          // Inner Corners
          if (n && w && !nw) {
            cell.renderParts.topleft = {
              category: "inner_corner",
              dir: "topleft",
            }
          }
          if (n && e && !ne) {
            cell.renderParts.topright = {
              category: "inner_corner",
              dir: "topright",
            }
          }
          if (s && w && !sw) {
            cell.renderParts.bottomleft = {
              category: "inner_corner",
              dir: "bottomleft",
            }
          }
          if (s && e && !se) {
            cell.renderParts.bottomright = {
              category: "inner_corner",
              dir: "bottomright",
            }
          }

          // Outer Corners
          if (!n && !w) {
            cell.renderParts.topleft = {
              category: "outer_corner",
              dir: "topleft",
            }
          }
          if (!n && !e) {
            cell.renderParts.topright = {
              category: "outer_corner",
              dir: "topright",
            }
          }
          if (!s && !w) {
            cell.renderParts.bottomleft = {
              category: "outer_corner",
              dir: "bottomleft",
            }
          }
          if (!s && !e) {
            cell.renderParts.bottomright = {
              category: "outer_corner",
              dir: "bottomright",
            }
          }

          // Edges (Straight borders)
          if (!n && w) {
            cell.renderParts.topleft = { category: "edge", dir: "top_left" }
          }
          if (!n && e) {
            cell.renderParts.topright = { category: "edge", dir: "top_right" }
          }
          if (!s && w) {
            cell.renderParts.bottomleft = {
              category: "edge",
              dir: "bottom_left",
            }
          }
          if (!s && e) {
            cell.renderParts.bottomright = {
              category: "edge",
              dir: "bottom_right",
            }
          }
          if (n && !w) {
            cell.renderParts.topleft = { category: "edge", dir: "left_top" }
          }
          if (n && !e) {
            cell.renderParts.topright = { category: "edge", dir: "right_top" }
          }
          if (s && !w) {
            cell.renderParts.bottomleft = {
              category: "edge",
              dir: "left_bottom",
            }
          }
          if (s && !e) {
            cell.renderParts.bottomright = {
              category: "edge",
              dir: "right_bottom",
            }
          }
        }
      }
    }
  }

  /**
   * Scatters assets across the map.
   * @param {TerrainCell[][]} grid
   * @param {object} atlasData
   */
  generateAssets(grid, atlasData) {
    const assetsGrid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => null),
    )

    const assets = Object.keys(atlasData.assets)

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = grid[y][x]

        // Skip spawning anything on paths or the center
        if (cell.isPath) continue

        const typeInfo = atlasData.terrains[cell.type]

        for (const assetName of assets) {
          const assetData = atlasData.assets[assetName]
          if (assetName === "white_mushrooms_01") continue

          // Handle biome targeting and optional rarity overrides
          let isAllowedBiome = false
          let biomeRarityOverride = null

          if (assetData.biome) {
            for (const b of assetData.biome) {
              if (Array.isArray(b)) {
                if (b[0] === cell.type) {
                  isAllowedBiome = true
                  biomeRarityOverride = b[1]
                  break
                }
              } else if (b === cell.type) {
                isAllowedBiome = true
                break
              }
            }
          } else {
            isAllowedBiome = typeInfo.ground === true
          }

          if (!isAllowedBiome) continue

          // Prevent the same asset from spawning adjacent to itself
          let hasSameAdjacent = false
          const neighbors = [
            [-1, -1],
            [0, -1],
            [1, -1],
            [-1, 0],
            [1, 0],
            [-1, 1],
            [0, 1],
            [1, 1],
          ]
          for (const [dx, dy] of neighbors) {
            const nx = x + dx
            const ny = y + dy
            if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
              if (assetsGrid[ny][nx] === assetName) {
                hasSameAdjacent = true
                break
              }
            }
          }

          if (hasSameAdjacent) continue

          const roll = Math.random() * 100

          // Use biome override if present, otherwise default asset rarity
          const activeRarity =
            biomeRarityOverride === null
              ? assetData.rarity
              : biomeRarityOverride

          // Apply a gentle global scaler so assets don't completely tile the map if rarity is near 0
          // E.g rarity 0 requires roll >= 0, meaning 100% spawn. We scale it so 0 is ~5% max density per specific asset.
          if (roll >= activeRarity && Math.random() < 0.05) {
            assetsGrid[y][x] = assetName
            if (assetData.block) cell.block = true
            break
          }
        }
      }
    }

    return assetsGrid
  }
}
