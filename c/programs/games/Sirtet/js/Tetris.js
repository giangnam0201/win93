import { Emitter } from "../../../../../42/lib/class/Emitter.js"
import { Timer } from "../../../../../42/lib/timing/Timer.js"
import { Bag } from "./Bag.js"
import { Grid } from "./Grid.js"
import { AI } from "./AI.js"
import { Renderer } from "./Renderer.js"
import { configure } from "../../../../../42/api/configure.js"
import { repaintThrottle } from "../../../../../42/lib/timing/repaintThrottle.js"

const DEFAULT = {
  rows: 20,
  columns: 10,
  interval: 300,
  square: 16,
  dropSpeed: 1,
}

// const debugGrid = [
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 5, 5, 0, 0, 0],
//   [0, 0, 0, 0, 5, 5, 0, 0, 0, 0],
//   [0, 0, 7, 0, 3, 3, 7, 7, 7, 7],
//   [1, 1, 7, 0, 2, 3, 0, 0, 5, 0],
//   [1, 1, 7, 0, 2, 3, 1, 1, 5, 5],
//   [0, 4, 4, 3, 3, 3, 0, 6, 6, 6],
// ]

export class Tetris extends Emitter {
  constructor(options) {
    super()
    this.config = configure(DEFAULT, options)

    this.grid = new Grid(this.config.rows + 2, this.config.columns)
    // this.grid.cells = debugGrid

    this.bag = new Bag()
    this.ai = new AI(options?.ai)
    this.timer = new Timer(() => this.tick(), this.config.interval)

    this.score = 0
    this.workingPieces = [null, this.bag.nextPiece(this.grid)]
    this.workingPiece = null

    this.dropSpeed = this.config.dropSpeed

    this.renderer = options?.renderer ?? new Renderer(options)
    // this.renderer.onResize = () => this.draw()

    this.cycle = options?.cycle ?? true
    this.aiEnabled = options?.aiEnabled ?? false
    this.keyboardEnabled = options?.aiEnabled ? false : options?.keyboardEnabled

    this.lineBlink = {}

    window.addEventListener("keydown", (e) => this.onKeyDown(e))
    window.addEventListener(
      "resize",
      repaintThrottle(() => this.draw()),
    )
  }

  get square() {
    return this.renderer.square
  }
  set square(value) {
    this.renderer.square = value
  }

  #aiEnabled
  get aiEnabled() {
    return this.#aiEnabled
  }
  set aiEnabled(value) {
    this.#aiEnabled = Boolean(value)
    this.keyboardEnabled = !this.#aiEnabled
  }

  start() {
    this.timer.start()
    this.startTurn()
  }

  stop() {
    this.timer.stop()
    this.timer.interval = this.config.interval
    this.#currentInterval = undefined
    this.#keepDropping = false
    this.#dropSpeed = undefined
  }

  reset() {
    this.stop()
    this.grid = new Grid(this.grid.rows, this.grid.columns)
    this.bag = new Bag()
    this.score = 0
    this.emit("score", this.score)
    this.workingPieces = [null, this.bag.nextPiece(this.grid)]
    this.workingPiece = null
    this.drawGrid()
  }

  gameover() {
    this.timer.stop()
    this.timer.interval = this.config.interval
    this.keyboardEnabled = false
    this.emit("gameover")
  }

  #dropSpeed
  #keepDropping
  #currentInterval
  dropPiece(keepDropping) {
    if (this.#currentInterval !== undefined) return
    this.#keepDropping = keepDropping
    this.#currentInterval = this.timer.interval
    this.#dropSpeed = this.dropSpeed
    this.timer.interval = 0
    this.timer.start()
    this.tick()
  }

  draw(verticalOffset = 0) {
    this.drawGrid()
    if (this.workingPiece) {
      this.renderer.drawPiece(this.workingPiece, 0, verticalOffset)
    }
  }

  drawGrid() {
    this.renderer.clear()
    for (let r = 2; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.columns; c++) {
        if (this.grid.cells[r][c] === 0) continue
        const x = this.square * c
        const y = this.square * (r - 2)
        this.renderer.drawSquare(x, y, this.grid.cells[r][c])
      }
    }
  }

