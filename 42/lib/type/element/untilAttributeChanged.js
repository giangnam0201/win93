/* eslint-disable max-depth */
import { ensureElement } from "./ensureElement.js"
import { Emitter } from "../../class/Emitter.js"

const emitters = new WeakMap()

function makeEmitter(parent) {
  const emitter = new Emitter()

  const observer = new MutationObserver((records) => {
    const attributes = []
    for (const { attributeName } of records) {
      attributes.push(attributeName)
    }
    emitter.emit("attributeChanged", attributes)
  })

  observer.observe(parent, { attributes: true })

  // @ts-ignore
  emitter.observer = observer
  return emitter
}

/**
 * Returns a Promise that resolves when an element's attribute has changed.
 *
 * @param {string | HTMLElement} el
 * @param {string | Record<string, string>} [attributeName]
 * @param {{signal?: AbortSignal, attributeName?: string}} [options]
 * @returns {Promise<string>}
 */
export async function untilAttributeChanged(el, attributeName, options) {
  el = ensureElement(el)

  // @ts-ignore
  const signal = options?.signal ?? el.signal

  let emitter = emitters.get(el)
  if (!emitter) {
    emitter = makeEmitter(el)
    emitters.set(el, emitter)
  }

  const attributeNameIsString = typeof attributeName === "string"
  const attributeEntries = attributeNameIsString
    ? undefined
    : Object.entries(attributeName)

  return new Promise((resolve) => {
    const end = (attributes) => {
      if (attributes || signal?.aborted) {
        if (attributeName) {
          if (attributeNameIsString) {
            if (!attributes.includes(attributeName)) return
            resolve(el.getAttribute(attributeName))
          } else {
            let ok = true
            for (const [key, val] of attributeEntries) {
              if (el.getAttribute(key) !== val) {
                ok = false
                break
              }
            }
            if (!ok) return
            resolve(attributes)
          }
        } else {
          resolve(attributes)
        }

        off()
        if ("attributeChanged" in emitter[Emitter.EVENTS] === false) {
          emitter.observer.disconnect()
          emitters.delete(el)
        }
      }
    }

    signal?.addEventListener("abort", () => end())
    const off = emitter.on("attributeChanged", { off: true }, end)
  })
}
