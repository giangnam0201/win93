import { App } from "../../../../42/api/os/App.js"
import { on } from "../../../../42/lib/event/on.js"
import { Piece } from "./js/Piece.js"
import { Renderer } from "./js/Renderer.js"
import { Tetris } from "./js/Tetris.js"

const app = new App()

// TODO: https://firstpersontetris.com/

const state = await app.initState({
  difficulty: "normal",
  mode: "reverse",
})

/** @type {HTMLDivElement} */
const gameEl = document.querySelector("#game")
const gridEl = document.querySelector("#grid")
const scoreEl = document.querySelector("#score")
const nextRendererCanvas = document.querySelector("#next")
const gameoverEl = document.querySelector("#gameover")

const nextRenderer = new Renderer({
  canvas: nextRendererCanvas,
  columns: 4,
  rows: 4,
})

const tetris = new Tetris({ canvas: gridEl })

tetris
  .on("next", (piece) => {
    nextRenderer.clear()
    nextRenderer.drawPieceCentered(piece)
  })
  .on("score", (score) => {
    scoreEl.textContent = score
  })
  .on("gameover", async () => {
    gameEl.classList.toggle("action-false", true)
    gameoverEl.classList.toggle("hide", false)
    gameoverEl.textContent = state.mode === "reverse" ? "You win!" : "You lose!"
    resetBag()

    setTimeout(() => {
      const off = on({
        "prevent": true,
        "repeat": false,
        "pointerdown || keydown"() {
          gameoverEl.classList.toggle("hide", true)
          gameEl.classList.toggle("action-false", false)
          tetris.reset()
          if (state.mode !== "reverse") tetris.start()
          off()
        },
      })
    }, 1000)
  })

const shortcuts = {
  "O || Digit1 || Numpad1": () => dropPiece(1),
  "J || Digit2 || Numpad2": () => dropPiece(2),
  "L || Digit3 || Numpad3": () => dropPiece(3),
  "Z || Digit4 || Numpad4": () => dropPiece(4),
  "S || Digit5 || Numpad5": () => dropPiece(5),
  "T || Digit6 || Numpad6": () => dropPiece(6),
  "I || Digit7 || Numpad7": () => dropPiece(7),
}

const keys = Object.keys(shortcuts)
const bag = []

function drawPieceButtons() {
  for (let i = 1; i <= 7; i++) {
    const button = /** @type {HTMLButtonElement} */ (
      document.querySelector(`#piece${i}`)
    )
    bag.push(button)
    button.title = keys[i - 1].split(" || ").join(", ")
    const renderer = new Renderer({
      canvas: button.firstElementChild,
      columns: 4,
      rows: 4,
    })
    renderer.drawPieceCentered(Piece.fromIndex(i))
  }
}

function dropPiece(idx) {
  const target = bag[idx - 1]

  if (state.difficulty !== "easy") {
    if (target.disabled) return

    if (bag.every((button) => button.disabled || button === target)) {
      for (const button of bag) {
        button.disabled = false
        button.ariaPressed = false
      }
    }

    target.disabled = true
    target.ariaPressed = true
  }

  if (tetris.workingPiece) return

  const piece = tetris.ai.best(tetris.grid, [Piece.fromIndex(idx)])
  tetris.workingPiece = piece
  tetris.dropPiece(false)
}

on(
  {
    selector: "#bag button",
    click(e, target) {
      tetris.aiEnabled = false
      const idx = Number(target.id.slice(-1))
      dropPiece(idx)
    },
  },
  {
    repeatable: true,
    ...shortcuts,
  },
)

gridEl.classList.toggle(state.mode, true)

// @ts-ignore
window.tetris = tetris
// @ts-ignore
window.state = state
// @ts-ignore
window.newGame = () => {
  resetBag()
  tetris.reset()
  if (state.mode === "normal") tetris.start()
}

function resetBag() {
  for (const button of bag) {
    button.disabled = false
    button.ariaPressed = false
  }
}

let reverseModeInited = false

function setMode(value) {
  gameEl.style.removeProperty("display")
  state.mode = value

  tetris.score = 0
  tetris.emit("score", tetris.score)

  if (state.mode === "reverse") {
    if (!reverseModeInited) {
      drawPieceButtons()
      reverseModeInited = true
    }
    gameEl.classList.toggle("reverse-tetris", true)
    tetris.aiEnabled = true
    tetris.renderer.reverse = true
    tetris.draw()
    tetris.timer.start()
    tetris.dropPiece(false)
  } else {
    gameEl.classList.toggle("reverse-tetris", false)
    tetris.aiEnabled = false
    tetris.renderer.reverse = false
    tetris.stop()
    tetris.start()
  }
}

function setDifficulty(value) {
  state.difficulty = value

  if (state.difficulty === "normal") {
    tetris.ai.setWeights("dumb")
  } else {
    tetris.ai.setWeights("smart")
  }

  resetBag()
}

setMode(state.mode)
setDifficulty(state.difficulty)

// @ts-ignore
window.setDifficulty = setDifficulty
// @ts-ignore
window.setMode = setMode

// document.addEventListener("keydown", ({ code }) => {
//   if (code === "Backspace") {
//     if (state.mode === "reverse") {
//       setMode("normal")
//     } else {
//       setMode("reverse")
//     }
//   }
// })
