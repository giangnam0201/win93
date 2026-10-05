/* global $ */

/*
  SOLITUDE - a jquery ui solitaire game, by Zombectro, with tricks from mrdoob
  © 2014 WTFPL – Do What the Fuck You Want to Public License.
*/

// TODO: fix dbclick on undercard auto placing in foundation

let intervalId
let rafId

const canvas = document.querySelector("canvas")
const context = canvas.getContext("2d")

// http://bost.ocks.org/mike/shuffle/
function shuffle(array) {
  let l = array.length
  let tmp
  let i

  while (l) {
    i = Math.floor(Math.random() * l--)
    tmp = array[l]
    array[l] = array[i]
    array[i] = tmp
  }

  return array
}

let cardStyl = ""
const cards = []

for (let i = 0, l = 13; i < l; i++) {
  cardStyl += `.c-hearts.cn-${i + 1} {background-position: ${-(i * 72)}px 0;}`
  cardStyl += `.c-diams.cn-${i + 1} {background-position: ${-(i * 72)}px -100px;}`
  cardStyl += `.c-clubs.cn-${i + 1} {background-position: ${-(i * 72)}px -200px;}`
  cardStyl += `.c-spades.cn-${i + 1} {background-position: ${-(i * 72)}px -300px;}`

  cards.push(
    `<div class="cards c-red c-hearts cn-${i + 1}" data-type="hearts" data-cid="${i + 1}"></div>`,
    `<div class="cards c-red c-diams cn-${i + 1}" data-type="diams" data-cid="${i + 1}"></div>`,
    `<div class="cards c-black c-clubs cn-${i + 1}" data-type="clubs" data-cid="${i + 1}"></div>`,
    `<div class="cards c-black c-spades cn-${i + 1}" data-type="spades" data-cid="${i + 1}"></div>`,
  )
}

const style = document.createElement("style")
style.textContent = cardStyl
document.head.append(style)

