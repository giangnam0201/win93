import { ensureElement } from "./ensureElement.js"
import { Emitter } from "../../class/Emitter.js"

const emitters = new WeakMap()

function makeEmitter(root) {
  const emitter = new Emitter()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.addedNodes.length > 0) emitter.emit("connect")
    }
  })

  observer.observe(root, { childList: true, subtree: true })

  // @ts-ignore
  emitter.observer = observer
  return emitter
}

/**
 * Returns a Promise that resolves when the element is connected to the DOM.
 *
 * @param {string | HTMLElement} el
 * @param {{signal?: AbortSignal, root?: HTMLElement}} [options]
 * @returns {Promise<HTMLElement>}
 */
export async function untilConnected(el, options) {
  const root = options?.root ?? document.documentElement

  /** @type {HTMLElement} */
  let out
  let check

  if (typeof el === "string") {
    const selector = el
    out = root.querySelector(selector)
    if (out) return out
    check = () => {
      out = root.querySelector(selector)
      if (out) return true
    }
  } else {
    out = ensureElement(el, root)
    if (out.isConnected) return el
    check = () => out.isConnected
  }

  // @ts-ignore
  const signal = options?.signal ?? el.signal

  let emitter = emitters.get(root)
  if (!emitter) {
    emitter = makeEmitter(root)
    emitters.set(root, emitter)
  }

  return new Promise((resolve) => {
    const end = () => {
      if (signal?.aborted || check()) {
        resolve(out)
        off()
        if ("connect" in emitter[Emitter.EVENTS] === false) {
          emitter.observer.disconnect()
          delete emitter.observer
          emitter = undefined
          emitters.delete(root)
        }
      }
    }

    signal?.addEventListener("abort", () => end())
    const off = emitter.on("connect", { off: true }, end)
  })
}
