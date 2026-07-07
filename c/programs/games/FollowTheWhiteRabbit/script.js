import terrain from "./assets/terrain.js"
import rabbit from "./assets/rabbit.js"
import { Game } from "./js/Game.js"
import { getDesktopRealm } from "../../../../42/api/env/realm/getDesktopRealm.js"
import { Rabbit } from "./js/Rabbit.js"
import { until } from "../../../../42/lib/event/on.js"

/** @type {HTMLCanvasElement} */
const canvas = document.querySelector("#gameCanvas")
const gameover = document.querySelector("#gameover")
const stepsDisplay = document.querySelector("#steps")
const maxStepsDisplay = document.querySelector("#max-steps-display")
const maxStepsValue = document.querySelector("#max-steps")

const terrainImg = new Image()
terrainImg.src = "assets/terrain.png"

const rabbitImg = new Image()
rabbitImg.src = "assets/rabbit.png"

await Promise.all([terrainImg.decode(), rabbitImg.decode()])

const desktopRealm = getDesktopRealm()

/** @type {import("../../../../42/ui/layout/dialog.js").DialogComponent} */
const dialogEl = window.frameElement
  ? window.frameElement.closest("ui-dialog")
  : null

const desktopFolderEl = desktopRealm.document.querySelector("#desktop")

const game = new Game(canvas, {
  terrain: {
    data: terrain,
    img: terrainImg,
  },
})

const sprite = new Rabbit(game, rabbitImg, rabbit, {
  speed: 1,
  maxSpeed: 10,
  debug: false,
})
game.addEntity(sprite)
sprite.setState("idle")

let isGameOver = false
// let rafId
let timerId

let iframeGlobalW
let iframeGlobalH

function generate() {
  clearTimeout(timerId)
  isGameOver = false
  gameover.classList.add("hide")

  sprite.speed = 1
  sprite.steps = 0
  sprite.idleTimer = 0
  sprite.setState("idle")

  let w
  let h

  if (dialogEl) {
    const drect = desktopFolderEl.getBoundingClientRect()
    w = Math.ceil(drect.width / 32) + 2
    h = Math.ceil(drect.height / 32) + 2
    game.desktopWidth = drect.width
    game.desktopHeight = drect.height
  } else {
    w = Math.ceil(desktopRealm.innerWidth / 32) + 2
    h = Math.ceil(desktopRealm.innerHeight / 32) + 2
    game.desktopWidth = desktopRealm.innerWidth
    game.desktopHeight = desktopRealm.innerHeight
  }

  let iframeGlobalX = 0
  let iframeGlobalY = 0
  iframeGlobalW = window.innerWidth
  iframeGlobalH = window.innerHeight

  if (dialogEl) {
    const rect = window.frameElement.getBoundingClientRect()
    iframeGlobalX = Math.round(rect.x)
    iframeGlobalY = Math.round(rect.y)
  }

  let startX = Math.floor((iframeGlobalX + iframeGlobalW / 2) / 32)
  let startY = Math.floor((iframeGlobalY + iframeGlobalH / 2) / 32)

  startX = Math.max(2, Math.min(w - 3, startX))
  startY = Math.max(2, Math.min(h - 3, startY))

  game.generateMap(w, h, { startX, startY, algo: "simplex" })

  sprite.x = startX * game.tileSize - 16
  sprite.y = startY * game.tileSize - 16
}

function tick() {
  requestAnimationFrame(tick)

  let iframeGlobalX = 0
  let iframeGlobalY = 0

  if (dialogEl) {
    const rect = window.frameElement.getBoundingClientRect()
    iframeGlobalX = Math.round(rect.x)
    iframeGlobalY = Math.round(rect.y)
  }

  canvas.style.transform = `translate(${-iframeGlobalX}px, ${-iframeGlobalY}px)`

  if (isGameOver) return

  // Check Game Over
  const rabbitCX = sprite.x + sprite.hitbox.x + sprite.hitbox.width / 2
  const rabbitCY = sprite.y + sprite.hitbox.y + sprite.hitbox.height / 2

  if (
    rabbitCX < iframeGlobalX ||
    rabbitCX > iframeGlobalX + iframeGlobalW ||
    rabbitCY < iframeGlobalY ||
    rabbitCY > iframeGlobalY + iframeGlobalH
  ) {
    isGameOver = true
    stepsDisplay.textContent = String(sprite.steps)

    const prevMax = Number.parseInt(
      localStorage.getItem("FTWR_MAX_STEPS") || "0",
      10,
    )
    const newMax = Math.max(prevMax, sprite.steps)
    if (newMax > 20) {
      const max = String(newMax)
      localStorage.setItem("FTWR_MAX_STEPS", max)
      maxStepsValue.textContent = max
      maxStepsDisplay.classList.remove("hide")
    } else {
      maxStepsDisplay.classList.add("hide")
    }

    gameover.classList.remove("hide")
    timerId = setTimeout(generate, 3400)
  }
}

generate()
requestAnimationFrame(tick)

desktopRealm.addEventListener("resize", generate)
gameover.addEventListener("click", generate)

let toast
let keydowns = 0
let keydownsToast
window.addEventListener("keydown", async (e) => {
  if (e.code === "Enter") return generate()
  if (keydownsToast) return
  keydowns++
  if (keydowns < 3) return
  keydownsToast = true
  toast ??= await import("../../../../42/ui/layout/toast.js") //
    .then((m) => m.toast)
  const el = await toast("This is not WhiteRabbitSimulator", {
    picto: "emblems/info",
  })
  await until(el, "ui:toast.close")
  keydownsToast = false
})

let clicks = 0
let clicksToast
window.addEventListener("click", async (e) => {
  if (gameover.contains(e.target)) return
  if (clicksToast) return
  clicks++
  if (clicks < 8) return
  clicksToast = true
  toast ??= await import("../../../../42/ui/layout/toast.js") //
    .then((m) => m.toast)
  const el = await toast("Think outside the box", {
    picto: "emblems/info",
  })
  await until(el, "ui:toast.close")
  clicksToast = false
})

window.addEventListener("contextmenu", (e) => e.preventDefault())

const audio = new Audio("./assets/rabbit.ogg")
audio.loop = true
audio.play()
