import { on } from "../../../../42/lib/event/on.js"
import { glitch } from "../../../../42/lib/graphic/glitch.js"
import { screenshot } from "../../../../42/lib/graphic/screenshot.js"
import { sleep } from "../../../../42/lib/timing/sleep.js"
import { debounce } from "../../../../42/lib/timing/debounce.js"
import { confirm } from "../../../../42/ui/layout/dialog.js"
import { untilIdle } from "../../../../42/lib/timing/untilIdle.js"

let prefersReducedMotion = //
  matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  const { signal } = app

  const outputImage = new Image()
  document.documentElement.append(outputImage)

  let rafId
  let scramble
  let el
  let paused = false
  let running = false

  const selector = app.paths[0]
  if (selector) el = document.querySelector(selector)

  async function run() {
    if (running) return
    running = true
    paused = true
    cancelAnimationFrame(rafId)
    const canvas = await screenshot(el, { returnCanvas: true })

    let top = 0
    let left = 0

    if (el) {
      const rect = el.getBoundingClientRect()
      top = rect.top
      left = rect.left
    }

    outputImage.style.cssText = /* style */ `
      position: absolute;
      pointer-events: none;
      top: ${top}px;
      left: ${left}px;
      z-index: 1000000;
    `

    try {
      scramble = await glitch(canvas, {
        outputImage,
        quality: "random",
        iterations: "random",
        returnScramble: true,
      })
    } catch {
      running = false
      await sleep(10)
      return run()
    }

    running = false
    paused = false
    rafId = requestAnimationFrame(animateGlitch)
  }

  async function animateGlitch() {
    if (paused || signal.aborted) return

    await scramble()

    if (paused || signal.aborted) return

    await untilIdle({ timeout: 1000 })
    // await sleep(1000)

    if (paused || signal.aborted) return

    rafId = requestAnimationFrame(animateGlitch)
  }

  function init() {
    on({
      signal,

      "Escape || contextmenu": () => app.destroy(),
      "resize": debounce(() => {
        if (paused) return
        run()
      }, 100),

      "blur || pointerdown || keydown": () => {
        paused = true
        outputImage.classList.toggle("hide", true)
        cancelAnimationFrame(rafId)
      },
      "focus || pointerup || keyup": () => {
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(async () => {
          await run()
          outputImage.classList.toggle("hide", false)
        })
      },
    })

    run()
  }

  signal.addEventListener("abort", () => outputImage.remove())

  if (prefersReducedMotion) {
    confirm(
      "%md Corglitch displays **flashing** and **flickering** animations. Are you sure you want to continue?",
      {
        icon: "warning",
        label: "Epilepsy and Seizures warning !",
        dialog: { picto: app.getIcon("16x16") },
      },
    ).then((ok) => {
      prefersReducedMotion = !ok
      if (ok) init()
      else app.destroy()
    })
  } else init()
}
