import { repaintThrottle } from "../../../../../42/lib/timing/repaintThrottle.js"

function intToRGB(v) {
  return `${`rgb(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff})`}`
}

function cloneCanvas(oldCanvas) {
  const newCanvas = document.createElement("canvas")
  const context = newCanvas.getContext("2d")
  newCanvas.width = oldCanvas.width
  newCanvas.height = oldCanvas.height
  context.drawImage(oldCanvas, 0, 0)
  return newCanvas
}

export class Renderer {
  /** @type {Function} */
  onResize

  constructor(options) {
    this.canvas = /** @type {HTMLCanvasElement} */ (
      options?.canvas ?? document.createElement("canvas")
    )

    this.ctx = this.canvas.getContext("2d")

    this.palette = options?.palette ?? [
      0x00_00_00, // Empty
      0xff_ff_33, // O / yellow
      0x88_99_ff, // J / blue
      0xff_aa_33, // L / orange
      0xff_44_44, // Z / red
      0x33_ee_33, // S / green
      0xdd_55_ee, // T / purple 0x9900ff
      0x88_ff_ff, // I / cyan
    ]

    const columns = options?.columns ?? 10
    const rows = options?.rows ?? 20

    this.borders = options?.borders ?? true
    this.reverse = options?.reverse ?? false

    if (options?.square) {
      this.square = options?.square ?? 20
      this.canvas.width = this.square * columns
      this.canvas.height = this.square * rows
    } else {
      const initialWidth = this.canvas.width
      const initialHeight = this.canvas.height
      const applyRect = async () => {
        this.canvas.width = initialWidth
        this.canvas.height = initialHeight
        const rect = this.canvas.getBoundingClientRect()

        let w = initialWidth
        let h = initialHeight
        if (rect.width > 0) w = rect.width
        if (rect.height > 0) h = rect.height

        this.square = Math.round(Math.min(w / columns, h / rows))
        this.canvas.width = this.square * columns
        this.canvas.height = this.square * rows
        if (this.centeredPiece) this.drawPieceCentered(this.centeredPiece)
      }
      applyRect()

      window.addEventListener(
        "resize",
        repaintThrottle(() => applyRect()),
      )
    }
  }

  clear() {
    this.#clone = undefined
    this.ctx.save()
    this.ctx.fillStyle = "#000"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.restore()
  }

  #clone
  toggleLine(start, distance, hide) {
    this.#clone ??= cloneCanvas(this.canvas)
    if (hide) {
      this.ctx.drawImage(this.#clone, 0, 0)
      this.ctx.fillStyle = "#000a"
    } else {
      this.ctx.drawImage(this.#clone, 0, 0)
      this.ctx.fillStyle = "#fff6"
    }

    this.ctx.fillRect(
      0,
      start * this.square,
      this.canvas.width,
      distance * this.square,
    )
  }

  drawSquare(x, y, color, square = this.square) {
    const fillsquare = Math.round(square)
    x = Math.round(x)
    y = Math.round(y)
    this.ctx.fillStyle = intToRGB(this.palette[color])
    this.ctx.fillRect(x, y, fillsquare, fillsquare)

    if (!this.borders || square < 5) return

    const size = Math.round(square)
    const border = 1
    const lightOp = 0.7
    const shadowOp = 0.3

    if (this.reverse) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${lightOp})`
      // Bottom highlight
      this.ctx.fillRect(x, y + size - border, size, border)

      // Right highlight
      this.ctx.fillRect(x + size - border, y, border, size)

      // Top shadow
      this.ctx.fillStyle = `rgba(0, 0, 0, ${shadowOp})`
      this.ctx.fillRect(x, y, size, border)

      // Left shadow
      this.ctx.fillRect(x, y, border, size)
    } else {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${lightOp})`
      // Top highlight
      this.ctx.fillRect(x, y, size, border)

      // Left highlight
      this.ctx.fillRect(x, y, border, size)

      // Bottom shadow
      this.ctx.fillStyle = `rgba(0, 0, 0, ${shadowOp})`
      this.ctx.fillRect(x, y + size - border, size, border)

      // Right shadow
      this.ctx.fillRect(x + size - border, y, border, size)
    }
  }

  drawPiece(piece, xOffset = 0, yOffset = 0, square = this.square) {
    for (let r = 0; r < piece.dimension; r++) {
      for (let c = 0; c < piece.dimension; c++) {
        if (piece.cells[r][c] === 0) continue
        const x = square * (c + piece.column) + xOffset
        const y = square * (r + piece.row - 2) + yOffset
        this.drawSquare(x, y, piece.cells[r][c], square)
      }
    }
  }

  drawPieceCentered(piece, square = this.square) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.centeredPiece = piece

    piece.row = 2
    piece.column = 0

    const xOffset =
      piece.dimension === 2
        ? square
        : piece.dimension === 3
          ? Math.round(square / 2)
          : piece.dimension === 4
            ? 0
            : null
    const yOffset =
      piece.dimension === 2
        ? square
        : piece.dimension === 3
          ? square
          : piece.dimension === 4
            ? Math.round(square / 2)
            : null

    this.drawPiece(piece, xOffset, yOffset, square)
  }
}
