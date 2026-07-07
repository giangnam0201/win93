import { untilNextRepaint } from "../timing/untilNextRepaint.js"

const cursorOverlay = document.createElement("div")

cursorOverlay.id = "cursor-overlay"
cursorOverlay.style.cssText = /* style */ `
  display: none;
  position: absolute;
  inset: 0;
  z-index: var(--z-cursor);`

document.documentElement.append(cursorOverlay)

cursorOverlay.addEventListener("pointerdown", () => {
  cursorOverlay.style.display = "none"
})

// import { dispatch } from "../event/dispatch.js"
// cursorOverlay.addEventListener("pointerdown", ({ x, y }) => {
//   cursorOverlay.style.display = "none"
//   const el = document.elementFromPoint(x, y)
//   if (el) dispatch(el, "pointerdown")
// })

/**
 * @param {HTMLElement} [el]
 */
export function unsetCursor(el = document.documentElement) {
  if (el === cursorOverlay) cursorOverlay.style.display = "none"

  for (let i = el.classList.length - 1; i >= 0; i--) {
    const className = el.classList[i]
    if (className.startsWith("cursor-")) {
      el.classList.remove(className)
    }
  }
}

/**
 * @param {string | false} [cursor]
 * @param {HTMLElement} [el]
 */
export function setCursor(cursor, el = document.documentElement) {
  if (cursor) {
    cursor = `cursor-${cursor}`
    if (el.classList.contains(cursor)) return
    unsetCursor(el)
    if (el === cursorOverlay) cursorOverlay.style.display = "block"
    el.classList.add(cursor)
  } else {
    unsetCursor(el)
  }
}

/**
 * @param {string} cursor
 * @param {boolean} [force]
 * @param {HTMLElement} [el]
 */
export function toggleCursor(cursor, force, el = document.documentElement) {
  force ??= !el.classList.contains(`cursor-${cursor}`)
  if (force) setCursor(cursor, el)
  else unsetCursor(el)
}

export async function wrapCursor(
  cursor,
  options,
  fn,
  el = document.documentElement,
) {
  if (typeof options === "function") {
    // @ts-ignore
    el = fn
    fn = options
    options = {}
  }

  if (options?.overlay) el = cursorOverlay

  setCursor(cursor, el)
  await untilNextRepaint()

  let res
  try {
    res = await fn()
    unsetCursor(el)
    await untilNextRepaint()
    return res
  } catch (err) {
    unsetCursor(el)
    await untilNextRepaint()
    throw err
  }
}

class Cursor {
  set = setCursor
  unset = unsetCursor
  toggle = toggleCursor
  wrap = wrapCursor
}

export const cursor = new Cursor()
