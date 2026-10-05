// MIT License.
// @src https://github.com/component/throttle

/**
 * @typedef {number | {wait?: number}} ThrottleOptions
 */

/**
 * @param {(...args: any[]) => any} fn
 * @param {ThrottleOptions} [options]
 */
export function throttle(fn, options) {
  if (typeof options === "number") {
    options = { wait: options }
  }

  const ms = options?.wait ?? 60

  let args
  let result
  let id
  let last = 0

  const call = () => {
    id = undefined
    last = Date.now()
    result = fn(...args)
    args.length = 0
    args = undefined
  }

  const throttled = (...rest) => {
    args = rest
    if (!id) {
      const delta = Date.now() - last
      if (delta >= ms) call()
      else id = setTimeout(call, ms - delta)
    }

    return result
  }

  throttled.clear = () => {
    clearTimeout(id)
    id = undefined
  }

  throttled.originalFn = fn
  return throttled
}
