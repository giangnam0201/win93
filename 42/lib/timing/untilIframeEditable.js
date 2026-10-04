import { untilNextTask } from "./untilNextTask.js"

/**
 * @param {HTMLIFrameElement} iframe
 * @returns {Promise<Window>}
 */
export async function untilIframeEditable(iframe) {
  if (iframe.src) {
    let n = 0
    while (iframe.src !== iframe.contentWindow?.document.URL) {
      await untilNextTask()
      if (n++ > 10) break
    }
  }

  const win = iframe.contentWindow
  const doc = win.document

  if (doc.readyState !== "loading") return win

  return new Promise((resolve) => {
    const handler = () => {
      resolve(win)
      doc.removeEventListener("readystatechange", handler)
    }

    doc.addEventListener("readystatechange", handler)
  })
}
