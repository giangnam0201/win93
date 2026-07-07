import { alert } from "../../../../42/ui/layout/dialog.js"
import { wrapCursor } from "../../../../42/lib/dom/cursor.js"
import { Chess, DEFAULT_POSITION } from "./js/chess.js"
import { Chessboard } from "./js/chessboard.js"

let board
let game

const state = { difficulty: 3, mode: "960" }

// @src https://github.com/mi-g/chess960gen
// Original author: Michel Gutierrez (http://www.jocly.com/)

function chess960Gen(seed) {
  const cols = []
  const empty = [0, 1, 2, 3, 4, 5, 6, 7]
  let fullSeed = 960

  if (seed === undefined) {
    seed = Math.floor(Math.random() * 960)
  } else {
    seed %= 960
  }

  function rand(range) {
    fullSeed /= range
    const value = Math.floor(seed / fullSeed)
    seed %= fullSeed
    return value
  }

  function assign(piece, col) {
    cols[col] = piece
    empty.splice(empty.indexOf(col), 1)
  }

  const b1 = rand(4) * 2
  const b2 = rand(4) * 2 + 1
  assign("B", b1)
  assign("B", b2)
  assign("Q", empty[rand(6)])
  const nn = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
  ][rand(10)]
  assign("N", empty[nn[1]])
  assign("N", empty[nn[0]])
  assign("R", empty[0])
  assign("K", empty[0])
  assign("R", empty[0])
  return cols.join("")
}

// let positionCount

const minimaxRoot = function (depth, game, isMaximizingPlayer) {
  const newGameMoves = game.moves()
  let bestMove = -9999
  let bestMoveFound

  for (const newGameMove of newGameMoves) {
    game.move(newGameMove)
    const value = minimax(depth - 1, game, -10_000, 10_000, !isMaximizingPlayer)
    game.undo()
    if (value >= bestMove) {
      bestMove = value
      bestMoveFound = newGameMove
    }
  }

  return bestMoveFound
}

function minimax(depth, game, alpha, beta, isMaximizingPlayer) {
  // positionCount++
  if (depth === 0) {
    return -evaluateBoard(game.board())
  }

  const newGameMoves = game.moves()

  if (isMaximizingPlayer) {
    let bestMove = -9999
    for (const move of newGameMoves) {
      game.move(move)
      bestMove = Math.max(
        bestMove,
        minimax(depth - 1, game, alpha, beta, !isMaximizingPlayer),
      )
      game.undo()
      alpha = Math.max(alpha, bestMove)
      if (beta <= alpha) {
        return bestMove
      }
    }

    return bestMove
  }

  let bestMove = 9999
  for (const move of newGameMoves) {
    game.move(move)
    bestMove = Math.min(
      bestMove,
      minimax(depth - 1, game, alpha, beta, !isMaximizingPlayer),
    )
    game.undo()
    beta = Math.min(beta, bestMove)
    if (beta <= alpha) {
      return bestMove
    }
  }

  return bestMove
}

function evaluateBoard(board) {
  let totalEvaluation = 0
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      totalEvaluation += getPieceValue(board[i][j])
    }
  }

  return totalEvaluation
}

function getAbsoluteValue(piece) {
  if (piece.type === "p") return 10
  if (piece.type === "r") return 50
  if (piece.type === "n") return 30
  if (piece.type === "b") return 30
  if (piece.type === "q") return 90
  if (piece.type === "k") return 900
  throw new Error("Unknown piece type: " + piece.type)
}

function getPieceValue(piece) {
  if (piece === null) return 0
  const absoluteValue = getAbsoluteValue(piece)
  return piece.color === "w" ? absoluteValue : -absoluteValue
}

function onDragStart(source, piece) {
  if (
    game.isCheckmate() === true ||
    game.isDraw() === true ||
    piece.search(/^b/) !== -1
  ) {
    return false
  }
}

async function displayGameOver() {
  await alert(
    game.isDraw() ? "Draw" : game.isStalemate() ? "Stalemate" : "Checkmate",
  )

  newGame()
}

async function makeBestMove() {
  let bestMove
  await wrapCursor("progress", () => {
    bestMove = getBestMove(game)
  })
  // setCursor("progress")
  // await untilRepaint()
  // const bestMove = getBestMove(game)
  // setCursor()

  game.move(bestMove)
  board.position(game.fen())
  renderMoveHistory(game.history())
  if (game.isGameOver()) displayGameOver()
}

function getBestMove(game) {
  if (game.isGameOver()) displayGameOver()

  // positionCount = 0
  const depth = state.difficulty

  // const d = Date.now()
  const bestMove = minimaxRoot(depth, game, true)
  // const d2 = Date.now()
  // const moveTime = d2 - d
  // const positionsPerS = (positionCount * 1000) / moveTime

  // $("#position-count").text(positionCount)
  // $("#time").text(moveTime / 1000 + "s")
  // $("#positions-per-s").text(positionsPerS)
  return bestMove
}

function renderMoveHistory(/* moves */) {}

const onDrop = function (source, target) {
  removeGreySquares()

  try {
    game.move({
      from: source,
      to: target,
      promotion: "q",
    })
  } catch {
    return "snapback"
  }

  renderMoveHistory(game.history())
  window.setTimeout(makeBestMove, 250)
}

const onSnapEnd = function () {
  board.position(game.fen())
}

const onMouseoverSquare = function (square) {
  const moves = game.moves({
    square,
    verbose: true,
  })

  if (moves.length === 0) return

  greySquare(square)
  for (const move of moves) greySquare(move.to)
}

const onMouseoutSquare = function () {
  removeGreySquares()
}

function removeGreySquares() {
  for (const item of document.querySelectorAll(".cb-square")) {
    item.classList.remove("greyed")
  }
}

function greySquare(square) {
  for (const item of document.querySelectorAll(".square-" + square)) {
    item.classList.add("greyed")
  }
}

function newGame() {
  const classic = state.mode === "classic"
  const start = classic ? undefined : chess960Gen()

  const fen = classic
    ? DEFAULT_POSITION
    : `${start.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${start} w`

  game = new Chess(fen)

  board = new Chessboard("#board", {
    draggable: true,
    position: fen,
    pieceTheme: decodeURI(
      // new URL("./img/chesspieces/alpha/{piece}.png", import.meta.url).href,
      new URL("./img/chesspieces/pixel/{piece}.png", import.meta.url).href,
    ),
    showNotation: false,
    moveSpeed: 200,
    snapbackSpeed: 200,
    onDragStart,
    onDrop,
    onMouseoutSquare,
    onMouseoverSquare,
    onSnapEnd,
    showErrors(code, msg, obj) {
      console.log(code, msg, obj)
    },
  })
}

newGame()

window.newGame = newGame
window.state = state

window.save = () => {
  console.log("save", game.fen())
}

window.load = () => {
  console.log("load")
}

// import puppet from "/c/sys/core/dev/puppet.js"
// await puppet("ui-menubar > li:first-child > button").click()
