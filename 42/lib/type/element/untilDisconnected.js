import { ensureElement } from "./ensureElement.js"
import { Emitter } from "../../class/Emitter.js"

const emitters = new WeakMap()

function makeEmitter(parent) {
  const emitter = new Emitter()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.removedNodes.length > 0) emitter.emit("disconnect")
    }
  })

  observer.observe(parent, { childList: true })

  // @ts-ignore
  emitter.observer = observer
  return emitter
}

/**
 * Returns a Promise that resolves when the element is disconnected from the DOM.
 *
 * @param {string | HTMLElement} el
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<HTMLElement>}
 */
export async function untilDisconnected(el, options) {
  el = ensureElement(el)
  if (!el.isConnected) return el

  // @ts-ignore
  const signal = options?.signal ?? el.signal

  let emitter = emitters.get(el.parentElement)
  if (!emitter) {
    emitter = makeEmitter(el.parentElement)
    emitters.set(el.parentElement, emitter)
  }

  return new Promise((resolve) => {
    const end = () => {
      if (!el.isConnected || signal?.aborted) {
        resolve(el)
        off()
        if ("disconnect" in emitter[Emitter.EVENTS] === false) {
          emitter.observer.disconnect()
          emitters.delete(el.parentElement)
        }
      }
    }

    signal?.addEventListener("abort", () => end())
    const off = emitter.on("disconnect", { off: true }, end)
  })
}
