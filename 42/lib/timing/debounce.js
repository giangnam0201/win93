//! Copyright (c) 2012-2018 The Debounce Contributors [1]. MIT License.
//! [1] https://github.com/component/debounce/blob/master/CONTRIBUTORS
// @src https://github.com/component/debounce

/**
 * @typedef {number | {wait?: number, immediate?: boolean}} DebounceOptions
 */

/**
 * @param {(...args: any[]) => any} fn
 * @param {DebounceOptions} [options]
 */
export function debounce(fn, options) {
  if (typeof options === "number") {
    options = { wait: options }
  }

  const ms = options?.wait ?? 100
  const immediate = options?.immediate ?? false

  let timeoutId
  let args
  let timestamp
  let result

  const later = () => {
    const last = Date.now() - timestamp
    if (last < ms && last >= 0) {
      timeoutId = setTimeout(later, ms - last)
    } else {
      timeoutId = undefined
      if (!immediate) {
        if (args) {
          result = fn(...args)
          args.length = 0
          args = undefined
        } else fn()
      }
    }
  }

  const debounced = (...rest) => {
    args = rest
    timestamp = Date.now()
    const callNow = immediate && !timeoutId
    if (!timeoutId) timeoutId = setTimeout(later, ms)
    if (callNow) {
      result = fn(...args)
      args.length = 0
      args = undefined
    }

    return result
  }

  debounced.clear = () => {
    if (!timeoutId) return
    clearTimeout(timeoutId)
    timeoutId = undefined
  }

  debounced.flush = () => {
    if (!timeoutId) return result
    result = fn(...args)
    args.length = 0
    args = undefined
    clearTimeout(timeoutId)
    timeoutId = undefined
    return result
  }

  debounced.originalFn = fn
  return debounced
}
