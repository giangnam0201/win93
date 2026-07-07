import { untilIframeEditable } from "../timing/untilIframeEditable.js"
import { untilIframeUnload } from "../timing/untilIframeUnload.js"

/**
 * @param {HTMLIFrameElement} iframe
 * @param {string} [src]
 * @returns {Promise<Window>}
 */
export async function reloadIframe(iframe, src = iframe.src) {
  iframe.src = "about:blank"
  await untilIframeUnload(iframe)

  iframe.src = src
  await untilIframeUnload(iframe)
  await untilIframeEditable(iframe)

  return iframe.contentWindow
}

/**
 * @param {HTMLIFrameElement} iframe
 * @param {string} [src]
 * @returns {Promise<Window>}
 */
export async function loadIframe(iframe, src = iframe.src) {
  iframe.src = src
  await untilIframeEditable(iframe)
  return iframe.contentWindow
}

/**
 * @param {HTMLIFrameElement} iframe
 * @returns {Promise<Window>}
 */
export async function unloadIframe(iframe) {
  iframe.src = "about:blank"
  await untilIframeUnload(iframe)
  return iframe.contentWindow
}
