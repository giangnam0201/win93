const font = new FontFace(
  "Matrix",
  `url(${import.meta.resolve("./Matrix-Code.ttf")})`,
)
document.fonts.add(font)

const { random, round, floor } = Math

const canvas = document.createElement("canvas")
document.body.append(canvas)
const ctx = canvas.getContext("2d")
ctx.shadowOffsetX = 0
ctx.shadowOffsetY = 0
ctx.shadowBlur = 10

const chars =
  '"*+012345789:<>z|¦©╌▪アウエオカキケコサシスセソタツテナニヌネハヒホマミムメモヤヨラリワー꞊' //
    .split("")

const yPositions = []

let size
let ch

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  size = Math.max(10, window.innerWidth / 90)
  ch = size - size * 0.1

  ctx.font = `${size}px Matrix, monospace`

  const l = window.innerWidth / ch
  const h = (window.innerHeight / size) * 6

  yPositions.length = 0
  for (let i = 0; i < l; i++) {
    yPositions.push(-round(random() * h))
  }
}

resizeCanvas()

window.addEventListener("resize", resizeCanvas, false)

function draw() {
  ctx.shadowColor = "rgba(0,0,0,0)"
  ctx.fillStyle = "rgba(0,0,0,0.1)"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let i = 0, l = yPositions.length; i < l; i++) {
    const y = yPositions[i]
    const text = chars[floor(chars.length * random())]
    const x = i * ch
    ctx.fillStyle = "#44ff00"
    ctx.shadowColor = "rgba(70,255,0,0.3)"
    ctx.fillText(text, x, y)
    ctx.fillStyle = "rgba(234,255,165," + random() + ")"
    ctx.fillText(text, x, y)

    if (random() > 0.45) {
      const stay = y > 100 + random() * 1e4
      yPositions[i] = stay ? 0 : y + size
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.5)"
      ctx.fillStyle = "rgba(45,127,0,1)"
      ctx.fillText(text, x, y)
    }
  }
}

await font.load()
setInterval(() => requestAnimationFrame(draw), 60)

export {}
