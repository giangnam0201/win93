let id = 0
const queue = new Map()
const { port1, port2 } = new MessageChannel()

const onmessage = ({ data: id }) => {
  queue.get(id)?.()
  queue.delete(id)
  if (queue.size === 0) port2.onmessage = null // allow NodeJS to close
}

/**
 * Run the `callback` function after the current task in the event loop has completed its work.
 * Like [queueMicrotask](https://developer.mozilla.org/docs/Web/API/queueMicrotask) but for regular tasks.
 * Faster than using `setTimeout(callback, 0)`.
 *
 * @param {(...args: any[]) => unknown} callback
 */
export const queueTask = globalThis.scheduler?.yield
  ? (callback) => {
      globalThis.scheduler.yield().then(() => callback())
    }
  : (callback) => {
      queue.set(++id, callback)
      port2.onmessage ??= onmessage
      port1.postMessage(id)
    }
