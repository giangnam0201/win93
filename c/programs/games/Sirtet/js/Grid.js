export class Grid {
  /**
   * @param {number} rows
   * @param {number} columns
   */
  constructor(rows, columns) {
    this.rows = rows
    this.columns = columns

    this.cells = new Array(rows)
    for (let r = 0; r < this.rows; r++) {
      this.cells[r] = new Array(this.columns)
      for (let c = 0; c < this.columns; c++) {
        this.cells[r][c] = 0
      }
    }
  }

  clone() {
    const _grid = new Grid(this.rows, this.columns)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        _grid.cells[r][c] = this.cells[r][c]
      }
    }

    return _grid
  }

  clearLines() {
    let distance = 0
    let start

    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.isLine(r)) {
        distance++
        start ??= r
        for (let c = 0; c < this.columns; c++) {
          this.cells[r][c] = 0
        }
      } else if (distance > 0) {
        for (let c = 0; c < this.columns; c++) {
          this.cells[r + distance][c] = this.cells[r][c]
          this.cells[r][c] = 0
        }
      }
    }

    return { start, distance }
  }

  /**
   * @param {number} row
   * @returns {boolean}
   */
  isLine(row) {
    for (let c = 0; c < this.columns; c++) {
      if (this.cells[row][c] === 0) {
        return false
      }
    }

    // return false
    return true
  }

  /**
   * @param {number} row
   * @returns {boolean}
   */
  isEmptyRow(row) {
    for (let c = 0; c < this.columns; c++) {
      if (this.cells[row][c] !== 0) {
        return false
      }
    }

    return true
  }

  exceeded() {
    return !this.isEmptyRow(0) || !this.isEmptyRow(1)
  }

  height() {
    let r = 0
    for (; r < this.rows && this.isEmptyRow(r); r++);
    return this.rows - r
  }

  lines() {
    let count = 0
    for (let r = 0; r < this.rows; r++) {
      if (this.isLine(r)) {
        count++
      }
    }

    return count
  }

  holes() {
    let count = 0
    for (let c = 0; c < this.columns; c++) {
      let block = false
      for (let r = 0; r < this.rows; r++) {
        if (this.cells[r][c] !== 0) {
          block = true
        } else if (this.cells[r][c] === 0 && block) {
          count++
        }
      }
    }

    return count
  }

  blockades() {
    let count = 0
    for (let c = 0; c < this.columns; c++) {
      let hole = false
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.cells[r][c] === 0) {
          hole = true
        } else if (this.cells[r][c] !== 0 && hole) {
          count++
        }
      }
    }

    return count
  }

  aggregateHeight() {
    let total = 0
    for (let c = 0; c < this.columns; c++) {
      total += this.columnHeight(c)
    }

    return total
  }

  bumpiness() {
    let total = 0
    for (let c = 0; c < this.columns - 1; c++) {
      total += Math.abs(this.columnHeight(c) - this.columnHeight(c + 1))
    }

    return total
  }

  /**
   * @param {number} column
   * @returns {number}
   */
  columnHeight(column) {
    let r = 0
    for (; r < this.rows && this.cells[r][column] === 0; r++);
    return this.rows - r
  }

  /** @param {import("./Piece.js").Piece} piece */
  addPiece(piece) {
    for (let r = 0; r < piece.cells.length; r++) {
      for (let c = 0; c < piece.cells[r].length; c++) {
        const _r = piece.row + r
        const _c = piece.column + c
        if (piece.cells[r][c] !== 0 && _r >= 0) {
          this.cells[_r][_c] = piece.cells[r][c]
        }
      }
    }
  }

  /** @param {import("./Piece.js").Piece} piece */
  valid(piece) {
    for (let r = 0; r < piece.cells.length; r++) {
      for (let c = 0; c < piece.cells[r].length; c++) {
        const _r = piece.row + r
        const _c = piece.column + c
        if (piece.cells[r][c] !== 0) {
          if (_r < 0 || _r >= this.rows) {
            return false
          }

          if (_c < 0 || _c >= this.columns) {
            return false
          }

          if (this.cells[_r][_c] !== 0) {
            return false
          }
        }
      }
    }

    return true
  }
}
