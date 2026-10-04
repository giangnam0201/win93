import { ensureURL } from "../../api/os/ensureURL.js"
import { threadify } from "../../api/threadify.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"

const EXTRACT_WORKER_URL = new URL("./tar/tarExtract.w.js", import.meta.url)
const PACK_WORKER_URL = new URL("./tar/tarPack.w.js", import.meta.url)

/**
 * @param {string | File | Blob | ReadableStream} src
 * @param {any} [options]
 * @param {Transferable[]} [transfer]
 * @returns {Promise<any[]>}
 */
export async function extract(src, options, transfer) {
  src = await src
  if (typeof src === "string") src = await ensureURL(src)

  /** @type {any} */
  const thread = await threadify(EXTRACT_WORKER_URL, {
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

  if (typeof src === "string") {
    if (src.endsWith(".gz")) {
      options ??= {}
      options.gzip ??= true
    }
  } else if (isInstanceOf(src, ReadableStream)) {
    transfer ??= [src]
  }

  const items = await thread.extract(src, options, transfer)

  setTimeout(() => {
    thread.destroy()
  }, 3000)

  return items
}

/**
 * @param {any} files
 * @param {any} [options]
 * @param {Transferable[]} [transfer]
 * @returns {Promise<ReadableStream>}
 */
export async function pack(files, options, transfer) {
  files = await files

  /** @type {any} */
  const thread = await threadify(PACK_WORKER_URL, {
    calls: {
      pack: {
        getTransfer([files, options, transfer]) {
          return {
            args: [files, options],
            transfer,
          }
        },
      },
    },
  })

  const readable = await thread.pack(files, options, transfer)

  setTimeout(() => {
    thread.destroy()
  }, 3000)

  return readable
}

export const tar = {
  extract,
  pack,
}
