import { untilNextTask } from "./untilNextTask.js"

/**
 * @param {HTMLIFrameElement} iframe
 * @returns {Promise<Window>}
 */
export async function untilIframeUnload(iframe) {
  const win = iframe.contentWindow

  return new Promise((resolve) => {
    const handler = async () => {
      let n = 0
      while (iframe.src !== win.document.URL) {
        await untilNextTask()
        if (++n > 10) break
      }

      resolve(win)
      win.removeEventListener("unload", handler)
    }

    win.addEventListener("unload", handler)
  })
}
