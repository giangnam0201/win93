/**
 * Check if the `url` response has a [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) header.
 *
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<boolean>}
 */
export async function isURLCrossOrigin(url, signal) {
  let el = document.createElement("iframe")
  el.style.position = "fixed"
  el.style.width = "0"
  el.style.height = "0"
  el.style.opacity = "0.001"
  el.style.pointerEvents = "none"

  el.sandbox.add("allow-scripts")

  el.srcdoc = `
    <!doctype html>
    <script type="module">
      const check = await fetch("${url}")
        .then((res) => res.type === "cors")
        .catch((res) => false)
      window.parent.postMessage(check, "${location.origin}")
    </script>`

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
      window.removeEventListener("message", onMessage)
      el.removeAttribute("srcdoc")
      el.remove()
      el = null
    }

    const onAbort = () => {
      cleanup()
      reject(signal.reason)
    }

    signal?.addEventListener("abort", onAbort)

    const onMessage = (e) => {
      if (el.contentWindow === e.source) {
        e.stopImmediatePropagation()
        e.stopPropagation()
        cleanup()
        resolve(e.data)
      }
    }

    window.addEventListener("message", onMessage)

    document.body.append(el)
  })
}
