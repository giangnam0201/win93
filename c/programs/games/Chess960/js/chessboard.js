/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable no-prototype-builtins */
// chessboard.js v@VERSION
// https://github.com/oakmac/chessboardjs/
//
// Copyright (c) 2019, Chris Oakman
// Released under the MIT license
// https://github.com/oakmac/chessboardjs/blob/master/LICENSE.md

/* spell-checker: disable */

import { throttle } from "../../../../../42/lib/timing/throttle.js"
import { animate } from "../../../../../42/lib/type/element/animate.js"

const $ = window.jQuery

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS = "abcdefgh".split("")
const DEFAULT_DRAG_THROTTLE_RATE = 20
const RUN_ASSERTS = true
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
const START_POSITION = fenToObj(START_FEN)

// default animation speeds
const DEFAULT_APPEAR_SPEED = 200
const DEFAULT_MOVE_SPEED = 200
const DEFAULT_SNAPBACK_SPEED = 60
const DEFAULT_SNAP_SPEED = 30
const DEFAULT_TRASH_SPEED = 100

// use unique class names to prevent clashing with anything else on the page
// and simplify selectors
// NOTE: these should never change
const CSS = {}
CSS.alpha = "cb-alpha"
CSS.black = "cb-black"
CSS.board = "cb-board"
CSS.chessboard = "cb-chessboard"
CSS.clearfix = "cb-clearfix"
CSS.highlight1 = "cb-highlight1"
CSS.highlight2 = "cb-highlight2"
CSS.notation = "cb-notation"
CSS.numeric = "cb-numeric"
CSS.piece = "cb-piece"
CSS.row = "cb-row"
CSS.sparePieces = "cb-spare-pieces"
CSS.sparePiecesBottom = "cb-spare-pieces-bottom"
CSS.sparePiecesTop = "cb-spare-pieces-top"
CSS.square = "cb-square"
CSS.white = "cb-white"

// ---------------------------------------------------------------------------
// Misc Util Functions
// ---------------------------------------------------------------------------

function uuid() {
  return crypto.randomUUID()
}

function deepCopy(thing) {
  return JSON.parse(JSON.stringify(thing))
  // return structuredClone(thing)
}

function interpolateTemplate(str, obj) {
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue
    const keyTemplateStr = "{" + key + "}"
    const value = obj[key]
    while (str.includes(keyTemplateStr)) {
      str = str.replace(keyTemplateStr, value)
    }
  }

  return str
}

