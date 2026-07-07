/**
 * Allow to reuse the provided function result until the returned function is called.
 * On inactivity the result expire after a `delay`.
 *
 * @template T
 * @param {() => T} fn
 * @param {number} [delay]
 * @returns {() => T}
 */
export function reuse(fn, delay = 1000) {
  let result
  let timerId

  return () => {
    result ??= fn()
    clearTimeout(timerId)
    timerId = setTimeout(() => {
      result = undefined // allow garbage collection
    }, delay)
    return result
  }
}