function klondike() {
  canvas.classList.toggle("hide", true)
  clearTimeout(intervalId)
  cancelAnimationFrame(rafId)

  const EL_CSS = {
    "top": "0",
    "left": "0",
    "z-index": "10",
  }

  const stock = $('<div id="stock">')
  const tableau = $('<div id="tableau">').html(
    "<div></div><div></div><div></div><div></div><div></div><div></div><div></div>",
  )
  const waste = $('<div id="waste">')
  const foundation =
    '<div class="blank"></div><div class="foundation cn-0"></div><div class="foundation cn-0"></div><div class="foundation cn-0"></div><div class="foundation cn-0"></div>'

  const stockCards = cards.slice(28)
  const tableCards = cards.slice(0, 28)

  const cTD = 3 // card Thick Divisor

  for (let i = 0, l = stockCards.length; i < l; i++) {
    $(stockCards[i])
      .css({ top: ~~(i / cTD), left: ~~(i / cTD) })
      .appendTo(stock)
  }

  for (let i = 0, l = tableCards.length; i < l; i++) {
    const el = $(tableCards[i]).addClass("turned")

    // @TODO : must find a nicer way to do that!
    if (i === 0) {
      tableau.children("div:eq(0)").append(el)
    } else if (i === 1) {
      tableau.children("div:eq(1)").append(el)
    } else if (i === 2) {
      tableau.children("div:eq(1)").find(":empty").append(el)
    } else if (i === 3) {
      tableau.children("div:eq(2)").append(el)
    } else if (i <= 5) {
      tableau.children("div:eq(2)").find(":empty").append(el)
    } else if (i === 6) {
      tableau.children("div:eq(3)").append(el)
    } else if (i <= 9) {
      tableau.children("div:eq(3)").find(":empty").append(el)
    } else if (i === 10) {
      tableau.children("div:eq(4)").append(el)
    } else if (i <= 14) {
      tableau.children("div:eq(4)").find(":empty").append(el)
    } else if (i === 15) {
      tableau.children("div:eq(5)").append(el)
    } else if (i <= 20) {
      tableau.children("div:eq(5)").find(":empty").append(el)
    } else if (i === 21) {
      tableau.children("div:eq(6)").append(el)
    } else if (i <= 28) {
      tableau.children("div:eq(6)").find(":empty").append(el)
    }
  }

  tableau.find(":empty").removeClass("turned")

  function cardMoved() {
    $("#tableau :empty").removeClass("turned")
    if (
      $(".foundation:eq(0) .cn-13").length > 0 &&
      $(".foundation:eq(1) .cn-13").length > 0 &&
      $(".foundation:eq(2) .cn-13").length > 0 &&
      $(".foundation:eq(3) .cn-13").length > 0
    ) {
      winGame()
    }
  }

  $("#cards-mat").html("").append(stock, waste, foundation, tableau)

  let timeout

  $("#waste, #tableau").on("dblclick", ".cards", function (e) {
    e.stopPropagation()
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }

    let validFoundationEmplacement = ""
    if ($(this).hasClass("cn-1")) {
      validFoundationEmplacement = ".foundation:empty:first"
    } else {
      const $this = $(this)
      $(".foundation .cards").each((i, el) => {
        if (
          $(el).is(
            ".cn-" + ($this.data("cid") - 1) + ".c-" + $this.data("type"),
          )
        ) {
          validFoundationEmplacement = $(el).parent()
        }
      })
    }

    if (validFoundationEmplacement) {
      $(this)
        .css(EL_CSS)
        .appendTo(validFoundationEmplacement)
        .delay(300)
        .queue(function () {
          $(this).css(EL_CSS).dequeue()
        })
      cardMoved()
    }
  })

  $("#stock")
    .on("click", ".cards:last", function (e) {
      e.stopPropagation()
      timeout = setTimeout(() => {
        const i = $("#waste .cards").length
        const css = { top: ~~(i / cTD), left: ~~(i / cTD), zIndex: 10 }
        $(this).css(css).appendTo("#waste")
        timeout = null
      }, 0)
    })
    .on("click", (e) => {
      e.stopPropagation()
      $($("#waste .cards").get().reverse()).each((i, el) => {
        $(el)
          .css({ top: ~~(i / cTD), left: ~~(i / cTD) })
          .appendTo("#stock")
      })
    })

  $(".foundation").droppable({
    tolerance: "pointer",
    hoverClass: "c-accept",
    accept(e) {
      if (
        ($(this).children().length === 0 &&
          $(this).hasClass("cn-" + (e.data("cid") - 1))) ||
        $(this)
          .children(".cards:last-child")
          .is(".cn-" + (e.data("cid") - 1) + ".c-" + e.data("type"))
      ) {
        return true
      }
    },
    drop(e, ui) {
      $(this).append(ui.draggable.css(EL_CSS))
      cardMoved()
    },
  })

  $("#tableau > div").droppable({
    tolerance: "pointer",
    accept(e) {
      if ($(this).children().length === 0 && e.hasClass("cn-13")) {
        return true
      }
    },
    hoverClass: "c-accept",
    drop(e, ui) {
      $(this).append(ui.draggable.css(EL_CSS))
      cardMoved()
    },
  })

  $("#cards-mat .cards")
    .draggable({
      revert: "invalid",
      distance: 10,
      revertDuration: 300,
      zIndex: 100,
      start(e, ui) {
        if (
          ui.helper.parent("#stock").length > 0 ||
          ui.helper.hasClass("turned")
        ) {
          ui.helper.css("zIndex", "auto")
          return false
        }
      },
    })
    .droppable({
      tolerance: "touch",
      hoverClass: "c-accept",
      accept(e) {
        if (
          $(this).children().length === 0 &&
          !$(this).is("#stock .cards") &&
          !$(this).is("#waste .cards") &&
          !$(this).is(".foundation .cards") &&
          ((e.hasClass("c-red") && $(this).hasClass("c-black")) ||
            (e.hasClass("c-black") && $(this).hasClass("c-red")))
        ) {
          return $(this).hasClass("cn-" + (e.data("cid") + 1))
        }
      },
      drop(e, ui) {
        e.stopPropagation()
        $(this).append(
          ui.draggable.css({
            "top": "18px",
            "left": "auto",
            "z-index": "10",
          }),
        )
        cardMoved()
      },
    })
}

/* MARK: win
============ */

