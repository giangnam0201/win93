/* eslint-disable unicorn/prefer-ternary */
/* eslint-disable max-depth */
/* eslint-disable complexity */
export class TerrainRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} atlasData
   * @param {HTMLImageElement} atlasImage
   * @param {import('./Game.js').Game} game
   */
  constructor(canvas, atlasData, atlasImage, game) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")
    this.ctx.imageSmoothingEnabled = false
    this.atlasData = atlasData
    this.atlasImage = atlasImage
    this.game = game
    this.scale = 1
    this.tileSize = 32

    this.grid = null
    this.assetsGrid = null
    this.lastTime = performance.now()
    this.animationTimer = 0

    this.renderLoop = this.renderLoop.bind(this)
  }

  /**
   * Starts or restarts the rendering loop with a new map.
   * @param {import('./terrainGenerator.js').TerrainCell[][]} grid
   * @param {string[][]} assetsGrid
   */
  setMap(grid, assetsGrid) {
    this.grid = grid
    this.assetsGrid = assetsGrid
    this.canvas.width = grid[0].length * this.tileSize * this.scale
    this.canvas.height = grid.length * this.tileSize * this.scale
    this.ctx.imageSmoothingEnabled = false // Reset after resize

    if (!this.isRunning) {
      this.isRunning = true
      requestAnimationFrame(this.renderLoop)
    }
  }

  renderLoop(time) {
    if (!this.isRunning) return

    const deltaTime = time - this.lastTime
    this.lastTime = time
    this.animationTimer += deltaTime

    if (this.game) {
      this.game.update(deltaTime)
    }

    this.draw()

    requestAnimationFrame(this.renderLoop)
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (!this.grid) return

    const ts = this.tileSize
    const s = this.scale

    // 1. Draw solid floors
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[0].length; x++) {
        const cell = this.grid[y][x]
        const typeInfo = this.atlasData.terrains[cell.type]

        const tx = x * ts * s
        const ty = y * ts * s

        // // Figure out frame for animated tiles like water
        // let activeFrameData = null
        // if (typeInfo.frames) {
        //   const { duration } = typeInfo.frames[0]
        //   const frameIndex =
        //   Math.floor(this.animationTimer / duration) % typeInfo.frames.length
        //   activeFrameData = typeInfo.frames[frameIndex]
        // }

        // Draw Base Variation or Solid Floor
        const baseObj = cell.variant || typeInfo.solid
        if (baseObj) {
          // solid floor might animate? terrain.js currently defines 'solid' statically, and 'frames' overrides paths.
          this.ctx.drawImage(
            this.atlasImage,
            baseObj.x,
            baseObj.y,
            baseObj.w,
            baseObj.h,
            tx,
            ty,
            baseObj.w * s,
            baseObj.h * s,
          )
        }
      }
    }

    // 2. Draw autotiles (done in secondary pass to overlay borders cleanly)
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[0].length; x++) {
        const cell = this.grid[y][x]
        const typeInfo = this.atlasData.terrains[cell.type]
        if (!cell.renderParts) continue

        let activeFrameData = null
        if (typeInfo.frames) {
          const { duration } = typeInfo.frames[0]
          const frameIndex =
            Math.floor(this.animationTimer / duration) % typeInfo.frames.length
          activeFrameData = typeInfo.frames[frameIndex]
        }

        const tx = x * ts * s
        const ty = y * ts * s
        const half = 16 * s

        // Draw corners if specified
        for (const [quadrant, cornerData] of Object.entries(cell.renderParts)) {
          if (!cornerData /* || cornerData === true */) continue

          const dataSource = activeFrameData || typeInfo
          const partInfo = dataSource[cornerData.category]
          if (!partInfo || !partInfo[cornerData.dir]) continue
          const atlasTile = partInfo[cornerData.dir]

          let qx = tx
          let qy = ty
          if (quadrant === "topright" || quadrant === "bottomright") qx += half
          if (quadrant === "bottomleft" || quadrant === "bottomright") {
            qy += half
          }

          this.ctx.drawImage(
            this.atlasImage,
            atlasTile.x,
            atlasTile.y,
            atlasTile.w,
            atlasTile.h,
            qx,
            qy,
            atlasTile.w * s,
            atlasTile.h * s,
          )
        }
      }
    }

    // 3. Build Render Queue for Entities and Assets (Y-Sorting)
    const renderQueue = []

    if (this.game && this.game.entities) {
      for (const entity of this.game.entities) {
        // Player is 64x64, usually drawn from top-left, but 'x, y' in our logic represents
        // top-left of the logical 64x64 frame (hitbox is internally offset).
        // We apply a +16px shift (half a tile) visually because the player coordinates
        // align the hitbox rigidly to grid origins (which are top-left corners of 32x32 spaces)
        if (entity.draw) {
          const visX = entity.x + 16
          const visY = entity.y + 16

          let bottomY = entity.y
          if (entity.hitbox) {
            bottomY += entity.hitbox.y + entity.hitbox.height
          } else {
            bottomY += 32 // fallback
          }

          renderQueue.push({
            type: "entity",
            entity,
            visX,
            visY,
            bottomY,
          })
        }
      }
    }

    if (this.assetsGrid) {
      for (let y = 0; y < this.grid.length; y++) {
        for (let x = 0; x < this.grid[0].length; x++) {
          const assetName = this.assetsGrid[y][x]
          if (assetName) {
            const assetTile = this.atlasData.assets[assetName]

            // Typical assets might be taller than 32x32.
            // Align the bottom of the asset with the bottom of the 32x32 cell.
            const w = assetTile.w * s
            const h = assetTile.h * s

            let px = x * ts * s
            if (
              typeof assetTile.block === "object" &&
              assetTile.block.x !== undefined
            ) {
              const relX = assetTile.block.x - assetTile.x
              px -= relX * s
            } else if (assetTile.w > ts) {
              px -= ((assetTile.w - ts) / 2) * s
            }

            // Align bottom logic:
            const py = y * ts * s + ts * s - h
            let bottomY = y * ts + ts // Logical Y anchor at the bottom of the grid tile

            // Handle custom 'above' sorting anchor
            if (assetTile.above) {
              if (typeof assetTile.above === "object") {
                const relY = assetTile.above.y - assetTile.y
                const logicalPy = y * ts + ts - assetTile.h
                bottomY = logicalPy + relY + assetTile.above.h
              }
              // if above: true, we just use the default bottomY (bottom of tile)
            }

            renderQueue.push({
              type: "asset",
              image: this.atlasImage,
              sx: assetTile.x,
              sy: assetTile.y,
              sw: assetTile.w,
              sh: assetTile.h,
              dx: px,
              dy: py,
              dw: w,
              dh: h,
              bottomY,
            })
          }
        }
      }
    }

    // 4. Sort and Draw the Queue
    renderQueue.sort((a, b) => {
      if (a.bottomY === b.bottomY) {
        // Tie-breaker: Entities draw on top of assets if they share the same Y
        if (a.type === "entity" && b.type === "asset") return 1
        if (a.type === "asset" && b.type === "entity") return -1
      }
      return a.bottomY - b.bottomY
    })

    for (const item of renderQueue) {
      if (item.type === "entity") {
        item.entity.draw(this.ctx, item.visX * s, item.visY * s, s, ts)
      } else if (item.type === "asset") {
        this.ctx.drawImage(
          item.image,
          item.sx,
          item.sy,
          item.sw,
          item.sh,
          item.dx,
          item.dy,
          item.dw,
          item.dh,
        )
      }
    }

    if (this.game.debug) {
      this.ctx.strokeStyle = "rgba(0,0,0,0.1)"
      for (let y = 0; y <= this.grid.length; y++) {
        this.ctx.beginPath()
        this.ctx.moveTo(0, y * ts * s)
        this.ctx.lineTo(this.canvas.width, y * ts * s)
        this.ctx.stroke()
      }
      for (let x = 0; x <= this.grid[0].length; x++) {
        this.ctx.beginPath()
        this.ctx.moveTo(x * ts * s, 0)
        this.ctx.lineTo(x * ts * s, this.canvas.height)
        this.ctx.stroke()
      }
    }
  }
}
