import { Control } from "../../api/gui/Control.js"
import { Dragger } from "../../lib/dom/Dragger.js"
import { watchResize } from "../../lib/type/element/watchResize.js"

const GRID_LINE_WIDTH = 1

/**
 * @typedef {{
 *   column: number
 *   row: number
 * }} MatrixCell
 */

/**
 * @param {number} value
 * @param {number} max
 * @returns {number}
 */
function clampIndex(value, max) {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, Math.round(value)))
}

/**
 * @param {ArrayLike<number> | undefined} values
 * @param {number} columns
 * @param {number} rows
 * @returns {number[]}
 */
function normalizeMatrixValue(values, columns, rows) {
  return Array.from({ length: columns }, (_, index) =>
    clampIndex(values?.[index] ?? index, rows - 1),
  )
}

/**
 * @param {number} length
 * @param {number} tracks
 * @returns {{ starts: number[], sizes: number[] }}
 */
function createGridAxis(length, tracks) {
  const innerLength = Math.max(tracks, length - (tracks + 1) * GRID_LINE_WIDTH)
  const baseSize = Math.floor(innerLength / tracks)
  const remainder = innerLength - baseSize * tracks
  const starts = new Array(tracks)
  const sizes = new Array(tracks)
  let cursor = GRID_LINE_WIDTH

  for (let index = 0; index < tracks; index++) {
    const extra =
      Math.floor(((index + 1) * remainder) / tracks) -
      Math.floor((index * remainder) / tracks)
    const size = baseSize + extra
    starts[index] = cursor
    sizes[index] = size
    cursor += size + GRID_LINE_WIDTH
  }

  return { starts, sizes }
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} columns
 * @param {number} rows
 */
function getGridLayout(width, height, columns, rows) {
  const columnAxis = createGridAxis(width, columns)
  const rowAxis = createGridAxis(height, rows)

  return {
    columnStarts: columnAxis.starts,
    columnWidths: columnAxis.sizes,
    rowStarts: rowAxis.starts,
    rowHeights: rowAxis.sizes,
  }
}

/**
 * @param {number} value
 * @param {number[]} starts
 * @param {number[]} sizes
 * @returns {number}
 */
function getGridTrackIndex(value, starts, sizes) {
  for (let index = 0; index < starts.length; index++) {
    if (value < starts[index]) {
      return Math.max(0, index - 1)
    }

    if (value < starts[index] + sizes[index]) {
      return index
    }
  }

  return starts.length - 1
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {HTMLCanvasElement} canvas
 * @param {number} columns
 * @param {number} rows
 * @returns {MatrixCell}
 */
function getCellFromPoint(clientX, clientY, canvas, columns, rows) {
  const bounds = canvas.getBoundingClientRect()
  const { columnStarts, columnWidths, rowStarts, rowHeights } = getGridLayout(
    bounds.width,
    bounds.height,
    columns,
    rows,
  )
  const x = Math.min(
    Math.max(clientX - bounds.left, 0),
    Math.max(0, bounds.width - 1),
  )
  const y = Math.min(
    Math.max(clientY - bounds.top, 0),
    Math.max(0, bounds.height - 1),
  )

  return {
    column: clampIndex(
      getGridTrackIndex(x, columnStarts, columnWidths),
      columns - 1,
    ),
    row: clampIndex(
      rows - 1 - getGridTrackIndex(y, rowStarts, rowHeights),
      rows - 1,
    ),
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number[]} value
 * @param {number} columns
 * @param {number} rows
 */
function drawMatrix(canvas, value, columns, rows) {
  const rect = canvas.getBoundingClientRect()
  const dpr = globalThis.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const bufferWidth = Math.max(1, Math.round(width * dpr))
  const bufferHeight = Math.max(1, Math.round(height * dpr))

  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth
    canvas.height = bufferHeight
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.imageSmoothingEnabled = false
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const { columnStarts, columnWidths, rowStarts, rowHeights } = getGridLayout(
    width,
    height,
    columns,
    rows,
  )

  ctx.clearRect(0, 0, width, height)

  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const displayRow = rows - row - 1
      const x = columnStarts[column]
      const y = rowStarts[displayRow]
      const isSelected = value[column] === row

      if (!isSelected) {
        ctx.fillStyle = "#000"
        ctx.fillRect(x, y, columnWidths[column], rowHeights[displayRow])
      }
    }
  }
}

