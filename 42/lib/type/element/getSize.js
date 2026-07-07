/**
 * @typedef {{
 *   width: number;
 *   height: number;
 *   entry: ResizeObserverEntry;
 * }} RectMeasure
 */

const register = new Set()
let observer

/**
 * @param {ResizeObserverEntry} entry
 * @param {{ contentBox?: boolean }} [options]
 * @returns {RectMeasure}
 */
export function getEntrySize(entry, options) {
  const sizeKey = options?.contentBox ? "contentBoxSize" : "borderBoxSize"

  const width = entry[sizeKey][0].inlineSize
  const height = entry[sizeKey][0].blockSize

  return { width, height, entry }
}

/**
 * Asynchronously get the bounds of an element without causing browser re-layout like `getBoundingClientRect()`.
 *
 * @param {Element} el
 * @param {{ contentBox?: boolean }} [options]
 * @returns {Promise<RectMeasure>}
 */
export async function getSize(el, options) {
  observer ??= new ResizeObserver((entries) => {
    // Defer to next frame to prevent "ResizeObserver loop completed with undelivered notifications"
    requestAnimationFrame(() => {
      for (const [el, cb] of register) {
        for (const entry of entries) if (entry.target === el) cb(entry)
      }
    })
  })

  return new Promise((resolve) => {
    const tuple = [
      el,
      (entry) => {
        observer.unobserve(el)
        register.delete(tuple)
        resolve(getEntrySize(entry, options))
        if (register.size === 0) {
          observer.disconnect()
          observer = undefined
        }
      },
    ]
    register.add(tuple)
    observer.observe(el)
  })
}
