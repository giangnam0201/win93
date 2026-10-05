import { loadArrayBuffer } from "../../api/load/loadArrayBuffer.js"
import { ensureURL } from "../../api/os/ensureURL.js"
import { getBasename } from "../../lib/syntax/path/getBasename.js"

const PROGRESS = 4
const FILE = 2
const DONE = 1

/**
 * @param {string | File | Blob} src
 * @param {any} [options]
 * @param {Transferable[]} [transfer]
 * @returns {Promise<any[]>}
 */
export async function extract(src, options, transfer) {
  src = await src
  if (typeof src === "string") src = await ensureURL(src)

  const arrayBuffer = await (typeof src === "string"
    ? loadArrayBuffer(src)
    : src.arrayBuffer())

  const worker = new Worker(import.meta.resolve("./sevenZip/sevenZip.w.js"))

  const items = []

  return new Promise((resolve) => {
    worker.onmessage = ({ data }) => {
      if (!data) return

      if (data.t === PROGRESS) {
        if (options?.progress) {
          const num = Math.floor((data.current / data.total) * 100)
          if (Number.isNaN(num)) return
          options?.progress(num, data.current, data.total)
        }
        return
      }

      if (data.t === FILE) {
        items.push({
          name: data.file,
          size: data.size,
          file: new File([data.data], getBasename(data.file)),
        })
        return
      }

      if (data.t === DONE) {
        resolve(items)
        worker.terminate()
      }
    }

    worker.postMessage(new Uint8Array(arrayBuffer), transfer)
  })
}

// /**
//  * @param {any} files
//  * @param {any} [options]
//  * @param {Transferable[]} [transfer]
//  * @returns {Promise<ReadableStream>}
//  */
// export async function pack(files, options, transfer) {
//   files = await files

//   return readable
// }

export const sevenZip = {
  extract,
  // pack,
}
