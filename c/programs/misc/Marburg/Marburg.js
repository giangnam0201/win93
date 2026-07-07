/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp({ signal }) {
  const canvas = document.createElement("canvas")
  canvas.className = "virus"
  canvas.style.position = "absolute"
  canvas.style.zIndex = "1000000"
  canvas.style.top = "0"
  canvas.style.left = "0"
  canvas.style.pointerEvents = "none"
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const context = canvas.getContext("2d")
  context.imageSmoothingEnabled = false

  const img = new Image()
  img.src = new URL("./error.png", import.meta.url).href

  const audio = new Audio(new URL("./blop.ogg", import.meta.url).href)

  /** @type {Marburg[]} */
  const marburgList = []

  function Marburg() {
    this.size = Math.floor(Math.random() * 128) + 32
    this.maxX = window.innerWidth - this.size
    this.maxY = window.innerHeight - this.size
    this.x = Math.floor(Math.random() * this.maxX)
    this.y = Math.floor(Math.random() * this.maxY)
  }

  function infect() {
    marburgList.push(new Marburg())
    audio.currentTime = 0
    audio.play()
  }

  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height)

    let i
    for (i = 0; i < marburgList.length; i++) {
      marburgList[i].x += Math.floor(Math.random() * 5) - 2
      marburgList[i].y += Math.floor(Math.random() * 5) - 2

      context.drawImage(
        img,
        marburgList[i].x,
        marburgList[i].y,
        marburgList[i].size,
        marburgList[i].size,
      )
    }
  }

  function animate() {
    if (signal.aborted) return
    draw()
    requestAnimationFrame(animate)
  }

  window.addEventListener("click", infect, { signal })

  window.addEventListener(
    "resize",
    () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    },
    { signal },
  )

  signal.addEventListener("abort", () => canvas.remove())

  document.body.append(canvas)

  await img.decode()
  infect()
  animate()
}
