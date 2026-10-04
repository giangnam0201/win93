/**
 * @typedef {{
 *   signal?: AbortSignal;
 *   interval?: number;
 *   autoStart?: boolean;
 * }} TimerOptions
 */

export class Timer {
  begin = 0
  paused = false
  #seq = 0
  #scheduleFrame
  #animateFrame

  /**
   * @param {{ (time: number): void; }} fn
   * @param {number | TimerOptions} [interval]
   * @param {TimerOptions} [options]
   */
  constructor(fn, interval = 1000, options) {
    if (typeof interval !== "number") {
      options = interval
      interval = options.interval ?? 1000
    }

    options?.signal?.addEventListener("abort", () => this.stop())

    const frame = (time) => {
      const seq = this.#seq
      if (!this.paused) fn(time)
      // start()/stop() weren't called during the frame
      if (seq === this.#seq) this.scheduleFrame(time)
    }

    this.#scheduleFrame = (time) => {
      const elapsed = time - this.begin
      const roundedElapsed = Math.round(elapsed / this.interval) * this.interval
      const targetNext = this.begin + roundedElapsed + this.interval
      const delay = targetNext - performance.now()
      this.timeoutId = setTimeout(() => {
        this.rafId = requestAnimationFrame(frame)
      }, delay)
    }

    this.#animateFrame = () => {
      this.rafId = requestAnimationFrame(frame)
    }

    this.scheduleFrame = this.#scheduleFrame

    this.interval = interval

    if (options?.autoStart) this.start()
  }

  #interval
  get interval() {
    return this.#interval
  }
  set interval(value) {
    this.#interval = value
    if (value < 16) {
      if (this.scheduleFrame === this.#scheduleFrame) {
        this.scheduleFrame = this.#animateFrame
      }
    } else if (this.scheduleFrame === this.#animateFrame) {
      this.scheduleFrame = this.#scheduleFrame
    }
  }

  play() {
    this.paused = false
  }

  pause() {
    this.paused = true
  }

  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }

  clear() {
    clearTimeout(this.timeoutId)
    cancelAnimationFrame(this.rafId)
  }

  start() {
    this.#seq++
    this.clear()
    this.paused = false
    this.begin = /** @type {number} */ (
      document.timeline?.currentTime ?? performance.now()
    )
    this.scheduleFrame(this.begin)
  }

  stop() {
    this.#seq++
    this.clear()
    this.paused = true
  }
}
