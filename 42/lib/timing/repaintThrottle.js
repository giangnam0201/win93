/**
 * Creates a throttled function that limits calls to the original function to at most once every animation frame.
 *
 * @template {(...args: any[]) => unknown} T
 * @param {T} fn
 */
export function repaintThrottle(fn) {
  let id
  let pending = false

  const throttled = (...args) => {
    if (pending) return
    pending = true
    id = requestAnimationFrame(() => {
      fn(...args)
      pending = false
    })
  }

  throttled.clear = () => {
    cancelAnimationFrame(id)
    pending = false
  }

  throttled.originalFn = fn
  return throttled
}
