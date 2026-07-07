export class Piece {
  constructor(cells) {
    this.cells = cells
    this.dimension = this.cells.length
    this.row = 0
    this.column = 0
  }

  static fromIndex(index) {
    switch (index) {
      case 1: // O
        return new Piece([
          [1, 1],
          [1, 1],
        ])
      case 2: // J
        return new Piece([
          [2, 0, 0],
          [2, 2, 2],
          [0, 0, 0],
        ])
      case 3: // L
        return new Piece([
          [0, 0, 3],
          [3, 3, 3],
          [0, 0, 0],
        ])
      case 4: // Z
        return new Piece([
          [4, 4, 0],
          [0, 4, 4],
          [0, 0, 0],
        ])
      case 5: // S
        return new Piece([
          [0, 5, 5],
          [5, 5, 0],
          [0, 0, 0],
        ])
      case 6: // T
        return new Piece([
          [0, 6, 0],
          [6, 6, 6],
          [0, 0, 0],
        ])
      case 7: // I
        return new Piece([
          [0, 0, 0, 0],
          [7, 7, 7, 7],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ])
      default:
    }
  }

  clone() {
    const piece = new Piece(structuredClone(this.cells))
    piece.row = this.row
    piece.column = this.column
    return piece
  }

  canMoveLeft(grid) {
    for (let r = 0; r < this.cells.length; r++) {
      for (let c = 0; c < this.cells[r].length; c++) {
        const _r = this.row + r
        const _c = this.column + c - 1
        if (this.cells[r][c] !== 0) {
          if (!(_c >= 0 && grid.cells[_r][_c] === 0)) {
            return false
          }
        }
      }
    }

    return true
  }

  canMoveRight(grid) {
    for (let r = 0; r < this.cells.length; r++) {
      for (let c = 0; c < this.cells[r].length; c++) {
        const _r = this.row + r
        const _c = this.column + c + 1
        if (this.cells[r][c] !== 0) {
          if (!(_c >= 0 && grid.cells[_r][_c] === 0)) {
            return false
          }
        }
      }
    }

    return true
  }

  canMoveDown(grid) {
    for (let r = 0; r < this.cells.length; r++) {
      for (let c = 0; c < this.cells[r].length; c++) {
        const _r = this.row + r + 1
        const _c = this.column + c
        if (this.cells[r][c] !== 0 && _r >= 0) {
          if (!(_r < grid.rows && grid.cells[_r][_c] === 0)) {
            return false
          }
        }
      }
    }

    return true
  }

  moveLeft(grid) {
    if (!this.canMoveLeft(grid)) return false
    this.column--
    return true
  }

  moveRight(grid) {
    if (!this.canMoveRight(grid)) return false
    this.column++
    return true
  }

  moveDown(grid) {
    if (!this.canMoveDown(grid)) return false
    this.row++
    // if (!this.canMoveDown(grid)) return false
    // this.row++
    // if (!this.canMoveDown(grid)) return false
    // this.row++
    // if (!this.canMoveDown(grid)) return false
    // this.row++
    return true
  }

  rotateCells() {
    const cells = new Array(this.dimension)
    for (let r = 0; r < this.dimension; r++) {
      cells[r] = new Array(this.dimension)
    }

    switch (
      this.dimension // Assumed square matrix
    ) {
      case 2:
        cells[0][0] = this.cells[1][0]
        cells[0][1] = this.cells[0][0]
        cells[1][0] = this.cells[1][1]
        cells[1][1] = this.cells[0][1]
        break
      case 3:
        cells[0][0] = this.cells[2][0]
        cells[0][1] = this.cells[1][0]
        cells[0][2] = this.cells[0][0]
        cells[1][0] = this.cells[2][1]
        cells[1][1] = this.cells[1][1]
        cells[1][2] = this.cells[0][1]
        cells[2][0] = this.cells[2][2]
        cells[2][1] = this.cells[1][2]
        cells[2][2] = this.cells[0][2]
        break
      case 4:
        cells[0][0] = this.cells[3][0]
        cells[0][1] = this.cells[2][0]
        cells[0][2] = this.cells[1][0]
        cells[0][3] = this.cells[0][0]
        cells[1][3] = this.cells[0][1]
        cells[2][3] = this.cells[0][2]
        cells[3][3] = this.cells[0][3]
        cells[3][2] = this.cells[1][3]
        cells[3][1] = this.cells[2][3]
        cells[3][0] = this.cells[3][3]
        cells[2][0] = this.cells[3][2]
        cells[1][0] = this.cells[3][1]

        cells[1][1] = this.cells[2][1]
        cells[1][2] = this.cells[1][1]
        cells[2][2] = this.cells[1][2]
        cells[2][1] = this.cells[2][2]
        break
      default:
    }

    this.cells = cells
  }

  computeRotateOffset(grid) {
    const _piece = this.clone()
    _piece.rotateCells()
    if (grid.valid(_piece)) {
      return {
        rowOffset: _piece.row - this.row,
        columnOffset: _piece.column - this.column,
      }
    }

    // Kicking
    const initialRow = _piece.row
    const initialCol = _piece.column

    for (let i = 0; i < _piece.dimension - 1; i++) {
      _piece.column = initialCol + i
      if (grid.valid(_piece)) {
        return {
          rowOffset: _piece.row - this.row,
          columnOffset: _piece.column - this.column,
        }
      }

      for (let j = 0; j < _piece.dimension - 1; j++) {
        _piece.row = initialRow - j
        if (grid.valid(_piece)) {
          return {
            rowOffset: _piece.row - this.row,
            columnOffset: _piece.column - this.column,
          }
        }
      }

      _piece.row = initialRow
    }

    _piece.column = initialCol

    for (let i = 0; i < _piece.dimension - 1; i++) {
      _piece.column = initialCol - i
      if (grid.valid(_piece)) {
        return {
          rowOffset: _piece.row - this.row,
          columnOffset: _piece.column - this.column,
        }
      }

      for (let j = 0; j < _piece.dimension - 1; j++) {
        _piece.row = initialRow - j
        if (grid.valid(_piece)) {
          return {
            rowOffset: _piece.row - this.row,
            columnOffset: _piece.column - this.column,
          }
        }
      }

      _piece.row = initialRow
    }

    _piece.column = initialCol

    return null
  }

  rotate(grid) {
    const offset = this.computeRotateOffset(grid)
    if (offset !== null) {
      this.rotateCells()
      this.row += offset.rowOffset
      this.column += offset.columnOffset
    }
  }
}
