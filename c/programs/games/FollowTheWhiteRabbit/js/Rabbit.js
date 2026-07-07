/* eslint-disable complexity */
import { Sprite } from "./Sprite.js"
import { astar, Graph } from "../../../../../42/lib/algo/astar.js"

export class Rabbit extends Sprite {
  constructor(game, image, spriteData, options = {}) {
    super(game, image, spriteData)

    this.speed = options.speed ?? 1
    this.maxSpeed = options.maxSpeed ?? 10
    this.frameDuration = 80

    this.state = "idle" // idle, prepare, jump
    this.direction = "down"

    this.x = 0
    this.y = 0

    this.startX = 0
    this.startY = 0
    this.targetX = 0
    this.targetY = 0

    this.hitbox = {
      x: 16,
      y: 16,
      width: 32,
      height: 32,
    }

    // Timers
    this.idleTimer = 0
    this.prepareTimer = 0
    this.jumpTimer = 0
    this.path = null
    this.steps = 0

    this._updateAnimation()

    this.userControlled = false
    this.debug = options.debug ?? this.game.debug

    window.addEventListener("keydown", (e) => this._handleKeydown(e))
  }

  get speedFactor() {
    const s = Math.max(1, Math.min(this.speed, this.maxSpeed))
    if (s > 3) {
      // The rabbit skips the 'prepare' jump animation phase when speed > 3.
      // Base tile time with prepare averages ~765ms. Without prepare it is ~420ms.
      // We scale the speed factor by 765/420 (~1.82) to perfectly prevent a sudden overall velocity jump.
      return 765 / 420 / s
    }
    return 1 / s
  }

