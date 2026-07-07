import { sfxr, initSfxr, Params } from "/c/libs/jsfxr/1.2/jsfxr.js"

initSfxr()

const radar = document.querySelector("#radar")
const sweep = document.querySelector("#sweep")
let selectedDot = null
let offsetX = 0
let offsetY = 0
let dots = []
let dotsPos = []
const activeDots = new Set()
let lastSweepAngle = 0
let uniqueId = 0

function addDot(e) {
  const rect = radar.getBoundingClientRect()
  // console.log(e.x, e.y)
  const x = e.x - rect.left
  const y = e.y - rect.top

  const dot = document.createElement("div")
  dot.className = "dot"
  dot.style.left = `${x - 5}px`
  dot.style.top = `${y - 5}px`
  dot.draggable = true
  dot.dataset.id = uniqueId++
  const span = document.createElement("span")
  const sound = JSON.stringify(gen("random"))
  span.append(sound)
  dot.append(span)

  if (dots.length === 0) dotsPos = []
  dotsPos[dot.dataset.id] = [x, y, sound]

  dots.push(dot)
  dot.addEventListener("dragstart", (e) => {
    selectedDot = e.target
    const rect = selectedDot.getBoundingClientRect()
    offsetX = e.x - rect.left
    offsetY = e.y - rect.top
  })
  dot.addEventListener("dragend", (e) => {
    const rect = radar.getBoundingClientRect()
    const x = e.x - rect.left
    const y = e.y - rect.top
    selectedDot.style.left = `${x - offsetX}px`
    selectedDot.style.top = `${y - offsetY}px`
    selectedDot = null
  })
  dot.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    const index = dots.indexOf(dot)
    if (index !== -1) {
      dots.splice(index, 1)
    }

    e.target.remove()
  })
  radar.append(dot)
}

let cooldown = false
radar.addEventListener("pointermove", (e) => {
  if (!e.buttons || cooldown) return
  if (e.target.classList.contains("dot")) return

  cooldown = true

  addDot(e)

  setTimeout(() => {
    cooldown = false
  }, 50)
})

radar.addEventListener("pointerdown", (e) => {
  if (e.target.classList.contains("dot")) return
  e.preventDefault()
  addDot(e)
})

radar.addEventListener("dragover", (e) => {
  e.preventDefault()
})

function detectCollisions() {
  const sweepAngle = getSweepAngle()
  const rect = radar.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  dots.forEach((dot) => {
    const dotRect = dot.getBoundingClientRect()
    const dotX = dotRect.left + dotRect.width / 2
    const dotY = dotRect.top + dotRect.height / 2
    const angleToDot =
      Math.atan2(dotY - centerY, dotX - centerX) * (180 / Math.PI)
    const adjustedAngleToDot = angleToDot < 0 ? 360 + angleToDot : angleToDot
    const currentDifference = Math.abs(adjustedAngleToDot - sweepAngle)
    const previousDifference = Math.abs(adjustedAngleToDot - lastSweepAngle)
    if (currentDifference < 1 || previousDifference < 1) {
      if (!activeDots.has(dot)) {
        activeDots.add(dot)
        dot.classList.add("boop")
        const sound = JSON.parse(dot.querySelector("span").textContent)
        sound.p_env_decay *= Number(
          document.querySelector("#pot-decay span").textContent,
        )
        if (sound.p_env_decay < 0.1) sound.p_env_decay = 0.1
        sfxr.toAudio(sound).play()
      }
    } else if (activeDots.has(dot)) {
      activeDots.delete(dot)
      dot.classList.remove("boop")
    }
  })
  lastSweepAngle = sweepAngle
  requestAnimationFrame(detectCollisions)
}

function getSweepAngle() {
  const { transform } = window.getComputedStyle(sweep)
  if (transform === "none") return 0
  const values = transform.split("(")[1].split(")")[0].split(",")
  const a = values[0]
  const b = values[1]
  const radians = Math.atan2(b, a)
  const angle = Math.round(radians * (180 / Math.PI))
  return angle < 0 ? 360 + angle : angle
}

detectCollisions()

document.querySelector("#bomb").addEventListener("click", () => {
  radar.style.backgroundColor = "aqua"
  dots.forEach((dot) => dot.remove())
  dots = []
  activeDots.clear()
  const sound = gen("explosion")
  sfxr.toAudio(sound).play()
  setTimeout(() => {
    radar.style.backgroundColor = "yellowgreen"
  }, 5)
})

document.querySelector("#random").addEventListener("click", () => {
  const rect = radar.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const radius = rect.width / 2
  dots.forEach((dot) => {
    dot.classList.add("dot-move")
    const angle = Math.random() * 2 * Math.PI
    const distance = Math.random() * (radius - 20) + 20
    const x = centerX + distance * Math.cos(angle) - 5
    const y = centerY + distance * Math.sin(angle) - 5
    if (x >= 0 && x <= rect.width - 10 && y >= 0 && y <= rect.height - 10) {
      dot.style.left = `${x}px`
      dot.style.top = `${y}px`
    }
  })

  setTimeout(() => {
    dots.forEach((dot) => {
      dot.classList.remove("dot-move")
    })
  }, 500)
})

