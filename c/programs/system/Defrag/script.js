/*
 * DEFRAG - a jquery snake, by @jankenpopp
 * © 2014 WTFPL – Do What the Fuck You Want to Public License.
 */

import { glitch } from "../../../../42/lib/graphic/glitch.js"

const snakeArray = []
let intervalId

let gameover = 0
let playPause = 0

const bar = document.querySelector("progress")
const canvas = document.querySelector("canvas")
const ctx = canvas.getContext("2d")
const w = 640
const h = 400
const cw = 8
const ch = 10
let pourcent = 0
let score = 0
let d
let food

const nokiaTune = new Audio("./3310.wav")
const pickup = new Audio("./pickup.wav")
const over = new Audio("./gameover.mp3")

const imageSnake = new Image()
imageSnake.src = "./snake.gif"
const imageEmpty = new Image()
imageEmpty.src = "./empty.gif"
const imageFull = new Image()
imageFull.src = "./full.gif"

Promise.all([
  imageSnake.decode(),
  imageEmpty.decode(),
  imageFull.decode(),
]).then(init)

const lastSteps = []
for (let i = 40 - 1; i >= 0; i--) {
  lastSteps[i] = []
}

document.querySelector("#start").onclick = () => startGame()
document.querySelector("#pause").onclick = () => pauseGame()

function startGame() {
  playPause = 1

  $("#infos").text("Defragmenting file system...")
  $("#start").hide()
  $("#pause").show()

  if (nokiaTune) {
    nokiaTune.currentTime = 0
    nokiaTune.volume = 0.2
    nokiaTune.play()
    nokiaTune.loop = true
  } else {
    nokiaTune.load()

    pickup.volume = 0.25
    pickup.load()

    over.volume = 0.5
    over.load()

    nokiaTune.currentTime = 0
    nokiaTune.volume = 0.2
    nokiaTune.play()
    nokiaTune.loop = true
  }

  if (gameover === 1) init()
}

function pauseGame() {
  playPause = 0
  $("#infos").text(
    "Defragmention paused... click 'Start' to continue the process.",
  )
  $("#start").show()
  $("#pause").hide()
  nokiaTune.pause()
  gameover = 0
}

function init() {
  gameover = 0
  for (let x = 80 - 1; x >= 0; x--) {
    for (let y = 40 - 1; y >= 0; y--) {
      lastSteps[y][x] = 1
      ctx.drawImage(imageFull, x * cw, y * ch)
    }
  }

  lastSteps[0][0] = 0
  pourcent = 1
  bar.value = 0

  d = "right"
  createSnake()
  createFood()
  score = 0

  clearInterval(intervalId)
  intervalId = setInterval(paint, 60)
  canvas.style.filter = ""
}

function createSnake() {
  const length = 5
  snakeArray.length = 0
  for (let i = length - 1; i >= 0; i--) {
    snakeArray.push({ x: i, y: 0 })
  }
}

function createFood() {
  food = {
    x: Math.round((Math.random() * (w - cw)) / cw),
    y: Math.round((Math.random() * (h - ch)) / ch),
  }
}

function paint() {
  if (playPause === 1) {
    if (pourcent === 3200) {
      gameover = 1
      window.top.sys42.alert(
        `Congratulations !  \nYour score is ${score}.  \nPassword is FUTUR1993`,
        {
          label: "King of the day",
          icon: "/c/users/windows93/interface/icons/32x32/misc/trophy.png",
          picto: new URL("./icon-16.png", location.href).href,
        },
      )
      playPause = 0
      $("#infos").text("Done. Click 'Start' to retry.")
      $("#start").show()
      $("#pause").hide()
      nokiaTune.pause()
    }

    let nx = snakeArray[0].x
    let ny = snakeArray[0].y

    if (d === "right") nx++
    else if (d === "left") nx--
    else if (d === "up") ny--
    else if (d === "down") ny++

    if (
      nx === -1 ||
      nx === w / cw ||
      ny === -1 ||
      ny === h / ch ||
      checkCollision(nx, ny, snakeArray)
    ) {
      clearInterval(intervalId)
      over.play()
      gameover = 1
      playPause = 0
      $("#infos").text("Oops, something went wrong. Click 'Start' to retry.")
      $("#start").show()
      $("#pause").hide()
      nokiaTune.pause()

      // glitchCanvas2D(canvas)
      glitch(canvas, { iterations: 10, quality: 0.5 })

      return
    }

    for (let x = 80 - 1; x >= 0; x--) {
      for (let y = 40 - 1; y >= 0; y--) {
        if (lastSteps[y][x] === 0) {
          ctx.drawImage(imageEmpty, x * cw, y * ch)
        } else {
          ctx.drawImage(imageFull, x * cw, y * ch)
        }
      }
    }

    let tail
    if (nx === food.x && ny === food.y) {
      tail = { x: nx, y: ny }
      score++
      pickup.play()
      createFood()
    } else {
      tail = snakeArray.pop()
      tail.x = nx
      tail.y = ny
    }

    snakeArray.unshift(tail)

    for (let i = 0; i < snakeArray.length; i++) {
      const c = snakeArray[i]
      paintCell(c.x, c.y)
    }

    paintCell(food.x, food.y)
  }
}

function paintCell(x, y) {
  ctx.drawImage(imageSnake, x * cw, y * ch)

  if (lastSteps[y][x] === 1) {
    pourcent++
    lastSteps[y][x] = 0
    const fraction = pourcent / 3200
    const value = Math.round(fraction * 100)
    $("#pourcentage").text(value + "% Complete")
    bar.value = fraction
  }
}

function checkCollision(x, y, array) {
  for (let i = 0; i < array.length; i++) {
    if (array[i].x === x && array[i].y === y) {
      return true
    }
  }

  return false
}

document.addEventListener("keydown", ({ key, code }) => {
  if (key === "p") return playPause ? pauseGame() : startGame()

  if ((key === "ArrowLeft" || code === "KeyA") && d !== "right") { d = "left"
  } else if ((key === "ArrowUp" || code === "KeyW") && d !== "down") { d = "up"
  } else if ((key === "ArrowRight" || code === "KeyD") && d !== "left") { d = "right"
  } else if ((key === "ArrowDown" || code === "KeyS") && d !== "up") { d = "down"
  }
})

function glitchCanvas2D(canvas2D) {
  const ctx2D = canvas2D.getContext("2d")
  ctx2D.imageSmoothingEnabled = false
  const randomSaturate = 1 + Number(Math.random())
  const randomContrast = 1 + Number(Math.random())
  const randomHueRotate = Math.random() * 360
  canvas2D.style.filter = `invert(1) saturate(${randomSaturate}) contrast(${randomContrast}) hue-rotate(${randomHueRotate}deg)`
  const glitchAmount = Math.round(Math.random() * 150)
  ctx2D.drawImage(canvas2D, 0, 0, canvas2D.width, canvas2D.height)
  for (let i = 0; i < glitchAmount; i++) {
    const width = canvas2D.width * (0.1 + Math.random() * 0.4)
    const height = canvas2D.height * (0.05 + Math.random() * 0.2)
    const x = Math.random() * (canvas2D.width - width)
    const y = Math.random() * (canvas2D.height - height)
    const xOffset = (Math.random() - 0.5) * 30
    const yOffset = (Math.random() - 0.5) * 30
    ctx2D.drawImage(
      canvas2D,
      x,
      y,
      width,
      height,
      x + xOffset,
      y + yOffset,
      width,
      height,
    )
  }
}
