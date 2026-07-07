/**
 * Check if the `url` response allow to be embedded in an iframe.
 * Returns false either if the response status is an error,
 * or if the `X-Frame-Options` header is set.
 *
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<boolean>}
 */
export async function isURLIframable(url, signal) {
  let el = document.createElement("object")
  el.style.position = "fixed"
  el.style.width = "0"
  el.style.height = "0"
  el.style.opacity = "0.001"
  el.style.pointerEvents = "none"

  el.data = url

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
      el.onerror = null
      el.onload = null
      el.removeAttribute("data")
      el.remove()
      el = null
    }

    const onAbort = () => {
      cleanup()
      reject(signal.reason)
    }

    signal?.addEventListener("abort", onAbort)

    el.onerror = () => {
      cleanup()
      resolve(false)
    }

    el.onload = () => {
      cleanup()
      resolve(true)
    }

    document.body.append(el)
  })
}