function winGame() {
  canvas.classList.toggle("hide", false)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const cwidth = 72
  const cheight = 100
  const particles = []

  const Particle = function (id, x, y, sx, sy) {
    if (sx === 0) sx = 2
    const cx = (id % 13) * cwidth
    const cy = Math.floor(id / 13) * cheight

    this.update = function () {
      if (x < -cwidth || x > canvas.width + cwidth) {
        const index = particles.indexOf(this)
        particles.splice(index, 1)
        return false
      }

      if (y > canvas.height - cheight) {
        y = canvas.height - cheight
        sy = -sy * 0.85
      }

      sy += 0.98

      context.drawImage(image, cx, cy, cwidth, cheight, x, y, cwidth, cheight)

      x += sx
      y += sy

      return true
    }
  }

  const image = document.createElement("img")
  image.src = "cards.png"

  let cidH = 13
  let cidD = 26
  let cidC = 39
  let cidS = 52
  const throwCard = function (x, y, type) {
    let cid
    if (type === "hearts") {
      cidH > 0 ? cidH-- : (cidH = 12)
      cid = cidH
    } else if (type === "diams") {
      cidD > 13 ? cidD-- : (cidD = 25)
      cid = cidD
    } else if (type === "clubs") {
      cidC > 26 ? cidC-- : (cidC = 38)
      cid = cidC
    } else if (type === "spades") {
      cidS > 39 ? cidS-- : (cidS = 51)
      cid = cidS
    }

    const particle = new Particle(
      cid,
      x,
      y,
      Math.floor(Math.random() * 6 - 3) * 2,
      -Math.random() * 16,
    )
    particles.push(particle)
  }

  let switchType = 4
  const types = ["hearts", "diams", "clubs", "spades"]

  function start() {
    switchType > 0 ? switchType-- : (switchType = 3)
    const p1 = $(".foundation").eq(switchType).offset()
    throwCard(p1.left, p1.top, types[switchType])
  }

  function loop() {
    let i = 0
    let l = particles.length
    while (i < l) {
      particles[i].update() ? i++ : l--
    }

    rafId = requestAnimationFrame(loop)
  }

  loop()

  requestAnimationFrame(() => {
    start()
    intervalId = setInterval(start, 2000)
  })
}

/* MARK: mrdoob
=============== */

// mr doob <3
// http://mrdoob.com/lab/javascript/effects/solitaire/
function mrdoob() {
  canvas.classList.toggle("hide", false)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  let id = 52

  const cwidth = 72
  const cwidthhalf = cwidth / 2
  const cheight = 100
  const cheighthalf = cheight / 2

  const particles = []

  const Particle = function (id, x, y, sx, sy) {
    if (sx === 0) sx = 2

    const cx = (id % 13) * cwidth
    const cy = Math.floor(id / 13) * cheight

    this.update = function () {
      x += sx
      y += sy

      if (x < -cwidthhalf || x > canvas.width + cwidthhalf) {
        const index = particles.indexOf(this)
        particles.splice(index, 1)
        return false
      }

      if (y > canvas.height - cheighthalf) {
        y = canvas.height - cheighthalf
        sy = -sy * 0.85
      }

      sy += 0.98

      context.drawImage(
        image,
        cx,
        cy,
        cwidth,
        cheight,
        Math.floor(x - cwidthhalf),
        Math.floor(y - cheighthalf),
        cwidth,
        cheight,
      )

      return true
    }
  }

  const image = document.createElement("img")
  image.src = "cards.png"

  const throwCard = function (x, y) {
    id > 0 ? id-- : (id = 51)
    const particle = new Particle(
      id,
      x,
      y,
      Math.floor(Math.random() * 6 - 3) * 2,
      -Math.random() * 16,
    )
    particles.push(particle)
  }

  document.addEventListener(
    "mousedown",
    (e) => {
      e.preventDefault()
      document.addEventListener("mousemove", onMouseMove, false)
    },
    false,
  )
  document.addEventListener(
    "mouseup",
    (e) => {
      e.preventDefault()
      throwCard(e.clientX, e.clientY)
      document.removeEventListener("mousemove", onMouseMove, false)
    },
    false,
  )

  function onMouseMove(e) {
    e.preventDefault()
    throwCard(e.clientX, e.clientY)
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault()
      for (let i = 0; i < e.changedTouches.length; i++) {
        throwCard(e.changedTouches[0].pageX, e.changedTouches[0].pageY)
      }
    },
    false,
  )
  document.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault()
      for (let i = 0; i < e.touches.length; i++) {
        throwCard(e.touches[i].pageX, e.touches[i].pageY)
      }
    },
    false,
  )

  function loop() {
    let i = 0
    let l = particles.length
    while (i < l) {
      particles[i].update() ? i++ : l--
    }

    rafId = requestAnimationFrame(loop)
  }

  loop()
}

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

window.addEventListener("resize", resizeCanvas)

function newGame() {
  shuffle(cards)
  klondike()
}

// klondike()
// winGame()
// mrdoob()

newGame()

// @ts-ignore
window.newGame = newGame
// @ts-ignore
window.klondike = klondike
// @ts-ignore
window.winGame = winGame
// @ts-ignore
window.mrdoob = mrdoob

export {
  newGame, //
  winGame,
  klondike,
  mrdoob,
}
