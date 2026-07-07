import { Component } from "../../api/gui/Component.js"
import { toggleFullscreen } from "../../lib/browser/toggleFullscreen.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { defer } from "../../lib/type/promise/defer.js"
import { toast } from "../layout/toast.js"

/** @import {PictoComponent} from "./picto.js" */

// @src https://www.30secondsofcode.org/js/s/format-seconds
function formatTime(time, hideHours) {
  const [hour, minute, second, sign] =
    time >= 0
      ? [time / 3600, (time / 60) % 60, time % 60, ""]
      : [-time / 3600, (-time / 60) % 60, -time % 60, "-"]

  return (
    sign +
    (hideHours ? [minute, second] : [hour, minute, second])
      .map((v) => `${Math.floor(v)}`.padStart(2, "0"))
      .join(":")
  )
}

// @src https://www.30secondsofcode.org/js/s/format-duration
function formatDuration(ms) {
  if (ms < 0) ms = -ms
  const time = {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor(ms / 3_600_000) % 24,
    m: Math.floor(ms / 60_000) % 60,
    s: ((ms / 1000) % 60).toFixed(3),
  }
  return Object.entries(time)
    .filter((val) => val[1] !== 0)
    .map(([key, val]) => `${val}${key}`)
    .join(" ")
}

export class BasicPlayerComponent extends Component {
  static plan = {
    tag: "ui-basic-player",
    props: {
      src: true,
      autoplay: true,
    },
  }

  mixer = undefined

  get src() {
    return this.getAttribute("src")
  }
  set src(src) {
    this.setAttribute("src", src)
    if (this.isRendered) this.load(src)
  }

  get autoplay() {
    return this.hasAttribute("autoplay")
  }
  set autoplay(value) {
    value = Boolean(value)
    this.toggleAttribute("autoplay", value)
    if (this.codec) this.codec.autoplay = value
  }

  get video() {
    return this.hasAttribute("video")
  }
  set video(value) {
    this.toggleAttribute("video", Boolean(value))
  }

  #loop = false
  get loop() {
    return this.#loop
  }
  set loop(value) {
    this.#loop = Boolean(value)
    if (this.isRendered) this.mediaEl.loop = this.#loop
  }

  get volume() {
    return this.codec.volume
  }
  set volume(value) {
    this.codec.volume = value
  }

  get muted() {
    return this.codec.muted
  }
  set muted(bool) {
    this.codec.muted = Boolean(bool)
  }

  #controls
  get controls() {
    return this.#controls
  }
  set controls(value) {
    this.#controls = value
  }

