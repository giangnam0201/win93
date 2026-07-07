import { uid } from "./uid.js"
import { Pool } from "../lib/structure/Pool.js"
import { loadWorker } from "./load/loadWorker.js"
import { Canceller } from "../lib/class/Canceller.js"
import { deserializeError } from "./ipc/deserialize.js"

/**
 * @typedef {{
 *   signal?: AbortSignal,
 *   getTransfer?: Function,
 *   calls?: Record<string, any>,
 *   throttleExports?: string[],
 * }} ThreadOptions
 */

const MAX_WORKERS = navigator.hardwareConcurrency || 4
const WORKER_URL = new URL("./ipc/thread.w.js", import.meta.url)

/** @extends {Pool<Worker>} */
export class WorkerPool extends Pool {
  max = MAX_WORKERS

  signals = new WeakMap()

  async factory() {
    const { signal, cancel } = new Canceller()
    const worker = await loadWorker(WORKER_URL)

    this.signals.set(worker, { signal, cancel })

    worker.addEventListener(
      "message",
      ({ data }) => {
        if (data.destroyWorker) this.delete(worker)
      },
      { signal },
    )

    return worker
  }

  /** @param {Worker} worker */
  delete(worker) {
    super.delete(worker)
    worker.terminate()
    this.signals.get(worker)?.cancel?.()
    this.signals.delete(worker)
  }

  clear() {
    for (const worker of this.list) this.delete(worker)
    super.clear()
  }
}

const bypassGetTransfer = (args) => ({ args, transfer: undefined })

export class Thread {
  #cancel
  /**
   * @param {string} id
   * @param {Worker} worker
   * @param {string[]} exports
   * @param {ThreadOptions} [options]
   */
  constructor(id, worker, exports, options) {
    this.id = id
    this.worker = worker
    this.module = {}
    this.config = { ...options }

    const { signal, cancel } = new Canceller()
    this.signal = signal
    this.#cancel = cancel

    for (const call of exports) {
      this.module[call] = this.#makeCall(call)
      if (call in this === false) this[call] = this.module[call]
    }

    options?.signal?.addEventListener("abort", () => this.destroy())
  }

  #calls = new Set()
  #makeCall(call, options) {
    const { id } = this
    const { className, classId } = options ?? {}
    const getTransfer =
      (className
        ? this.config[className]?.[call]?.getTransfer
        : this.config.calls?.[call]?.getTransfer) ??
      this.config.getTransfer ??
      bypassGetTransfer

    return async (..._args) => {
      const { args, transfer } = getTransfer(_args)
      const callId = uid()
      if (className) {
        this.worker.postMessage(
          { id, callId, className, classId, method: call, args },
          transfer,
        )
      } else {
        this.worker.postMessage(
          { id, callId, call, args }, //
          transfer,
        )
      }

      return new Promise((resolve, reject) => {
        const onCall = ({ data }) => {
          if (data.callId === callId) {
            if (data.error) reject(deserializeError(data.error))
            else if (data.methods) resolve(this.#makeClassProxy(data))
            else resolve(data.res)
            this.worker?.removeEventListener("message", onCall)
            this.#calls.delete(onCall)
          }
        }

        this.#calls.add(onCall)
        this.worker.addEventListener("message", onCall)
      })
    }
  }

  #makeClassProxy({ methods, classId, className }) {
    const out = {}
    for (const item of methods) {
      out[item] = this.#makeCall(item, { classId, className })
    }
    return out
  }

  destroy() {
    this.#cancel()
    this.worker.postMessage({ id: this.id, destroy: true })
    for (const item of this.#calls) {
      this.worker.removeEventListener("message", item)
    }
    this.worker = undefined
  }
}

export const workerPool = new WorkerPool()

/**
 * @param {string | URL} url
 * @param {ThreadOptions} [options]
 * @returns {Promise<Thread>}
 */
export async function threadify(url, options) {
  const worker = await workerPool.get()
  const id = uid()

  worker.postMessage({
    id,
    import: String(url),
    throttleExports: options?.throttleExports,
  })

  return new Promise((resolve, reject) => {
    const onImport = ({ data }) => {
      if (data.id === id) {
        worker.removeEventListener("message", onImport)
        if (data.error) {
          worker.postMessage({ id, destroy: true })
          reject(deserializeError(data.error))
        } else {
          resolve(new Thread(id, worker, data.exports, options))
        }
      }
    }

    worker.addEventListener("message", onImport)
  })
}

threadify.pool = workerPool