/**
 * @param {number[] | string | undefined} value
 * @returns {number[] | undefined}
 */
function parseValue(value) {
  if (Array.isArray(value)) return value
  if (value === "") return undefined

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * @param {number[]} left
 * @param {number[]} right
 * @returns {boolean}
 */
function isSameValue(left, right) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false
  }
  return true
}

/**
 * @extends {Control}
 */
export class MatrixControl extends Control {
  static plan = {
    tag: "ui-matrix",
    options: {
      dispatchChange: false,
    },
    props: {
      cols: true,
      rows: true,
    },
  }

  /** @type {HTMLCanvasElement} */
  #canvasEl

  /** @type {number[]} */
  #value = []

  #didChangeDuringDrag = false

  get cols() {
    return Number(this.getAttribute("cols") ?? 0)
  }
  set cols(value) {
    this.setAttribute("cols", String(value))
  }

  get rows() {
    return Number(this.getAttribute("rows") ?? 0)
  }
  set rows(value) {
    this.setAttribute("rows", String(value))
  }

  get value() {
    return this.#value.slice()
  }
  set value(value) {
    this.setValue(value)
  }

  setValue(value, options) {
    const nextValue = normalizeMatrixValue(
      parseValue(value),
      this.cols,
      this.rows,
    )

    if (isSameValue(this.#value, nextValue)) {
      this.valueChanged()
      return
    }

    this.#value = nextValue
    super.setValue(JSON.stringify(nextValue), { ...options, fromInput: true })
    this.valueChanged()
  }

  valueChanged() {
    if (!this.#canvasEl) return
    drawMatrix(this.#canvasEl, this.#value, this.cols, this.rows)
  }

  render() {
    return {
      tag: "canvas.fit",
      created: (el) => {
        this.#canvasEl = /** @type {HTMLCanvasElement} */ (el)
      },
    }
  }

  created() {
    const { signal } = this

    const syncCell = (event) => {
      const { column, row } = getCellFromPoint(
        event.clientX,
        event.clientY,
        this.#canvasEl,
        this.cols,
        this.rows,
      )
      if (this.#value[column] === row) return false

      const nextValue = this.#value.slice()
      nextValue[column] = row
      this.setValue(nextValue, { fromInput: true })
      this.dispatchEvent(new Event("input", { bubbles: true }))
      this.#didChangeDuringDrag = true
      return true
    }

    const dispatchPendingChange = () => {
      if (!this.#didChangeDuringDrag) return
      this.#didChangeDuringDrag = false
      this.dispatchEvent(new Event("change", { bubbles: true }))
    }

    this.dragger = new Dragger(this.#canvasEl, {
      signal,
      init: (event) => {
        this.#didChangeDuringDrag = false
        syncCell(event)
      },
      drag: (x, y, event) => {
        syncCell(event)
      },
      stop: () => dispatchPendingChange(),
    })

    this.#canvasEl.addEventListener(
      "pointerup",
      () => {
        if (this.dragger?.isDragging || !this.#didChangeDuringDrag) return
        dispatchPendingChange()
      },
      { signal },
    )

    watchResize(
      this.#canvasEl, //
      { signal /*, debounce: true*/ },
      () => this.valueChanged(),
    )

    this.valueChanged()
  }

  updated(key) {
    if (key === "cols" || key === "rows") {
      this.#value = normalizeMatrixValue(this.#value, this.cols, this.rows)
      super.setValue(JSON.stringify(this.#value), { fromInput: true })
      this.valueChanged()
    }

    if (key === "value") {
      this.setValue(this.getAttribute("value"))
    }
  }
}

export const matrix = Control.define(MatrixControl)
