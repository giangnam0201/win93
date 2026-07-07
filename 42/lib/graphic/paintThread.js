import { threadify } from "../../api/threadify.js"
import { untilConnected } from "../type/element/untilConnected.js"
import { watchResize } from "../type/element/watchResize.js"

/** @import { Thread } from "../../api/threadify.js" */

/**
 * @typedef {Thread & {
 *   setup: Function,
 *   resize: Function,
 *   carry: Function,
 *   configure: Function,
 * }} PaintThread
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string | URL} url
 * @param {any} [options]
 */
async function setupCanvas(canvas, url, options) {
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  const offscreen = canvas.transferControlToOffscreen()
  options?.resize?.(canvas.width, canvas.height, canvas, offscreen)

  const transfer = options?.transfer ? [options.transfer].flat() : []

  const out = /** @type {PaintThread} */ (
    await threadify(url, {
      throttleExports: ["resize"],
      calls: {
        carry: {
          getTransfer([message, transfer]) {
            return {
              args: [message],
              transfer,
            }
          },
        },
        setup: {
          getTransfer() {
            return {
              args: [{ ...options?.init, canvas: offscreen }],
              transfer: [offscreen, ...transfer],
            }
          },
        },
      },
      ...options,
    })
  )

  out.setup?.().then(() => {
    canvas.classList.toggle("canvas-ready", true)
  })

  if (out.resize) {
    watchResize(
      canvas,
      {
        signal: out.signal,
        firstCall: true,
        throttle: false,
      },
      () => {
        const { offsetWidth, offsetHeight } = canvas
        options?.resize?.(offsetWidth, offsetHeight)
        out.resize(offsetWidth, offsetHeight)
      },
    )
  }

  return out
}

/**
 * @param {string | URL} url
 * @returns {{canvas: HTMLCanvasElement, thread: Promise<PaintThread>}}
 */
export function paintThread(url, options) {
  const canvas = options?.canvas ?? document.createElement("canvas")

  const thread = canvas.isConnected
    ? setupCanvas(canvas, url, options)
    : untilConnected(canvas).then(() => setupCanvas(canvas, url, options))

  return { canvas, thread }
}
