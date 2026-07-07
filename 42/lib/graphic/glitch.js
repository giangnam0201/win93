import { untilNextTask } from "../timing/untilNextTask.js"

const base64Chars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

const RAD = 2 * Math.PI - (180 * Math.PI) / 180

function glitchDataURL(buffer) {
  const header = 23 // data:image/jpeg;base64,
  const rnd = Math.floor(header + Math.random() * (buffer.length - header - 4))
  const char = base64Chars[Math.floor(Math.random() * base64Chars.length)]
  return buffer.slice(0, rnd) + char + buffer.slice(rnd + 1)
}

function makeCanvas() {
  const canvas = document.createElement("canvas")
  return {
    canvas,
    ctx: canvas.getContext("2d"),
  }
}

export async function glitch(source, options) {
  const cnv = {
    orig: makeCanvas(),
    flip: makeCanvas(),
    temp: makeCanvas(),
  }

  let url
  let sourceIsImage
  let sourceIsCanvas

  if (typeof source === "string") {
    url = source
  } else if (source.src) {
    sourceIsImage = true
    url = source.src
  } else if (source.toDataURL) {
    sourceIsCanvas = true
    url = source.toDataURL()
  }

  const tmpImage = new Image()
  const outputImage = options?.outputImage ?? new Image()

  outputImage.src = url

  try {
    await outputImage.decode()
  } catch (cause) {
    throw new Error(cause.message, { cause })
  }

  const { width, height } = outputImage

  cnv.temp.canvas.width = width
  cnv.temp.canvas.height = height

  cnv.orig.canvas.width = width
  cnv.orig.canvas.height = height
  cnv.orig.ctx.drawImage(outputImage, 0, 0)

  cnv.flip.canvas.width = width
  cnv.flip.canvas.height = height
  cnv.flip.ctx.translate(width / 2, height / 2)
  cnv.flip.ctx.rotate(RAD)
  cnv.flip.ctx.drawImage(outputImage, -width / 2, -height / 2, width, height)

  cnv.temp.ctx.translate(width / 2, height / 2)
  cnv.temp.ctx.rotate(RAD)

  const config = options

  async function scramble(options = config) {
    const iterations =
      options?.iterations === "random"
        ? Math.random() *
          (Math.random() > 0.9 ? 500 : Math.random() > 0.7 ? 50 : 5)
        : (options?.iterations ?? 10)

    const quality =
      options?.quality === "random" //
        ? Math.random()
        : (options?.quality ?? 0.99)

    const flip =
      options?.flip ??
      (options?.autoFlip === false ? false : Math.random() > 0.5)

    let dataURL = cnv[flip ? "flip" : "orig"].canvas.toDataURL(
      "image/jpeg",
      quality,
    )

    for (let i = 0; i < iterations; i++) dataURL = glitchDataURL(dataURL)

    tmpImage.src = dataURL

    try {
      await tmpImage.decode()
      if (
        !(
          tmpImage.width === outputImage.width &&
          tmpImage.height === outputImage.height
        )
      ) {
        throw new Error()
      }
    } catch {
      await untilNextTask()
      return scramble(options)
    }

    if (flip) {
      cnv.temp.ctx.drawImage(tmpImage, -width / 2, -height / 2, width, height)
      outputImage.src = cnv.temp.canvas.toDataURL()
    } else {
      outputImage.src = tmpImage.src
    }

    return outputImage
  }

  if (options?.init !== false) await scramble()

  if (options?.returnScramble) return scramble

  if (sourceIsCanvas) {
    const canvas = source
    const ctx = canvas.getContext("2d")
    ctx.drawImage(outputImage, 0, 0, canvas.width, canvas.height)
    return
  }

  if (sourceIsImage) {
    source.src = outputImage.src
    return
  }

  return outputImage
}
