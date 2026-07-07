import { noop } from "../../../../../42/lib/type/function/noop.js"

export function renderCanvas(ci, events, canvas) {
  const context = canvas.getContext("2d")
  if (context === null) {
    throw new Error("Unable to create 2d context on given canvas")
  }
  let frameWidth = 0
  let frameHeight = 0

  let rgba = new Uint8ClampedArray(0)

  const onResizeFrame = (w, h) => {
    frameWidth = w
    frameHeight = h
    canvas.width = frameWidth
    canvas.height = frameHeight
    rgba = new Uint8ClampedArray(w * h * 4)
  }

  events.onFrameSize(onResizeFrame)
  events.onFrame((frameRgb, frameRgba) => {
    if (frameRgb === null && frameRgba === null) {
      return
    }
    const frame = frameRgb === null ? frameRgba : frameRgb
    let frameOffset = 0
    let rgbaOffset = 0
    while (rgbaOffset < rgba.length) {
      rgba[rgbaOffset++] = frame[frameOffset++]
      rgba[rgbaOffset++] = frame[frameOffset++]
      rgba[rgbaOffset++] = frame[frameOffset++]
      rgba[rgbaOffset++] = 255
      if (frame.length === rgba.length) {
        frameOffset++
      }
    }
    context.putImageData(new ImageData(rgba, frameWidth, frameHeight), 0, 0)
  })
  onResizeFrame(ci.width(), ci.height())

  return () => {
    events.onFrameSize(noop)
    events.onFrame(noop)
  }
}
