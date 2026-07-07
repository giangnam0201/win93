import { Piece } from "./Piece.js"

export class Bag {
  constructor() {
    this.bag = [1, 2, 3, 4, 5, 6, 7]
    this.shuffle()
    this.index = -1
  }

  nextPiece(grid) {
    this.index++
    if (this.index >= this.bag.length) {
      this.shuffle()
      this.index = 0
    }

    const piece = Piece.fromIndex(this.bag[this.index])
    // const piece = Piece.fromIndex(5)

    // Centralize
    piece.column = Math.floor((grid.columns - piece.dimension) / 2)
    return piece
  }

  shuffle() {
    let currentIndex = this.bag.length
    let temporaryValue
    let randomIndex

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex -= 1

      // And swap it with the current element.
      temporaryValue = this.bag[currentIndex]
      this.bag[currentIndex] = this.bag[randomIndex]
      this.bag[randomIndex] = temporaryValue
    }
  }
}
