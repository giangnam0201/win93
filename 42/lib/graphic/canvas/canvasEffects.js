import {
  context2DClone as clone,
  context2DPool as pool,
} from "./context2DClone.js"

// prettier-ignore
const outlineTypes = {
  cross: [
     1,  0,
     0,  1,
    -1,  0,
     0, -1,
  ],
  square: [
     1,  0,
     0,  1,
    -1,  0,
     0, -1,
    -1, -1,
     1,  1,
    -1,  1,
     1, -1,
  ],
}

export const canvasEffects = {
  fill(ctx, fill) {
    ctx.save()
    ctx.globalCompositeOperation = "source-in"
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
  },

  colorize(ctx, color, alpha = 0.5) {
    const c = clone(ctx)
    console.log(c)
    c.globalCompositeOperation = "source-in"
    c.globalAlpha = alpha
    c.fillStyle = color
    c.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.save()
    ctx.globalCompositeOperation = "color"
    ctx.drawImage(c.canvas, 0, 0)
    ctx.restore()
    pool.recycle(c)
  },

  mirrorX(ctx) {
    const a = clone(ctx)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.save()
    ctx.translate(ctx.canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(a.canvas, 0, 0)
    ctx.restore()
    pool.recycle(a)
  },

  mirrorY(ctx) {
    const a = clone(ctx)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.save()
    ctx.translate(0, ctx.canvas.height)
    ctx.scale(1, -1)
    ctx.drawImage(a.canvas, 0, 0)
    ctx.restore()
    pool.recycle(a)
  },

  shadow(ctx, data) {
    const a = clone(ctx)
    const b = clone(ctx, { image: false })

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    for (const { x, y, color } of [data].flat()) {
      b.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      b.drawImage(a.canvas, x, y)
      b.globalCompositeOperation = "source-in"
      b.fillStyle = color
      b.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      b.globalCompositeOperation = "source-over"
      ctx.drawImage(b.canvas, 0, 0)
    }

    ctx.drawImage(a.canvas, 0, 0)

    pool.recycle(a, b)
  },

  light(ctx, data) {
    const a = clone(ctx)
    const b = clone(ctx, { image: false })
    const c = clone(ctx, { image: false })

    for (const { x, y, color } of [data].flat()) {
      b.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      b.drawImage(a.canvas, x, y)
      c.drawImage(a.canvas, 0, 0)
      c.globalCompositeOperation = "destination-out"
      c.drawImage(b.canvas, 0, 0)
      c.globalCompositeOperation = "source-over"
      b.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      b.drawImage(c.canvas, 0, 0)
      b.globalCompositeOperation = "source-in"
      b.fillStyle = color
      b.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      a.drawImage(b.canvas, 0, 0)
    }

    ctx.drawImage(a.canvas, 0, 0)
    pool.recycle(a, b, c)
  },

  outline(ctx, colors, outlineType = "cross") {
    const a = clone(ctx)
    const outline = outlineTypes[outlineType]

    for (const color of [colors].flat()) {
      for (let i = 0, l = outline.length; i < l; i++) {
        ctx.drawImage(a.canvas, outline[i], outline[++i])
      }

      ctx.save()
      ctx.globalCompositeOperation = "source-in"
      ctx.fillStyle = color
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.restore()
      ctx.drawImage(a.canvas, 0, 0)
      a.drawImage(ctx.canvas, 0, 0)
    }

    pool.recycle(a)
  },

  stroke(ctx, colors, outlineType = "cross") {
    const { canvas } = ctx

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data } = imageData

    for (let i = 0, l = data.length; i < l; i += 4) {
      if (data[i + 3] > 0 && data[i + 3] < 255) data[i + 3] = 255
    }

    ctx.putImageData(imageData, 0, 0)

    const a = clone(ctx)
    const b = clone(ctx)
    const outline = outlineTypes[outlineType]

    for (const color of [colors].flat()) {
      for (let i = 0, l = outline.length; i < l; i++) {
        ctx.drawImage(a.canvas, outline[i], outline[++i])
      }

      ctx.globalCompositeOperation = "source-in"
      ctx.fillStyle = color
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      a.drawImage(ctx.canvas, 0, 0)
    }

    ctx.save()
    ctx.globalCompositeOperation = "destination-out"
    ctx.drawImage(b.canvas, 0, 0)
    ctx.restore()

    pool.recycle(a, b)
  },
}
