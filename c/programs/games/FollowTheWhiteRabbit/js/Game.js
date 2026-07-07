/* eslint-disable complexity */
/* eslint-disable max-depth */
import { TerrainGenerator } from "./terrainGenerator.js"
import { TerrainRenderer } from "./terrainRenderer.js"

export class Game {
  constructor(canvas, data) {
    this.canvas = canvas
    this.data = data

    this.grid = []
    this.assetsGrid = []
    this.entities = []
    this.renderer = null

    this.tileSize = 32

    this.desktopWidth = 0
    this.desktopHeight = 0
  }

  generateMap(w, h, options = {}) {
    const { algo = "simplex", startX = -1, startY = -1 } = options
    let { seed } = options

    if (seed === undefined || seed === null) {
      seed = Math.random().toString(36).slice(2, 8)
    }

    const tileStartX = startX === -1 ? Math.floor(w / 2) : startX
    const tileStartY = startY === -1 ? Math.floor(h / 2) : startY

    let attempt = 0
    while (attempt < 50) {
      const currentSeed =
        seed !== undefined && seed !== null && attempt > 0
          ? `${seed}-${attempt}`
          : seed

      const gen = new TerrainGenerator(w, h)
      // @ts-ignore
      this.grid = gen.generate({
        algorithm: algo,
        atlasData: this.data.terrain.data,
        baseTerrain: "grass",
        seed: currentSeed,
        startX: tileStartX,
        startY: tileStartY,
      })
      this.assetsGrid = gen.generateAssets(this.grid, this.data.terrain.data)

      this.mapWidth = this.grid[0].length * this.tileSize
      this.mapHeight = this.grid.length * this.tileSize

      if (this.isNavigableFrom(tileStartX, tileStartY)) {
        break
      }
      attempt++
    }

    if (this.renderer) {
      this.renderer.isRunning = false
    }
    this.renderer = new TerrainRenderer(
      this.canvas,
      this.data.terrain.data,
      this.data.terrain.img,
      this,
    )
    this.renderer.setMap(this.grid, this.assetsGrid)
  }

  isNavigableFrom(startX, startY) {
    if (!this.grid || this.grid.length === 0) return false

    const ts = this.tileSize
    const hitbox = { x: 16, y: 16, width: 32, height: 32 }

    const width = this.grid[0].length
    const height = this.grid.length

    // If starting exactly on the edge
    if (
      startX === 0 ||
      startX === width - 1 ||
      startY === 0 ||
      startY === height - 1
    ) {
      return true
    }

    const visited = new Set()
    const queue = [[startX, startY]]
    visited.add(`${startX},${startY}`)

    let index = 0
    while (index < queue.length) {
      const [tx, ty] = queue[index++]

      const neighbors = [
        [tx + 1, ty],
        [tx - 1, ty],
        [tx, ty + 1],
        [tx, ty - 1],
      ]

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const key = `${nx},${ny}`
          if (!visited.has(key)) {
            visited.add(key)
            const entityX = nx * ts - hitbox.x
            const entityY = ny * ts - hitbox.y
            if (this.canMoveTo(entityX, entityY, hitbox)) {
              if (
                nx === 0 ||
                nx === width - 1 ||
                ny === 0 ||
                ny === height - 1
              ) {
                return true
              }
              queue.push([nx, ny])
            }
          }
        }
      }
    }

    return false
  }

  addEntity(entity) {
    this.entities.push(entity)
  }

  update(deltaTime) {
    for (const entity of this.entities) {
      if (entity.update) {
        entity.update(deltaTime, this)
      }
    }
  }

  /**
   * Checks if an entity can move and occupy a specific position.
   */
  canMoveTo(entityX, entityY, hitbox) {
    const ts = this.tileSize

    const bx = entityX + hitbox.x
    const by = entityY + hitbox.y
    const bw = hitbox.width
    const bh = hitbox.height

    if (
      bx < 0 ||
      bx + bw > this.mapWidth ||
      by < 0 ||
      by + bh > this.mapHeight
    ) {
      return false
    }

    // Convert bounds to grid coordinates
    const sx = Math.floor(bx / ts)
    const sy = Math.floor(by / ts)
    const ex = Math.floor((bx + bw - 1) / ts)
    const ey = Math.floor((by + bh - 1) / ts)

    for (let gy = sy; gy <= ey; gy++) {
      for (let gx = sx; gx <= ex; gx++) {
        // Tile Solid Collision
        if (
          gy >= 0 &&
          gy < this.grid.length &&
          gx >= 0 &&
          gx < this.grid[0].length
        ) {
          const { type } = this.grid[gy][gx]
          const typeInfo = this.data.terrain.data.terrains[type]

          if (typeInfo.solid && typeInfo.solid.block === true) {
            return false
          }
          if (
            typeInfo.frames &&
            typeInfo.frames[0].outer_corner.topleft.block === true
          ) {
            // Treat animated tiles (like water) as globally blocking for now
            return false
          }
        }
      }
    }

    // Asset block geometry
    const searchSx = Math.max(0, sx - 4)
    const searchEx = Math.min(this.grid[0].length - 1, ex + 4)
    const searchSy = Math.max(0, sy - 4)
    const searchEy = Math.min(this.grid.length - 1, ey + 4)

    for (let gy = searchSy; gy <= searchEy; gy++) {
      for (let gx = searchSx; gx <= searchEx; gx++) {
        if (
          gy >= 0 &&
          gy < this.assetsGrid.length &&
          gx >= 0 &&
          gx < this.assetsGrid[0].length
        ) {
          const assetName = this.assetsGrid[gy][gx]
          if (assetName) {
            const assetInfo = this.data.terrain.data.assets[assetName]

            if (assetInfo.block === true) {
              // Full asset grid collision via precise AABB bounds (ignoring loop origin mismatch)
              const abx = gx * ts
              const aby = gy * ts
              if (
                bx < abx + ts &&
                bx + bw > abx &&
                by < aby + ts &&
                by + bh > aby
              ) {
                return false
              }
            } else if (typeof assetInfo.block === "object") {
              let ax = gx * ts

              if (assetInfo.block.x !== undefined) {
                const relX = assetInfo.block.x - assetInfo.x
                ax -= relX
              } else if (assetInfo.w > ts) {
                ax -= (assetInfo.w - ts) / 2
              }

              const ay = gy * ts + ts - assetInfo.h

              // AABB
              const abx = ax + (assetInfo.block.x - assetInfo.x)
              const aby = ay + (assetInfo.block.y - assetInfo.y)
              const abw = assetInfo.block.w
              const abh = assetInfo.block.h

              if (
                bx < abx + abw &&
                bx + bw > abx &&
                by < aby + abh &&
                by + bh > aby
              ) {
                return false
              }
            }
          }
        }
      }
    }

    return true
  }
}
