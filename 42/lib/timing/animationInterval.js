// @src https://gist.github.com/jakearchibald/cb03f15670817001b1157e62a076fe95
// @see https://www.youtube.com/watch?v=MCi6AZMkxcU

export function animationInterval(fn, ms, signal) {
  const start = /** @type {number} */ (
    document.timeline ? document.timeline.currentTime : performance.now()
  )

  function frame(time) {
    if (signal?.aborted) return
    fn(time)
    scheduleFrame(time)
  }

  function scheduleFrame(time) {
    const elapsed = time - start
    const roundedElapsed = Math.round(elapsed / ms) * ms
    const targetNext = start + roundedElapsed + ms
    const delay = targetNext - performance.now()
    setTimeout(() => requestAnimationFrame(frame), delay)
  }

  scheduleFrame(start)
}