  #isSeeking = false
  #elapsed = 0
  get elapsed() {
    return this.#elapsed
  }
  set elapsed(value) {
    const isFinite = Number.isFinite(value)
    value = isFinite ? value : 0
    this.#elapsed = value
    if (this.elapsedEl) {
      this.elapsedEl.textContent = isFinite ? this.displayTime(value) : "--:--"
      this.elapsedEl.dateTime = this.displayDatetime(value)
    }
    if (this.seekEl && !this.#isSeeking) this.seekEl.value = String(value)
  }

  #duration = 0
  get duration() {
    return this.#duration
  }
  set duration(value) {
    const isFinite = Number.isFinite(value) && value !== 0
    value = isFinite ? value : 0
    this.#duration = value
    if (this.durationEl) {
      this.durationEl.textContent = isFinite ? this.displayTime(value) : "--:--"
      this.durationEl.dateTime = this.displayDatetime(value)
    }
    if (this.seekEl) {
      this.seekEl.max = String(value)
      this.seekEl.disabled = !isFinite
    }
  }

  async load(url) {
    await this.ready
    this.loadReady = defer()
    this.codec.src = url
    return this.loadReady
  }

  unload() {
    this.stop()
    this.toggleAttribute("video", false)
    if (this.codec === this.mediaEl) {
      this.codec.removeAttribute("src")
      this.codec.load()
    }
    this.loadReady?.resolve()
    this.duration = 0
    this.disable()
    dispatch(this, "ui:player.unload")
  }

  loaded() {
    this.enable()
    this.toggleAttribute("video", Boolean(this.codec.videoHeight))
    dispatch(this, "ui:player.loaded")
    this.loadReady?.resolve()
  }

  #elapsedRafId
  #watchingElapsed = false
  #watchElapsed() {
    if (this.#watchingElapsed) return
    this.#watchingElapsed = true
    cancelAnimationFrame(this.#elapsedRafId)

    const loop =
      this.codec === this.mediaEl
        ? () => {
            this.#elapsedRafId = requestAnimationFrame(loop)
            this.elapsed = this.codec.currentTime
          }
        : () => {
            this.#elapsedRafId = requestAnimationFrame(loop)
            this.elapsed = this.codec.currentTime

            if (!this.codec.duration) return

            if (this.#duration !== this.codec.duration) {
              this.duration = this.codec.duration
            }

            if (this.codec.currentTime >= this.codec.duration) {
              this.stop({ ended: true })
            }
          }

    loop()
  }

  #unwatchElapsed() {
    this.#watchingElapsed = false
    cancelAnimationFrame(this.#elapsedRafId)
  }

  async render() {
    const controls = this.controls ?? [
      "play",
      "elapsed",
      "/",
      "duration",
      "seek",
      "mute",
      "volume",
    ]

    function traversePlan(plan) {
      if (Array.isArray(plan.content)) {
        plan.content = plan.content.map((item) =>
          item in controlsPlan ? controlsPlan[item] : traversePlan(item),
        )
      } else if (typeof plan === "string") return { tag: "span", content: plan }
      return plan
    }

    const controlsPlan = {
      play: {
        tag: "button.ui-player__play._clear.pointer-instant",
        disabled: true,
        aria: { label: "Play" },
        picto: "play",
        on: { pointerdown: () => this.togglePause() },
      },
      stop: {
        tag: "button.ui-player__stop",
        disabled: true,
        aria: { label: "Stop" },
        picto: "stop",
        on: { click: () => this.stop() },
      },
      seek: {
        tag: "range.ui-player__seek.grow",
        disabled: true,
        dataset: { resetable: "contextmenu" },
        aria: { label: "Seek" },
        value: 0,
        max: 1,
        step: 0.01,
        on: {
          input: (e, { valueAsNumber, readOnly }) => {
            if (readOnly) return
            if (!this.codec.paused) this.#unwatchElapsed()
            this.codec.currentTime = valueAsNumber
            this.#isSeeking = true
            this.elapsed = this.codec.currentTime
            this.#isSeeking = false
          },
          change: (e, { readOnly }) => {
            if (readOnly) return
            if (!this.codec.paused) this.#watchElapsed()
          },
        },
      },
      elapsed: {
        tag: "time.solid.ui-player__elapsed",
        aria: { label: "Current time" },
        datetime: this.displayDatetime(0),
        content: "00:00",
      },
      duration: {
        tag: "time.solid.ui-player__duration",
        aria: { label: "Total time" },
        datetime: this.displayDatetime(0),
        content: "00:00",
      },
      mute: {
        tag: "button.ui-player__mute.clear.pointer-instant",
        aria: { label: "Mute" },
        picto: "volume",
        on: {
          pointerdown: () => {
            this.muted = !this.muted
          },
        },
      },
      volume: {
        tag: "range.ui-player__volume",
        aria: { label: "Volume" },
        value: this.volume,
        max: 1,
        step: 0.05,
        on: {
          input: (e, { value }) => {
            this.muted = false
            this.volume = value
          },
        },
      },
      loop: {
        tag: "button.ui-player__loop._clear._pointer-instant",
        aria: { label: "Loop", pressed: this.loop },
        picto: "loop",
        on: {
          pointerdown: (e, target) => {
            this.loop = !this.loop
            target.ariaPressed = this.loop
          },
        },
      },
    }

    return {
      tag: ".ui-player__shell",
      tabIndex: -1,
      on: {
        keydown: (e) => {
          if (e.code === "Space") return this.togglePause()
          if (!this.seekEl || this.seekEl.readOnly) return
          if (!this.codec.paused) this.#unwatchElapsed()
          if (e.code === "ArrowRight") {
            this.seekEl.valueAsNumber += 10
            this.codec.currentTime = this.seekEl.valueAsNumber
            this.elapsed = this.codec.currentTime
          } else if (e.code === "ArrowLeft") {
            this.seekEl.valueAsNumber -= 10
            this.codec.currentTime = this.seekEl.valueAsNumber
            this.elapsed = this.codec.currentTime
          }
        },
        keyup: () => {
          if (!this.seekEl || this.seekEl.readOnly) return
          if (!this.codec.paused) this.#watchElapsed()
        },
      },
      content: [
        {
          tag: ".ui-player__stage.inset-shallow",
          content: {
            tag: "video.ui-player__media",
            preload: "metadata",
            autoplay: this.autoplay,
            loop: this.loop,
            crossorigin: true,
            dataset: { mixer: this.mixer },
            on: {
              contextmenu: false,
              click: () => this.togglePause(),
              dblclick: () => this.toggleFullscreen(),
              error: (e, target) => {
                this.disable(target.error)
                this.loadReady?.resolve(false)
              },
              loadedmetadata: () => {
                this.loaded()
              },
              play: () => {
                this.#displayPause()
                this.#watchElapsed()
              },
              ended: () => {
                this.stop({ ended: true })
              },
              volumechange: () => {
                if (this.muteEl) {
                  if (this.codec.muted) {
                    this.muteEl.ariaLabel = "Unmute"
                    this.mutePictoEl.value = "volume-off"
                  } else {
                    this.muteEl.ariaLabel = "Mute"
                    this.mutePictoEl.value = "volume"
                  }
                }
              },
            },
          },
        },
        {
          tag: ".ui-player__controls",
          content: controls.map((keyOrPlan) =>
            keyOrPlan in controlsPlan
              ? controlsPlan[keyOrPlan]
              : traversePlan(keyOrPlan),
          ),
          created(el) {
            const firstButton = el.querySelector("button")
            if (!firstButton) return
            firstButton.toggleAttribute("data-autofocus", true)
          },
        },
      ],
    }
  }

  created() {
    /** @type HTMLVideoElement */
    this.mediaEl = this.querySelector("video")

    /**
     * @type {Partial<HTMLVideoElement> & {
     *   type?: string,
     *   ended?: boolean,
     *   metadata?: Record<string, any>,
     *   loadTrack?: Function
     *   stop?: Function
     *   destroy?: Function
     * }}
     */
    this.codec = this.mediaEl

    /** @type HTMLElement */
    this.shellEl = this.querySelector(".ui-player__shell")
    /** @type HTMLButtonElement */
    this.playEl = this.querySelector("button.ui-player__play")
    /** @type PictoComponent */
    this.playPictoEl = this.querySelector(".ui-player__play > ui-picto")

    /** @type HTMLButtonElement */
    this.stopEl = this.querySelector("button.ui-player__stop")

    this.muteEl = this.querySelector("button.ui-player__mute")
    /** @type PictoComponent */
    this.mutePictoEl = this.querySelector(".ui-player__mute > ui-picto")

    this.seekEl = /** @type HTMLInputElement */ (
      this.querySelector(".ui-player__seek")
    )

    this.elapsedEl = /** @type HTMLTimeElement */ (
      this.querySelector(".ui-player__elapsed")
    )
    this.durationEl = /** @type HTMLTimeElement */ (
      this.querySelector(".ui-player__duration")
    )

    if (this.src) this.load(this.src)
  }

  enable() {
    if (this.playEl) this.playEl.disabled = false
    if (this.stopEl) this.stopEl.disabled = false
    this.duration = this.codec.duration
    this.elapsed = this.codec.currentTime

    const desc = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(this.codec),
      "currentTime",
    )
    if (this.seekEl) {
      this.seekEl.disabled = false
      this.seekEl.readOnly = Boolean(desc && desc.set === undefined)
    }
    this.#watchElapsed()
  }

  disable(err) {
    if (this.playEl) this.playEl.disabled = true
    if (this.stopEl) this.stopEl.disabled = true
    if (this.seekEl) this.seekEl.disabled = true
    this.elapsed = Number.NaN
    this.duration = 0

    if (err) {
      const error = new Error(err.message)
      error.cause = err
      error.name = "MediaError"
      toast(error)
    }
  }

  #displayPlay() {
    if (this.playEl) {
      this.playEl.ariaLabel = "Play"
      this.playPictoEl.value = "play"
    }
  }
  #displayPause() {
    if (this.playEl) {
      this.playEl.ariaLabel = "Pause"
      this.playPictoEl.value = "pause"
    }
  }

  play() {
    this.codec.play()
    this.#displayPause()
    this.#watchElapsed()
  }

  pause() {
    this.#unwatchElapsed()
    this.codec.pause()
    this.#displayPlay()
  }

  stop(options) {
    this.#unwatchElapsed()

    if (this.codec.stop) this.codec.stop(options)
    else this.codec.pause()

    this.#displayPlay()

    this.codec.currentTime = 0
    this.elapsed = 0

    if (options?.ended) {
      dispatch(this, this.loop ? "ui:player.looped" : "ui:player.ended")

      if (this.codec !== this.mediaEl) {
        this.codec.ended = true
        if (this.loop) this.play()
      }
    }
  }

  togglePause(force = !this.codec.paused) {
    if (force) this.pause()
    else this.play()
  }

  toggleFullscreen() {
    toggleFullscreen(this.shellEl)
  }

  displayDatetime(duration) {
    return formatDuration(duration * 1000)
  }

  displayTime(time, duration = time) {
    return formatTime(time, duration < 3600)
  }
}

export const basicPlayer = Component.define(BasicPlayerComponent)