if (RUN_ASSERTS) {
  console.assert(interpolateTemplate("abc", { a: "x" }) === "abc")
  console.assert(interpolateTemplate("{a}bc", {}) === "{a}bc")
  console.assert(interpolateTemplate("{a}bc", { p: "q" }) === "{a}bc")
  console.assert(interpolateTemplate("{a}bc", { a: "x" }) === "xbc")
  console.assert(interpolateTemplate("{a}bc{a}bc", { a: "x" }) === "xbcxbc")
  console.assert(interpolateTemplate("{a}{a}{b}", { a: "x", b: "y" }) === "xxy")
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

function isString(s) {
  return typeof s === "string"
}

function isFunction(f) {
  return typeof f === "function"
}

function isInteger(n) {
  return typeof n === "number" && Number.isFinite(n) && Math.floor(n) === n
}

function validAnimationSpeed(speed) {
  if (speed === "fast" || speed === "slow") return true
  if (!isInteger(speed)) return false
  return speed >= 0
}

function validThrottleRate(rate) {
  return isInteger(rate) && rate >= 1
}

function validMove(move) {
  // move should be a string
  if (!isString(move)) return false

  // move should be in the form of "e2-e4", "f6-d5"
  const squares = move.split("-")
  if (squares.length !== 2) return false

  return validSquare(squares[0]) && validSquare(squares[1])
}

function validSquare(square) {
  return isString(square) && square.search(/^[a-h][1-8]$/) !== -1
}

if (RUN_ASSERTS) {
  console.assert(validSquare("a1"))
  console.assert(validSquare("e2"))
  console.assert(!validSquare("D2"))
  console.assert(!validSquare("g9"))
  console.assert(!validSquare("a"))
  console.assert(!validSquare(true))
  console.assert(!validSquare(null))
  console.assert(!validSquare({}))
}

function validPieceCode(code) {
  return isString(code) && code.search(/^[bw][BKNP-R]$/) !== -1
}

if (RUN_ASSERTS) {
  console.assert(validPieceCode("bP"))
  console.assert(validPieceCode("bK"))
  console.assert(validPieceCode("wK"))
  console.assert(validPieceCode("wR"))
  console.assert(!validPieceCode("WR"))
  console.assert(!validPieceCode("Wr"))
  console.assert(!validPieceCode("a"))
  console.assert(!validPieceCode(true))
  console.assert(!validPieceCode(null))
  console.assert(!validPieceCode({}))
}

function validFen(fen) {
  if (!isString(fen)) return false

  // cut off any move, castling, etc info from the end
  // we're only interested in position information
  fen = fen.replace(/ .+$/, "")

  // expand the empty square numbers to just 1s
  fen = expandFenEmptySquares(fen)

  // FEN should be 8 sections separated by slashes
  const chunks = fen.split("/")
  if (chunks.length !== 8) return false

  // check each section
  for (let i = 0; i < 8; i++) {
    if (chunks[i].length !== 8 || chunks[i].search(/[^1BKNP-Rbknp-r]/) !== -1) {
      return false
    }
  }

  return true
}

if (RUN_ASSERTS) {
  console.assert(validFen(START_FEN))
  console.assert(validFen("8/8/8/8/8/8/8/8"))
  console.assert(
    validFen("r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R"),
  )
  console.assert(
    validFen("3r3r/1p4pp/2nb1k2/pP3p2/8/PB2PN2/p4PPP/R4RK1 b - - 0 1"),
  )
  console.assert(
    !validFen("3r3z/1p4pp/2nb1k2/pP3p2/8/PB2PN2/p4PPP/R4RK1 b - - 0 1"),
  )
  console.assert(!validFen("anbqkbnr/8/8/8/8/8/PPPPPPPP/8"))
  console.assert(!validFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/"))
  console.assert(!validFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN"))
  console.assert(!validFen("888888/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"))
  console.assert(!validFen("888888/pppppppp/74/8/8/8/PPPPPPPP/RNBQKBNR"))
  console.assert(!validFen({}))
}

function validPositionObject(pos) {
  if (!$.isPlainObject(pos)) return false

  for (const i in pos) {
    if (!pos.hasOwnProperty(i)) continue

    if (!validSquare(i) || !validPieceCode(pos[i])) {
      return false
    }
  }

  return true
}

if (RUN_ASSERTS) {
  console.assert(validPositionObject(START_POSITION))
  console.assert(validPositionObject({}))
  console.assert(validPositionObject({ e2: "wP" }))
  console.assert(validPositionObject({ e2: "wP", d2: "wP" }))
  console.assert(!validPositionObject({ e2: "BP" }))
  console.assert(!validPositionObject({ y2: "wP" }))
  console.assert(!validPositionObject(null))
  console.assert(!validPositionObject("start"))
  console.assert(!validPositionObject(START_FEN))
}

function isTouchDevice() {
  return "ontouchstart" in document.documentElement
}

// ---------------------------------------------------------------------------
// Chess Util Functions
// ---------------------------------------------------------------------------

// convert FEN piece code to bP, wK, etc
function fenToPieceCode(piece) {
  // black piece
  if (piece.toLowerCase() === piece) {
    return "b" + piece.toUpperCase()
  }

  // white piece
  return "w" + piece.toUpperCase()
}

// convert bP, wK, etc code to FEN structure
function pieceCodeToFen(piece) {
  const pieceCodeLetters = piece.split("")

  // white piece
  if (pieceCodeLetters[0] === "w") {
    return pieceCodeLetters[1].toUpperCase()
  }

  // black piece
  return pieceCodeLetters[1].toLowerCase()
}

// convert FEN string to position object
// returns false if the FEN string is invalid
function fenToObj(fen) {
  if (!validFen(fen)) return false

  // cut off any move, castling, etc info from the end
  // we're only interested in position information
  fen = fen.replace(/ .+$/, "")

  const rows = fen.split("/")
  const position = {}

  let currentRow = 8
  for (let i = 0; i < 8; i++) {
    const row = rows[i].split("")
    let colIdx = 0

    // loop through each character in the FEN section
    for (const element of row) {
      // number / empty squares
      if (element.search(/[1-8]/) === -1) {
        // piece
        const square = COLUMNS[colIdx] + currentRow
        position[square] = fenToPieceCode(element)
        colIdx += 1
      } else {
        const numEmptySquares = Number.parseInt(element, 10)
        colIdx += numEmptySquares
      }
    }

    currentRow -= 1
  }

  return position
}

// position object to FEN string
// returns false if the obj is not a valid position object
function objToFen(obj) {
  if (!validPositionObject(obj)) return false

  let fen = ""

  let currentRow = 8
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const square = COLUMNS[j] + currentRow

      fen +=
        square in obj
          ? // piece exists
            pieceCodeToFen(obj[square])
          : // empty space
            "1"
    }

    if (i !== 7) fen += "/"

    currentRow -= 1
  }

  // squeeze the empty numbers together
  fen = squeezeFenEmptySquares(fen)

  return fen
}

if (RUN_ASSERTS) {
  console.assert(objToFen(START_POSITION) === START_FEN)
  console.assert(objToFen({}) === "8/8/8/8/8/8/8/8")
  console.assert(objToFen({ a2: "wP", b2: "bP" }) === "8/8/8/8/8/8/Pp6/8")
}

function squeezeFenEmptySquares(fen) {
  return fen
    .replaceAll(/1{8}/g, "8")
    .replaceAll("1111111", "7")
    .replaceAll("111111", "6")
    .replaceAll("11111", "5")
    .replaceAll("1111", "4")
    .replaceAll("111", "3")
    .replaceAll("11", "2")
}

function expandFenEmptySquares(fen) {
  return fen
    .replaceAll("8", "11111111")
    .replaceAll("7", "1111111")
    .replaceAll("6", "111111")
    .replaceAll("5", "11111")
    .replaceAll("4", "1111")
    .replaceAll("3", "111")
    .replaceAll("2", "11")
}

// returns the distance between two squares
function squareDistance(squareA, squareB) {
  const squareAArray = squareA.split("")
  const squareAx = COLUMNS.indexOf(squareAArray[0]) + 1
  const squareAy = Number.parseInt(squareAArray[1], 10)

  const squareBArray = squareB.split("")
  const squareBx = COLUMNS.indexOf(squareBArray[0]) + 1
  const squareBy = Number.parseInt(squareBArray[1], 10)

  const xDelta = Math.abs(squareAx - squareBx)
  const yDelta = Math.abs(squareAy - squareBy)

  if (xDelta >= yDelta) return xDelta
  return yDelta
}

// returns the square of the closest instance of piece
// returns false if no instance of piece is found in position
function findClosestPiece(position, piece, square) {
  // create array of closest squares from square
  const closestSquares = createRadius(square)

  // search through the position in order of distance for the piece
  for (const s of closestSquares) {
    if (position.hasOwnProperty(s) && position[s] === piece) {
      return s
    }
  }

  return false
}

// returns an array of closest squares from square
function createRadius(square) {
  const squares = []

  // calculate distance of all squares
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const s = COLUMNS[i] + (j + 1)

      // skip the square we're starting from
      if (square === s) continue

      squares.push({
        square: s,
        distance: squareDistance(square, s),
      })
    }
  }

  // sort by distance
  squares.sort((a, b) => a.distance - b.distance)

  // just return the square code
  const surroundingSquares = []
  for (const square_ of squares) {
    surroundingSquares.push(square_.square)
  }

  return surroundingSquares
}

