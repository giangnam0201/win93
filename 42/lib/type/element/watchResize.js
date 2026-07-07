import { debounce } from "../../timing/debounce.js"
import { throttle } from "../../timing/throttle.js"
import { repaintThrottle } from "../../timing/repaintThrottle.js"
import { ensureElement } from "./ensureElement.js"
import { Emitter } from "../../class/Emitter.js"
import { getSize, getEntrySize } from "./getSize.js"
import { isAnimated } from "./isAnimated.js"

/**
 * @import { DebounceOptions } from "../../timing/debounce.js"
 * @import { ThrottleOptions } from "../../timing/throttle.js"
 * @import { RectMeasure } from "./getSize.js"
 */

/**
 * @typedef {(
 *   rect: RectMeasure,
 *   entry: ResizeObserverEntry,
 * ) => void} WatchResizeCallabck
 *
 * @typedef {{
 *   signal?: AbortSignal;
 *   firstCall?: boolean;
 *   throttle?: false | ThrottleOptions;
 *   debounce?: true | DebounceOptions;
 *   contentBox?: boolean;
 *   skipAnimation?: boolean | any;
 * }} WatchResizeOptions
 */

const watched = new WeakMap()

let emitter

function makeEmitter() {
  if (emitter) return emitter

  emitter = new Emitter()

  const observer = new ResizeObserver((entries, observer) => {
    // Defer to next frame to prevent "ResizeObserver loop completed with undelivered notifications"
    requestAnimationFrame(() => {
      emitter?.emit("resize", entries, observer)
    })
  })

  // @ts-ignore
  emitter.observer = observer
  return emitter
}

/**
 * @overload
 * @param {string | HTMLElement} el
 * @param {WatchResizeCallabck} cb
 */
/**
 * @overload
 * @param {string | HTMLElement} el
 * @param {WatchResizeOptions} options
 * @param {WatchResizeCallabck} cb
 */
/**
 * @param {string | HTMLElement} el
 * @param {WatchResizeOptions | WatchResizeCallabck} options
 * @param {WatchResizeCallabck} [cb]
 */
export function watchResize(el, options, cb) {
  if (typeof options === "function") {
    cb = options
    options = /** @type {unknown} */ (undefined)
  }

  el = ensureElement(el)

  // @ts-ignore
  const signal = options?.signal ?? el.signal

  let cbTimed =
    /** @type {Function & {firstCall?: boolean, clear: Function}} */ (
      /** @type {unknown} */ (cb)
    )

  if (options?.debounce) {
    cbTimed = debounce(
      cb,
      options.debounce === true //
        ? { wait: 30 }
        : options.debounce,
    )
  } else if (options?.throttle !== false) {
    cbTimed =
      options?.throttle === undefined
        ? repaintThrottle(cb)
        : throttle(cb, options?.throttle)
  }

  cbTimed.firstCall = options?.firstCall ?? false

  /** @type {any} */
  let fn = cb

  makeEmitter()

  let paused = false

  const off = emitter.on("resize", { off: true }, (entries) => {
    if (paused) return
    if (options?.skipAnimation && isAnimated(el, options?.skipAnimation)) return
    for (const entry of entries) {
      if (entry.target === el) {
        if (cbTimed.firstCall) fn(getEntrySize(entry, options), entry)
        fn = cbTimed
        cbTimed.firstCall = true
        break
      }
    }
  })

  if (!watched.has(el)) {
    emitter.observer.observe(el)
    watched.set(el, new Set())
  } else if (cbTimed.firstCall) {
    paused = true
    getSize(el, options).then((rect) => {
      if (signal?.aborted) return
      fn(rect, rect.entry)
      paused = false
    })
  }

  const set = watched.get(el)
  set.add(cb)

  const unwatch = () => {
    cbTimed.clear?.()
    set.delete(cb)
    if (set.size === 0) {
      emitter.observer.unobserve(el)
      watched.delete(el)
    }
    off()
    if ("resize" in emitter[Emitter.EVENTS] === false) {
      emitter.observer.disconnect()
      emitter = undefined
    }
  }

  signal?.addEventListener("abort", () => unwatch())

  return unwatch
}
