import { pointer } from "../../../../../42/api/env/device/pointer.js"

const INSENSITIVE_PADDING = 0.01

/**
 * @param {PointerEvent} e
 * @param {HTMLElement} canvas
 * @param {*} ci
 */
function mapXY(e, canvas, ci) {
  if (document.pointerLockElement === canvas) {
    ci.sendMouseRelativeMotion(e.movementX, e.movementY)
    return
  }
  const { width: cWidth, height: cHeight } = canvas.getBoundingClientRect()
  const frameWidth = ci.width()
  const frameHeight = ci.height()

  const aspect = frameWidth / frameHeight

  let width = cWidth
  let height = cWidth / aspect

  if (height > cHeight) {
    height = cHeight
    width = cHeight * aspect
  }

  const top = (cHeight - height) / 2
  const left = (cWidth - width) / 2

  let x = Math.max(0, Math.min(1, (e.x - left) / width))
  let y = Math.max(0, Math.min(1, (e.y - top) / height))

  if (x <= INSENSITIVE_PADDING) x = 0
  if (x >= 1 - INSENSITIVE_PADDING) x = 1
  if (y <= INSENSITIVE_PADDING) y = 0
  if (y >= 1 - INSENSITIVE_PADDING) y = 1

  // return { x, y }
  ci.sendMouseMotion(x, y)
}

const mouseButtons = {
  0: 0,
  1: 2,
  2: 1,
}

export function mapMouse(ci, canvas) {
  function onMove(e) {
    mapXY(e, canvas, ci)
  }

  function onDown(e) {
    mapXY(e, canvas, ci)
    ci.sendMouseButton(mouseButtons[e.button] ?? 0, true)
  }

  function onUp(e) {
    mapXY(e, canvas, ci)
    ci.sendMouseButton(mouseButtons[e.button] ?? 0, false)
  }

  const abortController = new AbortController()
  const { signal } = abortController

  if (pointer.isMouse) {
    window.addEventListener("mousemove", onMove, { signal })
    window.addEventListener("mousedown", onDown, { signal })
    window.addEventListener("mouseup", onUp, { signal })
  } else {
    window.addEventListener("pointermove", onMove, { signal })
    window.addEventListener("pointerdown", onDown, { signal })
    window.addEventListener("pointerup", onUp, { signal })
    window.addEventListener("pointercancel", onUp, { signal })
  }

  return () => {
    abortController.abort()
  }
}