// given a position and a set of moves, return a new position
// with the moves executed
function calculatePositionFromMoves(position, moves) {
  const newPosition = deepCopy(position)

  for (const i in moves) {
    if (!moves.hasOwnProperty(i)) continue

    // skip the move if the position doesn't have a piece on the source square
    if (!newPosition.hasOwnProperty(i)) continue

    const piece = newPosition[i]
    delete newPosition[i]
    newPosition[moves[i]] = piece
  }

  return newPosition
}

// TODO: add some asserts here for calculatePositionFromMoves

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function buildContainerHTML(hasSparePieces) {
  let html = '<div class="{chessboard}">'

  if (hasSparePieces) {
    html += '<div class="{sparePieces} {sparePiecesTop}"></div>'
  }

  html += '<div class="{board}"></div>'

  if (hasSparePieces) {
    html += '<div class="{sparePieces} {sparePiecesBottom}"></div>'
  }

  html += "</div>"

  return interpolateTemplate(html, CSS)
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function expandConfigArgumentShorthand(config) {
  if (config === "start") {
    config = { position: deepCopy(START_POSITION) }
  } else if (validFen(config)) {
    config = { position: fenToObj(config) }
  } else if (validPositionObject(config)) {
    config = { position: deepCopy(config) }
  }

  // config must be an object
  if (!$.isPlainObject(config)) config = {}

  return config
}

// validate config / set default options
function expandConfig(config) {
  // default for orientation is white
  if (config.orientation !== "black") config.orientation = "white"

  // default for showNotation is true
  if (config.showNotation !== false) config.showNotation = true

  // default for draggable is false
  if (config.draggable !== true) config.draggable = false

  // default for dropOffBoard is 'snapback'
  if (config.dropOffBoard !== "trash") config.dropOffBoard = "snapback"

  // default for sparePieces is false
  if (config.sparePieces !== true) config.sparePieces = false

  // draggable must be true if sparePieces is enabled
  if (config.sparePieces) config.draggable = true

  // default piece theme is wikipedia
  if (
    !config.hasOwnProperty("pieceTheme") ||
    (!isString(config.pieceTheme) && !isFunction(config.pieceTheme))
  ) {
    config.pieceTheme = "img/chesspieces/wikipedia/{piece}.png"
  }

  // animation speeds
  if (!validAnimationSpeed(config.appearSpeed)) {
    config.appearSpeed = DEFAULT_APPEAR_SPEED
  }

  if (!validAnimationSpeed(config.moveSpeed)) {
    config.moveSpeed = DEFAULT_MOVE_SPEED
  }

  if (!validAnimationSpeed(config.snapbackSpeed)) {
    config.snapbackSpeed = DEFAULT_SNAPBACK_SPEED
  }

  if (!validAnimationSpeed(config.snapSpeed)) {
    config.snapSpeed = DEFAULT_SNAP_SPEED
  }

  if (!validAnimationSpeed(config.trashSpeed)) {
    config.trashSpeed = DEFAULT_TRASH_SPEED
  }

  // throttle rate
  if (!validThrottleRate(config.dragThrottleRate)) {
    config.dragThrottleRate = DEFAULT_DRAG_THROTTLE_RATE
  }

  return config
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

export function Chessboard(containerElOrString, config) {
  const $container = $(containerElOrString)
  if (!$container) return null

  // ensure the config object is what we expect
  config = expandConfigArgumentShorthand(config)
  config = expandConfig(config)

  // DOM elements
  let $board = null
  let $draggedPiece = null
  let $sparePiecesTop = null
  let $sparePiecesBottom = null

  // constructor return object
  const widget = {}

  // -------------------------------------------------------------------------
  // Stateful
  // -------------------------------------------------------------------------

  let currentOrientation = "white"
  let currentPosition = {}
  let draggedPiece = null
  let draggedPieceLocation = null
  let draggedPieceSource = null
  let isDragging = false
  const sparePiecesElsIds = {}
  const squareElsIds = {}

  // -------------------------------------------------------------------------
  // Validation / Errors
  // -------------------------------------------------------------------------

  function error(code, msg, obj) {
    // custom function
    if (isFunction(config.showErrors)) {
      config.showErrors(code, msg, obj)
    }
  }

  function setInitialState() {
    currentOrientation = config.orientation

    // make sure position is valid
    if (config.hasOwnProperty("position")) {
      if (config.position === "start") {
        currentPosition = deepCopy(START_POSITION)
      } else if (validFen(config.position)) {
        currentPosition = fenToObj(config.position)
      } else if (validPositionObject(config.position)) {
        currentPosition = deepCopy(config.position)
      } else {
        error(7263, "Invalid value passed to config.position.", config.position)
      }
    }
  }

  // -------------------------------------------------------------------------
  // DOM Misc
  // -------------------------------------------------------------------------

  // create random IDs for elements
  function createElIds() {
    // squares on the board
    for (const COLUMN of COLUMNS) {
      for (let j = 1; j <= 8; j++) {
        const square = COLUMN + j
        squareElsIds[square] = square + "-" + uuid()
      }
    }

    // spare pieces
    const pieces = "KQRNBP".split("")
    for (const piece of pieces) {
      const whitePiece = "w" + piece
      const blackPiece = "b" + piece
      sparePiecesElsIds[whitePiece] = whitePiece + "-" + uuid()
      sparePiecesElsIds[blackPiece] = blackPiece + "-" + uuid()
    }
  }

  // -------------------------------------------------------------------------
  // Markup Building
  // -------------------------------------------------------------------------

  function buildBoardHTML(orientation) {
    if (orientation !== "black") {
      orientation = "white"
    }

    let html = ""

    // algebraic notation / orientation
    const alpha = deepCopy(COLUMNS)
    let row = 8
    if (orientation === "black") {
      alpha.reverse()
      row = 1
    }

    let squareColor = "white"
    for (let i = 0; i < 8; i++) {
      html += '<div class="{row}">'
      for (let j = 0; j < 8; j++) {
        const square = alpha[j] + row

        // html += `<div class="{square} ${CSS[squareColor]} square-${square}" style="width:${squareSize}px;height:${squareSize}px;" id="${squareElsIds[square]}" data-square="${square}">`
        html += `<div class="{square} ${CSS[squareColor]} square-${square}" id="${squareElsIds[square]}" data-square="${square}">`

        if (config.showNotation) {
          // alpha notation
          if (
            (orientation === "white" && row === 1) ||
            (orientation === "black" && row === 8)
          ) {
            html += '<div class="{notation} {alpha}">' + alpha[j] + "</div>"
          }

          // numeric notation
          if (j === 0) {
            html += '<div class="{notation} {numeric}">' + row + "</div>"
          }
        }

        html += "</div>" // end .square

        squareColor = squareColor === "white" ? "black" : "white"
      }

      // html += '<div class="{clearfix}"></div></div>'
      html += "</div>"

      squareColor = squareColor === "white" ? "black" : "white"

      row = orientation === "white" ? row - 1 : row + 1
    }

    return interpolateTemplate(html, CSS)
  }

  function buildPieceImgSrc(piece) {
    if (isFunction(config.pieceTheme)) {
      return config.pieceTheme(piece)
    }

    if (isString(config.pieceTheme)) {
      return interpolateTemplate(config.pieceTheme, { piece })
    }

    // NOTE: this should never happen
    error(8272, "Unable to build image source for config.pieceTheme.")
    return ""
  }

  function buildPieceHTML(piece, hidden, id) {
    let html = '<img draggable="false" src="' + buildPieceImgSrc(piece) + '" '
    if (isString(id) && id !== "") {
      html += 'id="' + id + '" '
    }

    // html += `alt="" class="{piece}" data-piece="${piece}" style="width:${squareSize}px;height:${squareSize}px;`
    html += `alt="" class="{piece}" data-piece="${piece}"`
    if (hidden) html += "display:none;"
    html += '" />'

    return interpolateTemplate(html, CSS)
  }

  async function buildPieceElement(piece, hidden, id) {
    const img = new Image()
    img.draggable = false
    img.src = buildPieceImgSrc(piece)
    if (isString(id) && id !== "") img.id = id
    img.className = CSS.piece
    img.dataset.piece = piece
    if (hidden) img.style.display = "none"
    await img.decode()
    return img
  }

  function buildSparePiecesHTML(color) {
    let pieces = ["wK", "wQ", "wR", "wB", "wN", "wP"]
    if (color === "black") {
      pieces = ["bK", "bQ", "bR", "bB", "bN", "bP"]
    }

    let html = ""
    for (const piece of pieces) {
      html += buildPieceHTML(piece, false, sparePiecesElsIds[piece])
    }

    return html
  }

  // -------------------------------------------------------------------------
  // Animations
  // -------------------------------------------------------------------------

  function animateSquareToSquare(src, dest, piece, completeFn) {
    // get information about the source and destination squares
    const $srcSquare = $("#" + squareElsIds[src])
    const srcSquarePosition = $srcSquare.offset()
    const $destSquare = $("#" + squareElsIds[dest])
    const destSquarePosition = $destSquare.offset()

    const img = document.querySelector(`.cb-square img[data-piece="${piece}"]`)
    const rect = img.getBoundingClientRect()

    // create the animated piece and absolutely position it
    // over the source square
    const animatedPieceId = uuid()

    $container.append(buildPieceHTML(piece, true, animatedPieceId))
    const $animatedPiece = $("#" + animatedPieceId)
    $animatedPiece.css({
      position: "fixed",
      width: rect.width + "px",
      height: rect.height + "px",
      top: srcSquarePosition.top,
      left: srcSquarePosition.left,
    })

    // remove original piece from source square
    $srcSquare.find("." + CSS.piece).remove()

    function onFinishAnimation1() {
      // add the "real" piece to the destination square
      $destSquare.append(buildPieceHTML(piece))

      // remove the animated piece
      $animatedPiece.remove()

      // run complete function
      if (isFunction(completeFn)) {
        completeFn()
      }
    }

    // animate the piece to the destination square
    const opts = {
      duration: config.moveSpeed,
      complete: onFinishAnimation1,
    }
    $animatedPiece.animate(destSquarePosition, opts)
  }

  function animateSparePieceToSquare(piece, dest, completeFn) {
    const srcOffset = $("#" + sparePiecesElsIds[piece]).offset()
    const $destSquare = $("#" + squareElsIds[dest])
    const destOffset = $destSquare.offset()

    // create the animate piece
    const pieceId = uuid()
    $container.append(buildPieceHTML(piece, true, pieceId))
    const $animatedPiece = $("#" + pieceId)
    $animatedPiece.css({
      // display: "",
      position: "absolute",
      left: srcOffset.left,
      top: srcOffset.top,
    })

    // on complete
    function onFinishAnimation2() {
      // add the "real" piece to the destination square
      $destSquare.find("." + CSS.piece).remove()
      $destSquare.append(buildPieceHTML(piece))

      // remove the animated piece
      $animatedPiece.remove()

      // run complete function
      if (isFunction(completeFn)) {
        completeFn()
      }
    }

    // animate the piece to the destination square
    const opts = {
      duration: config.moveSpeed,
      complete: onFinishAnimation2,
    }
    $animatedPiece.animate(destOffset, opts)
  }

  // execute an array of animations
  function doAnimations(animations, oldPos, newPos) {
    if (animations.length === 0) return

    let numFinished = 0
    function onFinishAnimation3() {
      // exit if all the animations aren't finished
      numFinished += 1
      if (numFinished !== animations.length) return

      drawPositionInstant()

      // run their onMoveEnd function
      if (isFunction(config.onMoveEnd)) {
        config.onMoveEnd(deepCopy(oldPos), deepCopy(newPos))
      }
    }

    for (const animation of animations) {
      // clear a piece
      if (animation.type === "clear") {
        $("#" + squareElsIds[animation.square] + " ." + CSS.piece).fadeOut(
          config.trashSpeed,
          onFinishAnimation3,
        )

        // add a piece with no spare pieces - fade the piece onto the square
      } else if (animation.type === "add" && !config.sparePieces) {
        $("#" + squareElsIds[animation.square])
          .append(buildPieceHTML(animation.piece, true))
          .find("." + CSS.piece)
          .fadeIn(config.appearSpeed, onFinishAnimation3)

        // add a piece with spare pieces - animate from the spares
      } else if (animation.type === "add" && config.sparePieces) {
        animateSparePieceToSquare(
          animation.piece,
          animation.square,
          onFinishAnimation3,
        )

        // move a piece from squareA to squareB
      } else if (animation.type === "move") {
        animateSquareToSquare(
          animation.source,
          animation.destination,
          animation.piece,
          onFinishAnimation3,
        )
      }
    }
  }

  // calculate an array of animations that need to happen in order to get
  // from pos1 to pos2
  function calculateAnimations(pos1, pos2) {
    // make copies of both
    pos1 = deepCopy(pos1)
    pos2 = deepCopy(pos2)

    const animations = []
    const squaresMovedTo = {}

    // remove pieces that are the same in both positions
    for (const i in pos2) {
      if (!pos2.hasOwnProperty(i)) continue

      if (pos1.hasOwnProperty(i) && pos1[i] === pos2[i]) {
        delete pos1[i]
        delete pos2[i]
      }
    }

    // find all the "move" animations
    for (const i in pos2) {
      if (!pos2.hasOwnProperty(i)) continue

      const closestPiece = findClosestPiece(pos1, pos2[i], i)
      if (closestPiece) {
        animations.push({
          type: "move",
          source: closestPiece,
          destination: i,
          piece: pos2[i],
        })

        delete pos1[closestPiece]
        delete pos2[i]
        squaresMovedTo[i] = true
      }
    }

    // "add" animations
    for (const i in pos2) {
      if (!pos2.hasOwnProperty(i)) continue

      animations.push({
        type: "add",
        square: i,
        piece: pos2[i],
      })

      delete pos2[i]
    }

    // "clear" animations
    for (const i in pos1) {
      if (!pos1.hasOwnProperty(i)) continue

      // do not clear a piece if it is on a square that is the result
      // of a "move", ie: a piece capture
      if (squaresMovedTo.hasOwnProperty(i)) continue

      animations.push({
        type: "clear",
        square: i,
        piece: pos1[i],
      })

      delete pos1[i]
    }

    return animations
  }

  // -------------------------------------------------------------------------
  // Control Flow
  // -------------------------------------------------------------------------

  async function drawPositionInstant() {
    const pieces = []
    const undones = []
    for (const i in currentPosition) {
      if (!currentPosition.hasOwnProperty(i)) continue
      const piece = buildPieceElement(currentPosition[i])
      undones.push(
        piece.then((img) => {
          pieces[i] = img
        }),
      )
    }

    await Promise.all(undones)

    for (const i in currentPosition) {
      if (!currentPosition.hasOwnProperty(i)) continue
      document.querySelector("#" + squareElsIds[i]).replaceChildren(pieces[i])
    }
  }

  async function drawBoard() {
    $board.html(buildBoardHTML(currentOrientation))
    await drawPositionInstant()

    if (config.sparePieces) {
      if (currentOrientation === "white") {
        $sparePiecesTop.html(buildSparePiecesHTML("black"))
        $sparePiecesBottom.html(buildSparePiecesHTML("white"))
      } else {
        $sparePiecesTop.html(buildSparePiecesHTML("white"))
        $sparePiecesBottom.html(buildSparePiecesHTML("black"))
      }
    }
  }

  function setCurrentPosition(position) {
    const oldPos = deepCopy(currentPosition)
    const newPos = deepCopy(position)
    const oldFen = objToFen(oldPos)
    const newFen = objToFen(newPos)

    // do nothing if no change in position
    if (oldFen === newFen) return

    // run their onChange function
    if (isFunction(config.onChange)) {
      config.onChange(oldPos, newPos)
    }

    // update state
    currentPosition = position
  }

  function isXYOnSquare(x, y) {
    const el = document.elementFromPoint(x, y)?.closest(".cb-square")
    if (el) return el.dataset.square
    return "offboard"
  }

  function removeSquareHighlights() {
    $board
      .find("." + CSS.square)
      .removeClass(CSS.highlight1 + " " + CSS.highlight2)
  }

  function snapbackDraggedPiece() {
    // there is no "snapback" for spare pieces
    if (draggedPieceSource === "spare") {
      trashDraggedPiece()
      return
    }

    removeSquareHighlights()

    // animation complete
    async function complete() {
      await drawPositionInstant()
      $draggedPiece.css("display", "none")

      // run their onSnapbackEnd function
      if (isFunction(config.onSnapbackEnd)) {
        config.onSnapbackEnd(
          draggedPiece,
          draggedPieceSource,
          deepCopy(currentPosition),
          currentOrientation,
        )
      }
    }

    // get source square position
    const sourceSquarePosition = $(
      "#" + squareElsIds[draggedPieceSource],
    ).offset()

    // animate the piece to the target square
    animate
      .to($draggedPiece[0], {
        translate: `${sourceSquarePosition.left}px ${sourceSquarePosition.top}px`,
        ms: config.snapbackSpeed,
      })
      .then(complete)

    // set state
    isDragging = false
  }

  function trashDraggedPiece() {
    removeSquareHighlights()

    // remove the source piece
    const newPosition = deepCopy(currentPosition)
    delete newPosition[draggedPieceSource]
    setCurrentPosition(newPosition)

    // redraw the position
    drawPositionInstant()

    // hide the dragged piece
    $draggedPiece.fadeOut(config.trashSpeed)

    // set state
    isDragging = false
  }

  function dropDraggedPieceOnSquare(square) {
    removeSquareHighlights()

    // update position
    const newPosition = deepCopy(currentPosition)
    delete newPosition[draggedPieceSource]
    newPosition[square] = draggedPiece
    setCurrentPosition(newPosition)

    // get target square information
    const targetSquarePosition = $("#" + squareElsIds[square]).offset()

    // animation complete
    function onAnimationComplete() {
      drawPositionInstant()
      $draggedPiece.css("display", "none")

      // execute their onSnapEnd function
      if (isFunction(config.onSnapEnd)) {
        config.onSnapEnd(draggedPieceSource, square, draggedPiece)
      }
    }

    // snap the piece to the target square
    animate
      .to($draggedPiece[0], {
        translate: `${targetSquarePosition.left}px ${targetSquarePosition.top}px`,
        ms: config.snapSpeed,
      })
      .then(onAnimationComplete)

    // set state
    isDragging = false
  }

  let pointerOffsets

  function beginDraggingPiece(source, piece, x, y) {
    // run their custom onDragStart function
    // their custom onDragStart function can cancel drag start
    if (
      isFunction(config.onDragStart) &&
      config.onDragStart(
        source,
        piece,
        deepCopy(currentPosition),
        currentOrientation,
      ) === false
    ) {
      return
    }

    // set state
    isDragging = true
    draggedPiece = piece
    draggedPieceSource = source

    // if the piece came from spare pieces, location is offboard
    draggedPieceLocation = source === "spare" ? "offboard" : source

    // const img = document.querySelector(".cb-square img")
    const img = document.querySelector(`.cb-square img[data-piece="${piece}"]`)

    // create the dragged piece
    $draggedPiece.attr("src", buildPieceImgSrc(piece)).css({
      display: "",
      position: "fixed",
      pointerEvents: "none",
      left: 0,
      top: 0,
      zIndex: 5,
      width: img.offsetWidth,
      height: img.offsetHeight,
      translate: `${x - pointerOffsets.x}px ${y - pointerOffsets.y}px`,
    })

    if (source !== "spare") {
      // highlight the source square and hide the piece
      $("#" + squareElsIds[source])
        .addClass(CSS.highlight1)
        .find("." + CSS.piece)
        .css("display", "none")
    }
  }

  function updateDraggedPiece(x, y) {
    $draggedPiece.css({
      translate: `${x - pointerOffsets.x}px ${y - pointerOffsets.y}px`,
    })

    // get location
    const location = isXYOnSquare(x, y)

    // do nothing if the location has not changed
    if (location === draggedPieceLocation) return

    // remove highlight from previous square
    if (validSquare(draggedPieceLocation)) {
      $("#" + squareElsIds[draggedPieceLocation]).removeClass(CSS.highlight2)
    }

    // add highlight to new square
    if (validSquare(location)) {
      $("#" + squareElsIds[location]).addClass(CSS.highlight2)
    }

    // run onDragMove
    if (isFunction(config.onDragMove)) {
      config.onDragMove(
        location,
        draggedPieceLocation,
        draggedPieceSource,
        draggedPiece,
        deepCopy(currentPosition),
        currentOrientation,
      )
    }

    // update state
    draggedPieceLocation = location
  }

  function stopDraggedPiece(location) {
    // determine what the action should be
    let action = "drop"
    if (location === "offboard" && config.dropOffBoard === "snapback") {
      action = "snapback"
    }

    if (location === "offboard" && config.dropOffBoard === "trash") {
      action = "trash"
    }

    // run their onDrop function, which can potentially change the drop action
    if (isFunction(config.onDrop)) {
      const newPosition = deepCopy(currentPosition)

      // source piece is a spare piece and position is off the board
      // if (draggedPieceSource === 'spare' && location === 'offboard') {...}
      // position has not changed; do nothing

      // source piece is a spare piece and position is on the board
      if (draggedPieceSource === "spare" && validSquare(location)) {
        // add the piece to the board
        newPosition[location] = draggedPiece
      }

      // source piece was on the board and position is off the board
      if (validSquare(draggedPieceSource) && location === "offboard") {
        // remove the piece from the board
        delete newPosition[draggedPieceSource]
      }

      // source piece was on the board and position is on the board
      if (validSquare(draggedPieceSource) && validSquare(location)) {
        // move the piece
        delete newPosition[draggedPieceSource]
        newPosition[location] = draggedPiece
      }

      const oldPosition = deepCopy(currentPosition)

      const result = config.onDrop(
        draggedPieceSource,
        location,
        draggedPiece,
        newPosition,
        oldPosition,
        currentOrientation,
      )
      if (result === "snapback" || result === "trash") {
        action = result
      }
    }

    // do it!
    if (action === "snapback") {
      snapbackDraggedPiece()
    } else if (action === "trash") {
      trashDraggedPiece()
    } else if (action === "drop") {
      dropDraggedPieceOnSquare(location)
    }
  }

  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------

  // clear the board
  widget.clear = function (useAnimation) {
    widget.position({}, useAnimation)
  }

  // remove the widget from the page
  widget.destroy = function () {
    // remove markup
    $container.html("")
    $draggedPiece.remove()

    // remove event handlers
    $container.unbind()
  }

  // shorthand method to get the current FEN
  widget.fen = function () {
    return widget.position("fen")
  }

  // flip orientation
  widget.flip = function () {
    return widget.orientation("flip")
  }

  // move pieces
  // TODO: this method should be variadic as well as accept an array of moves
  widget.move = function (...args) {
    // no need to throw an error here; just do nothing
    // TODO: this should return the current position
    if (args.length === 0) return

    let useAnimation = true

    // collect the moves into an object
    const moves = {}
    for (const argument of args) {
      // any "false" to this function means no animations
      if (argument === false) {
        useAnimation = false
        continue
      }

      // skip invalid arguments
      if (!validMove(argument)) {
        error(2826, "Invalid move passed to the move method.", argument)
        continue
      }

      const tmp = argument.split("-")
      moves[tmp[0]] = tmp[1]
    }

    // calculate position from moves
    const newPos = calculatePositionFromMoves(currentPosition, moves)

    // update the board
    widget.position(newPos, useAnimation)

    // return the new position object
    return newPos
  }

  widget.orientation = function (arg) {
    // no arguments, return the current orientation
    if (arguments.length === 0) {
      return currentOrientation
    }

    // set to white or black
    if (arg === "white" || arg === "black") {
      currentOrientation = arg
      drawBoard()
      return currentOrientation
    }

    // flip orientation
    if (arg === "flip") {
      currentOrientation = currentOrientation === "white" ? "black" : "white"
      drawBoard()
      return currentOrientation
    }

    error(5482, "Invalid value passed to the orientation method.", arg)
  }

  widget.position = function (position, useAnimation) {
    // no arguments, return the current position
    if (arguments.length === 0) {
      return deepCopy(currentPosition)
    }

    // get position as FEN
    if (isString(position) && position.toLowerCase() === "fen") {
      return objToFen(currentPosition)
    }

    // start position
    if (isString(position) && position.toLowerCase() === "start") {
      position = deepCopy(START_POSITION)
    }

    // convert FEN to position object
    if (validFen(position)) {
      position = fenToObj(position)
    }

    // validate position object
    if (!validPositionObject(position)) {
      error(6482, "Invalid value passed to the position method.", position)
      return
    }

    // default for useAnimations is true
    if (useAnimation !== false) useAnimation = true

    if (useAnimation) {
      // start the animations
      const animations = calculateAnimations(currentPosition, position)
      doAnimations(animations, currentPosition, position)

      // set the new position
      setCurrentPosition(position)
    } else {
      // instant update
      setCurrentPosition(position)
      drawPositionInstant()
    }
  }

  // set the starting position
  widget.start = function (useAnimation) {
    widget.position("start", useAnimation)
  }

  // -------------------------------------------------------------------------
  // Browser Events
  // -------------------------------------------------------------------------

  function mousedownSquare(evt) {
    // do nothing if we're not draggable
    if (!config.draggable) return

    // do nothing if there is no piece on this square
    const square = $(this).attr("data-square")
    if (!validSquare(square)) return
    if (!currentPosition.hasOwnProperty(square)) return

    pointerOffsets = { x: evt.offsetX, y: evt.offsetY }

    beginDraggingPiece(square, currentPosition[square], evt.pageX, evt.pageY)
  }

  function touchstartSquare(e) {
    // do nothing if we're not draggable
    if (!config.draggable) return

    // do nothing if there is no piece on this square
    const square = $(this).attr("data-square")
    if (!validSquare(square)) return
    if (!currentPosition.hasOwnProperty(square)) return

    e = e.originalEvent
    beginDraggingPiece(
      square,
      currentPosition[square],
      e.changedTouches[0].pageX,
      e.changedTouches[0].pageY,
    )
  }

  function mousedownSparePiece(evt) {
    // do nothing if sparePieces is not enabled
    if (!config.sparePieces) return

    const piece = $(this).attr("data-piece")

    beginDraggingPiece("spare", piece, evt.pageX, evt.pageY)
  }

  function touchstartSparePiece(e) {
    // do nothing if sparePieces is not enabled
    if (!config.sparePieces) return

    const piece = $(this).attr("data-piece")

    e = e.originalEvent
    beginDraggingPiece(
      "spare",
      piece,
      e.changedTouches[0].pageX,
      e.changedTouches[0].pageY,
    )
  }

  function mousemoveWindow(evt) {
    if (isDragging) {
      // updateDraggedPiece(evt.pageX - evt.offsetX, evt.pageY - evt.offsetY)
      updateDraggedPiece(evt.pageX, evt.pageY)
    }
  }

  const throttledMousemoveWindow = throttle(
    mousemoveWindow,
    config.dragThrottleRate,
  )

  function touchmoveWindow(evt) {
    // do nothing if we are not dragging a piece
    if (!isDragging) return

    // prevent screen from scrolling
    evt.preventDefault()

    updateDraggedPiece(
      evt.originalEvent.changedTouches[0].pageX,
      evt.originalEvent.changedTouches[0].pageY,
    )
  }

  const throttledTouchmoveWindow = throttle(
    touchmoveWindow,
    config.dragThrottleRate,
  )

  function mouseupWindow(evt) {
    // do nothing if we are not dragging a piece
    if (!isDragging) return

    // get the location
    const location = isXYOnSquare(evt.pageX, evt.pageY)

    stopDraggedPiece(location)
  }

  function touchendWindow(evt) {
    // do nothing if we are not dragging a piece
    if (!isDragging) return

    // get the location
    const location = isXYOnSquare(
      evt.originalEvent.changedTouches[0].pageX,
      evt.originalEvent.changedTouches[0].pageY,
    )

    stopDraggedPiece(location)
  }

  function mouseenterSquare(evt) {
    // do not fire this event if we are dragging a piece
    // NOTE: this should never happen, but it's a safeguard
    if (isDragging) return

    // exit if they did not provide a onMouseoverSquare function
    if (!isFunction(config.onMouseoverSquare)) return

    // get the square
    const square = $(evt.currentTarget).attr("data-square")

    // NOTE: this should never happen; defensive
    if (!validSquare(square)) return

    // get the piece on this square
    let piece = false
    if (currentPosition.hasOwnProperty(square)) {
      piece = currentPosition[square]
    }

    // execute their function
    config.onMouseoverSquare(
      square,
      piece,
      deepCopy(currentPosition),
      currentOrientation,
    )
  }

  function mouseleaveSquare(evt) {
    // do not fire this event if we are dragging a piece
    // NOTE: this should never happen, but it's a safeguard
    if (isDragging) return

    // exit if they did not provide an onMouseoutSquare function
    if (!isFunction(config.onMouseoutSquare)) return

    // get the square
    const square = $(evt.currentTarget).attr("data-square")

    // NOTE: this should never happen; defensive
    if (!validSquare(square)) return

    // get the piece on this square
    let piece = false
    if (currentPosition.hasOwnProperty(square)) {
      piece = currentPosition[square]
    }

    // execute their function
    config.onMouseoutSquare(
      square,
      piece,
      deepCopy(currentPosition),
      currentOrientation,
    )
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  function addEvents() {
    // mouse drag pieces
    $board.on("mousedown", "." + CSS.square, mousedownSquare)
    $container.on(
      "mousedown",
      "." + CSS.sparePieces + " ." + CSS.piece,
      mousedownSparePiece,
    )

    // mouse enter / leave square
    $board
      .on("mouseenter", "." + CSS.square, mouseenterSquare)
      .on("mouseleave", "." + CSS.square, mouseleaveSquare)

    // piece drag
    const $window = $(window)
    $window
      .on("mousemove", throttledMousemoveWindow)
      .on("mouseup", mouseupWindow)

    // touch drag pieces
    if (isTouchDevice()) {
      $board.on("touchstart", "." + CSS.square, touchstartSquare)
      $container.on(
        "touchstart",
        "." + CSS.sparePieces + " ." + CSS.piece,
        touchstartSparePiece,
      )
      $window
        .on("touchmove", throttledTouchmoveWindow)
        .on("touchend", touchendWindow)
    }
  }

  function initDOM() {
    // create unique IDs for all the elements we will create
    createElIds()

    // build board and save it in memory
    $container.html(buildContainerHTML(config.sparePieces))
    $board = $container.find("." + CSS.board)

    if (config.sparePieces) {
      $sparePiecesTop = $container.find("." + CSS.sparePiecesTop)
      $sparePiecesBottom = $container.find("." + CSS.sparePiecesBottom)
    }

    // create the drag piece
    const draggedPieceId = uuid()
    // $("body").append(buildPieceHTML("wP", true, draggedPieceId))
    $container.append(buildPieceHTML("wP", true, draggedPieceId))
    $draggedPiece = $("#" + draggedPieceId)
    $draggedPiece.css({ display: "none" })

    // TODO: need to remove this dragged piece element if the board is no
    // longer in the DOM

    drawBoard()
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  setInitialState()
  initDOM()
  addEvents()

  // return the widget object
  return widget
}

// expose util functions
Chessboard.fenToObj = fenToObj
Chessboard.objToFen = objToFen

export default Chessboard
