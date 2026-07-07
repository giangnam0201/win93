import { ensureURL } from "../os/ensureURL.js"

function cleanup(el) {
  el.onmessage = null
  el.onerror = null
}

/**
 * @param {string | URL} url
 * @param {WorkerOptions & {signal?: AbortSignal; ignoreFileSystem?: boolean}} [options]
 * @returns {Promise<Worker>}
 */
export async function loadWorker(url, options) {
  const signal = options?.signal

  url = await ensureURL(url, options)

  return new Promise((resolve, reject) => {
    const worker = new Worker(url, {
      type: options?.type ?? "module",
      credentials: options?.credentials,
      name: options?.name,
    })

    worker.onmessage = () => {
      cleanup(worker)
      resolve(worker)
      // globalThis.sys42?.emit?.("add-worker", worker)
    }

    worker.onerror = (e) => {
      e.preventDefault()
      cleanup(worker)

      if (e.error) reject(e.error)
      else if (e.message) {
        import("../../lib/type/error/normalizeError.js") //
          .then(({ normalizeError }) => reject(normalizeError(e)))
      } else {
        import("./inc/rejectAsset.js") //
          .then(({ rejectAsset }) =>
            rejectAsset(reject, "Worker not loaded correctly", url),
          )
      }
    }

    signal?.addEventListener("abort", () => {
      worker.terminate()
      // globalThis.sys42?.emit?.("delete-worker", worker)
    })
  })
}
