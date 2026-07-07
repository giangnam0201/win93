import { until } from "../../../../42/lib/event/on.js"
import { screenshot } from "../../../../42/lib/graphic/screenshot.js"
import { repaintThrottle } from "../../../../42/lib/timing/repaintThrottle.js"
import { sleep } from "../../../../42/lib/timing/sleep.js"
import { noop } from "../../../../42/lib/type/function/noop.js"
import { toast } from "../../../../42/ui/layout/toast.js"
import { watchResize } from "../../../../42/lib/type/element/watchResize.js"
import { context2DClone } from "../../../../42/lib/graphic/canvas/context2DClone.js"
import { Canceller } from "../../../../42/lib/class/Canceller.js"

let canvas
let ctx

const elementsScreenshots = new WeakMap()

async function waitForRendering(el) {
  await sleep(0)

  const undones = [el.ready]

  for (const img of el.querySelectorAll("img")) {
    if (img.src) undones.push(img.decode().catch(noop))
  }

  for (const iframe of el.querySelectorAll("iframe")) {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
    if (iframeDoc.readyState === "complete") continue
    undones.push(until(iframe, "load"))
  }

  for (const component of el.querySelectorAll(
    "ui-picto, ui-menubar, ui-menu, ui-folder",
  )) {
    undones.push(component.ready)
  }

  for (const anim of el.getAnimations()) {
    undones.push(anim.finished)
  }

  await Promise.all(undones)
  await sleep(0)
}

function createCanvas(signal, previousCanvas) {
  canvas = previousCanvas ?? document.createElement("canvas")
  document.querySelector("ui-workspaces").prepend(canvas)
  canvas.className = "virus"
  canvas.style.position = "absolute"
  canvas.style.zIndex = "0"
  canvas.style.inset = "0"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.pointerEvents = "none"
  canvas.style.imageRendering = "pixelated"
  watchResize(canvas, { signal, firstCall: true }, ({ width, height }) => {
    const newCtx = context2DClone(canvas, { signal })
    canvas.width = width
    canvas.height = height
    ctx.drawImage(newCtx.canvas, 0, 0)
    context2DClone.recycle(newCtx)
  })

  ctx = canvas.getContext("2d")
  ctx.imageSmoothingEnabled = false

  let pair

  document.addEventListener(
    "pointerdown",
    (e) => {
      let current = /** @type {HTMLElement} */ (e.target)
      while (current && !elementsScreenshots.has(current)) {
        current = current.parentElement
      }

      if (current) {
        // const { zIndex } = getComputedStyle(current)
        // canvas.style.zIndex = Number(zIndex) - 1
        pair = [current, elementsScreenshots.get(current)]
      }
    },
    { signal },
  )

  document.addEventListener(
    "pointerup",
    () => {
      pair = undefined
    },
    { signal },
  )

  document.addEventListener(
    "pointermove",
    repaintThrottle((e) => {
      if (e.buttons && pair) {
        const [el, img] = pair
        if ("x" in el) {
          ctx.drawImage(img, el.x, el.y)
        } else {
          const rect = el.getBoundingClientRect()
          ctx.drawImage(img, rect.x, rect.y)
        }
      }
    }),
    { signal },
  )
}

export async function drawWithElement(el, signal) {
  let img

  if (elementsScreenshots.has(el)) {
    img = await screenshot(el, { signal })
    if (img) elementsScreenshots.set(el, img)
  } else {
    // console.warn(canvas)
    if (!canvas) createCanvas(signal)

    if (typeof el === "string") {
      const out = []

      for (const item of document.querySelectorAll(el)) {
        out.push(drawWithElement(item, signal))
      }

      return Promise.all(out).then((items) => () => {
        for (const draw of items) draw()
      })
    }

    await waitForRendering(el)
    if (signal?.aborted) return

    img = await screenshot(el, { signal })
    if (img) elementsScreenshots.set(el, img)

    // // img.style.position = "absolute"
    // // img.style.zIndex = "0"
    // // img.style.top = "0"
    // // img.style.left = "0"
    // // document.body.append(img)

    let canceller
    watchResize(el, { signal }, async () => {
      canceller?.cancel?.()
      canceller = new Canceller(signal)
      img = await screenshot(el, { signal: canceller.signal })
      if (img) elementsScreenshots.set(el, img)
    })
  }

  const draw = (x, y) => {
    if (!img) return

    if (x === undefined) {
      const rect = el.getBoundingClientRect()
      x = rect.x
      y = rect.y
    }

    ctx.drawImage(img, x, y)
  }

  draw()

  return draw
}

let previousApp

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  if (previousApp) {
    const previousCanvas = canvas
    previousApp.destroy()
    createCanvas(app.signal, previousCanvas)
  }
  previousApp = app

  if (app.config._.length > 0) {
    for (const selector of app.config._) drawWithElement(selector, app.signal)
    return
  }

  drawWithElement("ui-dialog", app.signal)

  document.addEventListener(
    "ui:dialog.open",
    (e) => drawWithElement(e.target, app.signal),
    { signal: app.signal },
  )

  toast("IE6 stopped responding, as expected", {
    picto: "error",
    label: "Oops",
    icon: app.getIcon(),
  })
}

export function destroyApp() {
  canvas?.remove()
  canvas = undefined
}
