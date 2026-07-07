// thanks: https://github.com/sethvincent/gameloop/blob/master/index.js

import Player from "../mixin/Player.js"

const p = window.performance

export default class Loop extends Player {
  constructor(update = () => {}, { fps, speed = 1 } = {}) {
    super()
    this.playing = false
    this.update = update
    this.speed = speed
    this.fps = fps || 60
    this.step = 1000 / this.fps

    let timerId

    this.loop = fps
      ? () => (timerId = window.setTimeout(() => this.tick(p.now()), this.step))
      : () =>
          (timerId = window.requestAnimationFrame((time) => this.tick(time)))

    this.cancel = fps
      ? () => window.clearTimeout(timerId)
      : () => window.cancelAnimationFrame(timerId)
  }

  tick(time) {
    if (this.playing) {
      this.update(((time - this.last) * this.speed) / 1000)
      this.last = time
      this.loop()
    }
  }

  start() {
    this.last = p.now()
    this.loop()
  }
}
