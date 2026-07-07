import { ensureElement } from "./ensureElement.js"
import { Emitter } from "../../class/Emitter.js"

const emitters = new WeakMap()

function makeEmitter(root) {
  const emitter = new Emitter()

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          emitter.emit("visible", entry)
        }
      }
    },
    { root },
  )

  // @ts-ignore
  emitter.observer = observer
  return emitter
}

/**
 * Returns a Promise that resolves when the element is visible.
 *
 * @template T
 * @param {string | HTMLElement} el
 * @param {{signal?: AbortSignal, root?: HTMLElement}} [options]
 * @returns {Promise<HTMLElement>}
 */
export async function untilVisible(el, options) {
  el = ensureElement(el)

  if (el.checkVisibility?.() === true) return el

  // @ts-ignore
  const signal = options?.signal ?? el.signal
  const root = options?.root ?? document.documentElement

  let emitter = emitters.get(root)
  if (!emitter) {
    emitter = makeEmitter(root)
    emitters.set(root, emitter)
  }

  return new Promise((resolve) => {
    const end = (entry) => {
      if (entry.target === el) {
        resolve(el)
        emitter.observer.unobserve(el)
        off()
        if ("visible" in emitter[Emitter.EVENTS] === false) {
          emitter.observer.disconnect()
          delete emitter.observer
          emitter = undefined
          emitters.delete(root)
        }
      }
    }

    signal?.addEventListener("abort", () => end(el))
    const off = emitter.on("visible", { off: true }, end)
    emitter.observer.observe(el)
  })
}
