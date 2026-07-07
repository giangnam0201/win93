import { RecyclePool } from "../../structure/Pool.js"

export const context2DPool = new RecyclePool(() => {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  })
  ctx.save()
  return ctx
})

export function context2DClone(img, options) {
  if (img.canvas) img = img.canvas
  const c = context2DPool.get(options)
  c.restore()
  c.canvas.width = img.width
  c.canvas.height = img.height
  if (options?.image !== false) c.drawImage(img, 0, 0)
  return c
}

context2DClone.recycle = (...items) => context2DPool.recycle(...items)
