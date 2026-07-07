import * as ease from "../easing.js"
import Layer from "./Layer.js"
import { playable } from "../mixin/Player.js"

const dummyGame = {
  loop: {
    on() {},
    step: 1000 / 60,
  },
}

export default class Sprite extends Layer {
  constructor(...options) {
    super(Object.assign({}, ...options))
    playable(this)

    this.startFrame = this.frame || 0

    if (this.tags) {
      this.tags = Object.entries(this.tags).reduce((acc, [key, val]) => {
        const config = Object.assign({}, val, this.options, {
          origin: this,
          screen: this.screen,
          tags: false,
          name: `${this.name}_${key}`,
        })
        config.tags = val.tags
        acc[key] = new Sprite(config)
        return acc
      }, {})

      if (this.tags.idle) this.display("idle")
    }
    if (!this.origin) this.init(this)
  }

  init(current) {
    if (this === current) {
      this.elapsed = 0
      this.frame = this.startFrame
      this.frameDuration = 0
      if (this.durations) {
        this.total = this.durations.length
        this.prerender = this.renderFrames
      }
    }
    if (current.durations) this.renderStack(current)
  }

  prerender(dt) {
    if (this.parent.playing) {
      this.transforms.forEach((fn) => fn(dt, this))
    }
  }

  apply(dt = 0) {
    this.transforms.forEach((fn) => fn(dt, this))
    this.fx.forEach(([name, ...args]) => Layer.fx[name](this, args, this))
    return this
  }

  renderFrames(dt) {
    if (!this.playing) return
    this.transforms.forEach((fn) => fn(dt, this))
    this.elapsed += dt
    if (this.elapsed > this.frameDuration) {
      this.elapsed = 0
      this.frame++
      if (this.meta[this.frame]) {
        this.meta[this.frame].forEach(({ type, value }) => {
          this.origin.emit(type, value)
        })
      }
      if (this.frame >= this.total) {
        this.frame = 0
        this.loopCount--
        if (this.loopCount > 0) {
          this.renderStack(this)
        } else {
          this.origin.stop()
        }
      } else {
        this.renderStack(this)
      }
    }
  }

  renderStack(current) {
    if (this.frames) this.tick(current)
    if (this.stack) this.stack.forEach((child) => child.renderStack(current))
  }

  tick(current) {
    this.clear()
    if (this.frames[current.frame]) this.draw(this.frames[current.frame])
    current.frameDuration = current.durations[current.frame]
  }

  display(name) {
    if (this.tags && this.tags[name]) {
      const tag = this.tags[name]
      this.player.playing = false
      this.parent.stack.replace(this.player, tag)
      this.player = tag
      this.player.init(this.player)
    }
  }

  play(name = "idle", loopCount = Infinity) {
    this.display(name)
    this.player.loopCount = loopCount
    playable.play.call(this)
    return new Promise((resolve) => {
      this.on("stop", () => {
        resolve()
      })
    })
  }

  destroy() {
    super.destroy()
    playable.destroy.call(this)
  }

  setParent(parent) {
    super.setParent(parent)
    if (this.screen && this.screen.game && this.screen.game.loop) {
      this.game = this.screen.game
      if (!this.origin) {
        if (this.autoPlay) this.game.loop.on("play", () => this.play())
        this.game.loop.on("stop", () => this.stop())
        this.game.loop.on("destroy", () => this.destroy())
      }
    } else {
      this.game = this.game || dummyGame
    }
  }

  animate(props, duration = 300, easing = "easeInOutQuad") {
    if (easing in ease) {
      easing = ease[easing] || ease[easing]
    } else if (typeof easing !== "function") {
      console.warn(`${easing} is not a valid easing function`)
    }

    if (props in animations) {
      const original = animations[props].length > 2 ? this.clone() : undefined
      return this.animate(
        (t) => animations[props](this, t, original),
        duration,
        easing,
      )
    }

    const factor = {}
    let fn
    let from
    let to
    let elapsed = 0
    let percent = 0
    duration /= 1000

    if (typeof props === "function") {
      fn = props
    } else {
      if (Array.isArray(props)) {
        ;[from, to] = props
        Object.assign(this, from)
      } else {
        from = {}
        to = props
      }

      Object.entries(to).forEach(([key, val]) => {
        from[key] = this[key]
        factor[key] = val - this[key]
      })

      fn = (t) =>
        Object.entries(factor).forEach(([key, val]) => {
          this[key] = from[key] + t * val
        })
    }

    return new Promise((resolve) => {
      const transform = (dt) => {
        elapsed += dt
        percent = easing(elapsed / duration)
        // console.log(this.name, elapsed, duration);
        if (elapsed >= duration) {
          fn(1)
          this.transforms.delete(transform)
          resolve(this)
        } else fn(percent)
      }
      this.transforms.add(transform)
    })
  }
}

const animations = {
  flipInX(sprite, t, original) {
    const h = sprite.h * t
    const y = ((1 - t) * sprite.h) / 2
    sprite.clear().ctx.drawImage(original.canvas, 0, y, sprite.w, h)
  },

  flipOutX(sprite, t, original) {
    this.flipInX(sprite, 1 - t, original)
  },
}
