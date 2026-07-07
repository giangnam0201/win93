// Copyright (c) 2017 Yiyuan Lee. MIT License.

const presets = {
  smart: {
    heightWeight: 0.510_066,
    linesWeight: 0.760_666,
    holesWeight: 0.356_63,
    bumpinessWeight: 0.184_483,
  },

  trained: {
    heightWeight: 0.694_684_264_103_063_9,
    linesWeight: 0.193_102_937_242_433_7,
    holesWeight: 0.665_294_837_482_087_7,
    bumpinessWeight: 0.193_669_326_573_960_74,
  },

  test: {
    heightWeight: 0.510_066,
    linesWeight: 0.960_666,
    holesWeight: 0.356_63,
    bumpinessWeight: 0.984_483,
  },

  dumb: {
    heightWeight: 0.000_000_1,
    linesWeight: 0.000_000_1,
    holesWeight: 0.000_01,
    bumpinessWeight: 0.000_01,
  },
}

export class AI {
  constructor(options) {
    this.speed = options?.speed ?? 0
    this.setWeights(options?.weights ?? "smart")
  }

  setWeights(weights) {
    if (typeof weights === "string" && weights in presets) {
      Object.assign(this, presets[weights])
    } else {
      const { smart } = presets
      this.heightWeight = weights.heightWeight ?? smart.heightWeight
      this.linesWeight = weights.linesWeight ?? smart.linesWeight
      this.holesWeight = weights.holesWeight ?? smart.holesWeight
      this.bumpinessWeight = weights.bumpinessWeight ?? smart.bumpinessWeight
    }
  }

  #best(grid, workingPieces, workingPieceIndex) {
    let best = null
    let bestScore = null
    const workingPiece = workingPieces[workingPieceIndex]

    for (let rotation = 0; rotation < 4; rotation++) {
      const piece = workingPiece.clone()
      for (let i = 0; i < rotation; i++) {
        piece.rotate(grid)
      }

      while (piece.moveLeft(grid));

      while (grid.valid(piece)) {
        const pieceSet = piece.clone()
        while (pieceSet.moveDown(grid));

        const gridClone = grid.clone()
        gridClone.addPiece(pieceSet)

        let score = null
        if (workingPieceIndex === workingPieces.length - 1) {
          score =
            -this.heightWeight * gridClone.aggregateHeight() +
            this.linesWeight * gridClone.lines() -
            this.holesWeight * gridClone.holes() -
            this.bumpinessWeight * gridClone.bumpiness()
        } else {
          score = this.#best(
            gridClone,
            workingPieces,
            workingPieceIndex + 1,
          ).score
        }

        if (score > bestScore || bestScore == null) {
          bestScore = score
          best = piece.clone()
        }

        piece.column++
      }
    }

    return { piece: best, score: bestScore }
  }

  best(grid, workingPieces) {
    return this.#best(grid, workingPieces, 0).piece
  }
}