function gen(fx) {
  let PARAMS
  const SOUND_VOL = 0.25
  const SAMPLE_RATE = 44_100
  const SAMPLE_SIZE = 8
  PARAMS = new Params()
  PARAMS.sound_vol = SOUND_VOL
  PARAMS.sample_rate = SAMPLE_RATE
  PARAMS.sample_size = SAMPLE_SIZE
  if (fx.indexOf("#") == 0) {
    PARAMS.fromB58(fx.slice(1))
  } else {
    PARAMS[fx]()
  }

  PARAMS.p_env_attack = 0
  PARAMS.p_env_sustain = 0.073
  PARAMS.p_env_punch = 0
  return PARAMS
}

// pots :3

let movePot = false
let movePotValue = 0
let movePotPos = 0
let currentPot = ""

function updatePot(id, val) {
  if (val < -135) {
    val = -135
  }

  if (val > 135) {
    val = 135
  }

  const angle = val

  const potElement = document.getElementById(id)
  potElement.style.transform = "rotate(" + angle + "deg)"

  val = (val + 135) / 270
  potElement.querySelector("span").innerHTML = val.toFixed(2)
}

document.querySelectorAll(".pot").forEach((pot) => {
  pot.addEventListener("mousedown", function (e) {
    const y = e.clientY
    currentPot = this.id
    movePot = true
    const currentVal = Number.parseFloat(this.querySelector("span").innerHTML)
    movePotPos = y + Number.parseInt(currentVal * 270 - 135)
  })
})

document.documentElement.addEventListener("click", (e) => {
  if (movePot) {
    const y = e.clientY
    movePotValue = movePotPos - y
    updatePot(currentPot, movePotValue)
    movePot = false
    document.documentElement.style.cursor = ""
    document.documentElement.style.pointerEvents = ""
  }
})

document.addEventListener("mousemove", (e) => {
  if (movePot) {
    const y = e.clientY
    movePotValue = movePotPos - y
    updatePot(currentPot, movePotValue)
    document.documentElement.style.cursor = "row-resize"
    document.documentElement.style.pointerEvents = "none"
  }
})

const spanElement = document.querySelector("#pot-speed span")
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      let val = Number.parseFloat(spanElement.innerHTML)
      if (!isNaN(val)) {
        val = Math.abs(1 - val) * 8 + 0.01
        // sweep.style.animationDuration = val + "s"
        document.documentElement.style.setProperty("--speed", val + "s")
      }
    }
  })
})
observer.observe(spanElement, { childList: true, subtree: true })
document.querySelector("#pot-speed").style.transform = "rotate(-90deg)"

function dotBackup(id, x, y, sound) {
  const dot = document.createElement("div")
  dot.className = "dot"
  dot.style.left = `${x - 5}px`
  dot.style.top = `${y - 5}px`
  dot.draggable = true
  dot.dataset.id = id
  const span = document.createElement("span")
  const soundTextNode = document.createTextNode(sound)
  span.append(soundTextNode)
  dot.append(span)
  dots.push(dot)
  dot.addEventListener("dragstart", (e) => {
    selectedDot = e.target
    offsetX = e.clientX - selectedDot.getBoundingClientRect().left
    offsetY = e.clientY - selectedDot.getBoundingClientRect().top
  })
  dot.addEventListener("dragend", (e) => {
    const rect = radar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    selectedDot.style.left = `${x - offsetX}px`
    selectedDot.style.top = `${y - offsetY}px`
    dotsPos[dot.dataset.id][0] = x - offsetX
    dotsPos[dot.dataset.id][1] = y - offsetY
    selectedDot = null
  })
  dot.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    const index = dots.indexOf(dot)
    if (index !== -1) {
      dotsPos[dot.dataset.id] = [0, 0, ""]
      dots.splice(index, 1)
    }
    e.target.remove()
  })
  radar.append(dot)
}

document.querySelector("#backup").addEventListener("click", () => {
  radar.style.backgroundColor = "red"
  dots.forEach((dot) => dot.remove())
  dots = []
  activeDots.clear()
  for (let i = 0; i < dotsPos.length; i++) {
    if (dotsPos[i] != undefined) {
      if (dotsPos[i][2] != "") {
        dotBackup(i, dotsPos[i][0], dotsPos[i][1], dotsPos[i][2])
      }
    }
  }
  setTimeout(() => {
    radar.style.backgroundColor = "yellowgreen"
  }, 7)
  const sound = gen("powerUp")
  sfxr.toAudio(sound).play()
})

// addDot({ x: 100, y: 200 })
