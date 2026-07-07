import { ensureURL } from "../../api/os/ensureURL.js"
import { threadify } from "../../api/threadify.js"

const WORKER_URL = new URL("./zip/zip.w.js", import.meta.url)

/**
 * @param {string | File | Blob} src
 * @param {any} [options]
 * @param {Transferable[]} [transfer]
 * @returns {Promise<any[]>}
 */
export async function extract(src, options, transfer) {
  src = await src
  if (typeof src === "string") src = await ensureURL(src)

  /** @type {any} */
  const thread = await threadify(WORKER_URL, {
    calls: {
      extract: {
        getTransfer([src, options, transfer]) {
          return {
            args: [src, options],
            transfer,
          }
        },
      },
    },
  })

  const items = await thread.extract(src, options, transfer)

  setTimeout(() => {
    thread.destroy()
  }, 3000)

  return items
}

export const zip = {
  extract,
  // pack,
}
