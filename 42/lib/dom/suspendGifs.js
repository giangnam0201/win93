import { noop } from "../type/function/noop.js"

/**
 * @param {HTMLElement | SVGElement} [root]
 * @param {{ signal?: AbortSignal }} [options]
 */
export function suspendGifs(root = document.documentElement, options) {
  const suspendeds = new Set()

  for (const img of /** @type {NodeListOf<HTMLImageElement>} */ (
    root.querySelectorAll('img[src$=".gif"], img[src^="data:image/gif"]')
  )) {
    const { width, height } = img

    img
      .decode()
      .then(() => {
        if (options?.signal?.aborted) return

        const canvas = document.createElement("canvas")
        canvas.id = img.id
        canvas.className = img.className
        canvas.style.cssText = img.style.cssText
        canvas.width = width
        canvas.height = height
        canvas.getContext("2d").drawImage(img, 0, 0, width, height)

        suspendeds.add({ canvas, img })

        img.replaceWith(canvas)
      })
      .catch(noop)
  }

  options?.signal?.addEventListener("abort", () => restoreGifs())

  function restoreGifs() {
    for (const { canvas, img } of suspendeds) canvas.replaceWith(img)
    suspendeds.clear()
  }

  return restoreGifs
}