  _handleKeydown(e) {
    const isArrowKey = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.key)
    if (isArrowKey) {
      e.preventDefault()
      if (this.debug !== true) return

      this.userControlled = true

      if (this.state === "idle") {
        if (e.key === "ArrowUp") this.direction = "up"
        if (e.key === "ArrowDown") this.direction = "down"
        if (e.key === "ArrowLeft") this.direction = "left"
        if (e.key === "ArrowRight") this.direction = "right"
        if (this.speed > 3) {
          this.setState("jump")
        } else {
          this.setState("prepare")
          this.prepareTimer = 150 * this.speedFactor
        }
      }
    }
  }

  _getGraph() {
    if (!this.game) return null
    if (this._graph && this.game.grid === this._lastRawGrid) {
      return this._graph
    }

    const ts = this.game.tileSize
    const w = this.game.grid[0].length
    const h = this.game.grid.length

    const gridIn = []

    const dw = this.game.desktopWidth || this.game.mapWidth
    const dh = this.game.desktopHeight || this.game.mapHeight

    for (let x = 0; x < w; x++) {
      gridIn[x] = []
      for (let y = 0; y < h; y++) {
        const entityX = x * ts - this.hitbox.x
        const entityY = y * ts - this.hitbox.y
        let canMove = this.game.canMoveTo(entityX, entityY, this.hitbox)

        if (canMove) {
          const bx = entityX + this.hitbox.x
          const by = entityY + this.hitbox.y
          if (
            bx < 0 ||
            bx + this.hitbox.width > dw ||
            by < 0 ||
            by + this.hitbox.height > dh
          ) {
            canMove = false
          }
        }

        gridIn[x][y] = canMove ? 1 : 0
      }
    }

    this._graph = new Graph(gridIn)
    this._lastRawGrid = this.game.grid
    return this._graph
  }

  _pickNewPath() {
    const graph = this._getGraph()
    if (!graph) return

    const ts = this.game.tileSize
    const w = this.game.grid[0].length
    const h = this.game.grid.length

    const cx = Math.max(
      0,
      Math.min(w - 1, Math.round((this.x + this.hitbox.x) / ts)),
    )
    const cy = Math.max(
      0,
      Math.min(h - 1, Math.round((this.y + this.hitbox.y) / ts)),
    )

    const startNode = graph.grid[cx]?.[cy]
    if (!startNode || startNode.isWall()) {
      this.path = []
      return
    }

    const sectionX = Math.floor(Math.random() * 3)
    const sectionY = Math.floor(Math.random() * 3)

    const minX = Math.floor(w * (sectionX / 3))
    const maxX = Math.max(minX, Math.floor(w * ((sectionX + 1) / 3)) - 1)
    const minY = Math.floor(h * (sectionY / 3))
    const maxY = Math.max(minY, Math.floor(h * ((sectionY + 1) / 3)) - 1)

    let tx = cx
    let ty = cy
    let targetNode = null

    for (let i = 0; i < 50; i++) {
      tx = minX + Math.floor(Math.random() * (maxX - minX + 1))
      ty = minY + Math.floor(Math.random() * (maxY - minY + 1))
      const node = graph.grid[tx]?.[ty]
      if (node && !node.isWall() && (tx !== cx || ty !== cy)) {
        targetNode = node
        break
      }
    }

    if (!targetNode) {
      targetNode = startNode
    }

    this.path = astar(graph, startNode, targetNode, { closest: true })
  }

  setState(newState) {
    if (this.state === newState) return

    if (newState === "jump") {
      this.startX = this.x
      this.startY = this.y

      const jumpDistance = 32
      let dx = 0
      let dy = 0

      if (this.direction === "up") dy = -jumpDistance
      if (this.direction === "down") dy = jumpDistance
      if (this.direction === "left") dx = -jumpDistance
      if (this.direction === "right") dx = jumpDistance

      this.targetX = this.x + dx
      this.targetY = this.y + dy

      const tileLeft = this.targetX + this.hitbox.x
      const tileTop = this.targetY + this.hitbox.y
      const tileRight = tileLeft + this.hitbox.width
      const tileBottom = tileTop + this.hitbox.height

      const dw = this.game.desktopWidth || this.game.mapWidth
      const dh = this.game.desktopHeight || this.game.mapHeight

      const isInsideMap =
        tileLeft >= 0 && tileRight <= dw && tileTop >= 0 && tileBottom <= dh

      if (
        this.game &&
        (!isInsideMap ||
          !this.game.canMoveTo(this.targetX, this.targetY, this.hitbox))
      ) {
        const flip = { up: "down", down: "up", left: "right", right: "left" }
        this.direction = flip[this.direction]
        this.path = null
        this.setState("idle")
        this.idleTimer = 100 * this.speedFactor
        return
      }

      this.jumpTimer = 320 * this.speedFactor
      this.frameDuration = Math.min(
        this.jumpTimer / 2,
        Math.max(15, 80 * this.speedFactor),
      )

      this.currentFrameIndex = 0
      this.frameTimer = 0
    }

    if (newState === "prepare") {
      this.frameDuration = 80 * this.speedFactor
      this.prepareTimer = (320 + Math.random() * 50) * this.speedFactor
      this.currentFrameIndex = 0
      this.frameTimer = 0
    }

    if (newState === "idle") {
      this.idleTimer = Math.random() * 200 * this.speedFactor
    }

    this.state = newState
    this._updateAnimation()
  }

  _updateAnimation() {
    let animBase = this.state === "jump" ? "jump" : "prepare"
    if (this.state === "idle") animBase = "prepare"

    if (this.speedFactor <= 0.25 && this.state !== "jump") {
      animBase = "jump"
    }

    let animDir = this.direction
    let isMirrored = false
    if (animDir === "left") {
      animDir = "right"
      isMirrored = true
    }

    this.play(`${animBase}_${animDir}`, isMirrored)
  }

  _handleIdleFinished() {
    if (!this.path || this.path.length === 0) {
      this._pickNewPath()
    }

    if (this.path && this.path.length > 0) {
      const nextNode = this.path.shift()

      const ts = this.game.tileSize
      const cx = Math.round((this.x + this.hitbox.x) / ts)
      const cy = Math.round((this.y + this.hitbox.y) / ts)

      if (nextNode.x < cx) {
        this.direction = "left"
      } else if (nextNode.x > cx) {
        this.direction = "right"
      } else if (nextNode.y < cy) {
        this.direction = "up"
      } else if (nextNode.y > cy) {
        this.direction = "down"
      }
    } else {
      const flip = { up: "down", down: "up", left: "right", right: "left" }
      this.direction = flip[this.direction]
    }

    if (this.speed > 3) {
      this.setState("jump")
    } else {
      this.setState("prepare")
    }
  }

  update(deltaTime, gameInstance) {
    this.game = gameInstance

    let timeRemaining = deltaTime
    let maxLoops = 20

    while (timeRemaining > 0 && maxLoops-- > 0) {
      if (this.state === "idle") {
        if (this.userControlled) {
          timeRemaining = 0
        } else if (timeRemaining >= this.idleTimer) {
          timeRemaining -= this.idleTimer
          this.idleTimer = 0

          this._handleIdleFinished()
        } else {
          this.idleTimer -= timeRemaining
          timeRemaining = 0
        }
      } else if (this.state === "prepare") {
        if (timeRemaining >= this.prepareTimer) {
          timeRemaining -= this.prepareTimer
          this.prepareTimer = 0
          this.setState("jump")
        } else {
          this.prepareTimer -= timeRemaining
          timeRemaining = 0
        }
      } else if (this.state === "jump") {
        const totalDuration = 320 * this.speedFactor

        if (timeRemaining >= this.jumpTimer) {
          timeRemaining -= this.jumpTimer
          this.jumpTimer = 0
          this.x = this.targetX
          this.y = this.targetY
          this.steps++

          if (this.steps % 10 === 0) {
            this.speed += 0.1
            if (this.speed > this.maxSpeed) {
              this.speed = this.maxSpeed
            }
          }

          // console.log("Steps:", this.steps, "Speed:", this.speed)
          this.setState("idle")
        } else {
          this.jumpTimer -= timeRemaining
          timeRemaining = 0

          const progress = Math.min(
            1,
            Math.max(0, (totalDuration - this.jumpTimer) / totalDuration),
          )
          this.x = this.startX + (this.targetX - this.startX) * progress
          this.y = this.startY + (this.targetY - this.startY) * progress
        }
      }
    }

    // Boundary & Collision escape logic
    if (this.game) {
      const dw = this.game.desktopWidth || this.game.mapWidth
      const dh = this.game.desktopHeight || this.game.mapHeight
      const bx = this.x + this.hitbox.x
      const by = this.y + this.hitbox.y

      const isOutsideBounds =
        bx < 0 ||
        bx + this.hitbox.width > dw ||
        by < 0 ||
        by + this.hitbox.height > dh

      if (
        isOutsideBounds ||
        !this.game.canMoveTo(this.x, this.y, this.hitbox)
      ) {
        const flip = { up: "down", down: "up", left: "right", right: "left" }
        this.direction = flip[this.direction]
        this.path = null
        this.setState("idle")
        this.idleTimer = 10 * this.speedFactor
      }
    }

    if (
      this.state === "jump" ||
      this.state === "prepare" ||
      this.speedFactor <= 0.25
    ) {
      super.update(deltaTime)
    }
  }
}