  // Process start of turn
  startTurn() {
    if (this.#currentInterval && !this.#keepDropping) {
      this.timer.interval = this.#currentInterval
      this.#currentInterval = undefined
      this.#dropSpeed = undefined

      if (this.#keepDropping === false) {
        this.timer.stop()
        this.workingPiece = undefined
        return
      }
    }

    const { workingPieces } = this
    // Shift working pieces
    for (let i = 0; i < workingPieces.length - 1; i++) {
      workingPieces[i] = workingPieces[i + 1]
    }

    workingPieces[workingPieces.length - 1] = this.bag.nextPiece(this.grid)
    this.workingPiece = workingPieces[0]

    this.draw()
    this.emit("next", this.workingPieces[1].clone())

    if (this.#aiEnabled) {
      this.keyboardEnabled = false
      this.workingPiece = this.ai.best(this.grid, this.workingPieces)
      this.dropPiece(true)
    } else {
      this.#keepDropping = false
      this.keyboardEnabled = true
    }
  }

  endTurn() {
    this.grid.addPiece(this.workingPiece)

    const { start, distance } = this.grid.clearLines()
    this.score += distance

    if (distance) {
      this.lineBlink.repeat = 16
      this.lineBlink.start = start
      this.lineBlink.distance = distance
      this.emit("score", this.score)
      if (this.grid.exceeded()) this.gameover()
      return true
    }

    this.draw()
  }

  tick() {
    // If line clear animation
    if (this.lineBlink.repeat) {
      this.renderer.toggleLine(
        this.lineBlink.start - this.lineBlink.distance - 1,
        this.lineBlink.distance,
        this.lineBlink.repeat > 12
          ? true
          : this.lineBlink.repeat > 8
            ? false
            : this.lineBlink.repeat > 4,
      )

      this.lineBlink.repeat--

      if (this.lineBlink.repeat === 0) {
        this.startTurn()
        this.drawGrid()
      }

      return
    }

    if (!this.workingPiece) return

    // If working piece has not reached bottom
    if (this.workingPiece.canMoveDown(this.grid)) {
      this.workingPiece.moveDown(this.grid)

      if (this.#dropSpeed) {
        for (let i = 0, l = this.#dropSpeed; i < l; i++) {
          if (this.workingPiece.canMoveDown(this.grid)) {
            this.workingPiece.moveDown(this.grid)
          } else break
        }
      }

      this.draw()
      return
    }

    // If working piece has reached bottom
    if (this.endTurn()) return

    // If game cannot continue because grid has been exceeded
    if (this.grid.exceeded()) return this.gameover()

    // If game can still continue
    this.startTurn()
    // if (this.cycle !== false) this.startTurn()
    // this.cycle = true
  }

  get paused() {
    return this.timer.paused
  }

  set paused(value) {
    this.timer.paused = value
  }

  play() {
    this.paused = false
  }

  pause() {
    this.paused = true
  }

  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }

  // Process keys
  onKeyDown(event) {
    if (!this.keyboardEnabled) return

    if (event.key === "p") {
      this.togglePause()
      return
    }

    switch (event.code) {
      case "Space":
        this.keyboardEnabled = false
        this.dropPiece()
        break

      case "ArrowDown":
        this.tick()
        this.timer.start()
        break

      case "ArrowLeft":
        if (this.workingPiece.canMoveLeft(this.grid)) {
          this.workingPiece.moveLeft(this.grid)
          this.draw()
        }
        break

      case "ArrowRight":
        if (this.workingPiece.canMoveRight(this.grid)) {
          this.workingPiece.moveRight(this.grid)
          this.draw()
        }
        break

      case "ArrowUp":
        this.workingPiece.rotate(this.grid)
        this.draw()
        break

      default:
    }
  }
}
