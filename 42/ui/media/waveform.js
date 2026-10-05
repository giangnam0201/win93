/* eslint-disable prefer-destructuring */
import { Component } from "../../api/gui/Component.js"
import { loadArrayBuffer } from "../../api/load/loadArrayBuffer.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { setCursor, unsetCursor } from "../../lib/dom/cursor.js"
import { Dragger } from "../../lib/dom/Dragger.js"
import { paintThread } from "../../lib/graphic/paintThread.js"
import { watchResize } from "../../lib/type/element/watchResize.js"
import { clamp } from "../../lib/type/number/math.js"
import { defer } from "../../lib/type/promise/defer.js"

const WORKER_URL = new URL("./waveform/waveform.w.js", import.meta.url)
const MAX_ZOOM_SAMPLES_PER_PIXEL = 4.5
const supportSAB = globalThis.SharedArrayBuffer !== undefined

const POINTER_PHASE = {
  end: 3,
  hover: 4,
  leave: 5,
  move: 2,
  start: 1,
}

const SHARED_EVENT = {
  change: 2,
  input: 1,
}

const SHARED_HOVER = {
  handler: 3,
  handlerActive: 4,
  marker: 1,
  markerActive: 2,
  none: 0,
}

let audioContext
let generatedIdCount = 0

function getAudioContext() {
  audioContext ??= new AudioContext()
  return audioContext
}

/** @param {unknown} value */
function parseSeconds(value) {
  return Math.max(0, Number(value) || 0)
}

/** @param {unknown} value */
function parseNormalized(value, fallback = 0) {
  return clamp(Number(value) || fallback, 0, 1)
}

/** @param {unknown} value */
function parseGutterPercent(value) {
  if (value == null || value === "") return 10
  const parsed = Number.parseFloat(String(value).replace("%", ""))
  return clamp(Number.isFinite(parsed) ? parsed : 10, 0, 49)
}

/** @param {unknown} value */
function parseChannel(value) {
  if (value == null || value === "") return "merged"
  const next = String(value).trim()
  if (next === "left" || next === "right") return next
  if (next === "stacked" || next === "merged") return next

  const numeric = Number.parseInt(next, 10)
  return Number.isFinite(numeric) ? String(numeric) : "merged"
}

/** @param {string} prefix */
function createId(prefix) {
  generatedIdCount += 1
  return `${prefix}-${generatedIdCount}`
}

/** @param {any} value */
function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item))
  if (value && typeof value === "object") {
    const out = {}
    for (const [key, item] of Object.entries(value)) out[key] = cloneValue(item)
    return out
  }
  return value
}

/** @param {number} value */
function almostEqual(value, next) {
  return Math.abs(value - next) <= 1e-6
}

/**
 * @typedef {{ end: number, start: number }} WaveformSelection
 */

/**
 * @extends {Component}
 */
export class WaveformComponent extends Component {
  static plan = {
    tag: "ui-waveform",
    props: {
      channel: true,
      gutter: true,
      playhead: true,
      selectable: true,
      selectionEnd: { attribute: "selection-end" },
      selectionStart: { attribute: "selection-start" },
      src: true,
      zoom: true,
      zoomPos: { attribute: "zoom-pos" },
    },
  }

  #audioBuffer
  #builtinMarkerProxy
  #builtinMarkerRaw = {
    playhead: {
      color: "#fff",
      draggable: false,
      hitzone: 5,
      id: "playhead",
      time: 0,
      width: 1,
    },
    selectionEnd: {
      color: "#fff",
      cursor: "ew-resize",
      hoverColor: "#66d9ff",
      hitzone: 5,
      id: "selection-end",
      time: 0,
      width: 1,
    },
    selectionStart: {
      color: "#fff",
      cursor: "ew-resize",
      hoverColor: "#66d9ff",
      hitzone: 5,
      id: "selection-start",
      time: 0,
      width: 1,
    },
  }
  #builtinRegionProxy
  #builtinRegionRaw = {
    played: {
      id: "played",
      start: 0,
      endMarker: "playhead",
      waveformColor: "#00000080",
    },
    selection: {
      id: "selection",
      startMarker: "selection-start",
      endMarker: "selection-end",
      handlers: [
        {
          activeCursor: "grabbing",
          cursor: "grab",
          color: "#ffffff99",
          height: "5%",
          hoverColor: "#f0f",
          id: "selection-drag-box",
          kind: "move-region",
          width: "100%",
          x: "0%",
          y: "0%",
        },
      ],
      overlap: {
        played: {
          background: "#1f1f1f",
        },
      },
    },
  }

  /** @type {HTMLElement} */
  viewportEl
  /** @type {HTMLElement} */
  contentEl
  /** @type {HTMLElement} */
  windowEl

  #channel = "merged"
  #contentWidth = 0
  #dragSequence = Promise.resolve()
  #gutter = 10
  #hoverFrame = 0
  #hoverPoint
  #hoverRequest = 0
  #pendingZoomAnchor
  #pointerActive = false
  #pointerMetaI32
  #pointerPollFrame = 0
  #pointerPosF64
  #pluginMarkerEntries = []
  #pluginRegionEntries = []
  #proxyCache = new WeakMap()
  #responseDataF64
  #responseMetaI32
  #responseSeq = 0
  #sampleLength = 0
  #sampleRate = 44_100
  #sampleStart = 0
  #samplesPerPixel = 1
  #scrollSyncFrame = 0
  #selectable = false
  #suppressedScrollLeft
  #syncFlags = {
    audio: false,
    camera: false,
    timeline: false,
  }
  #syncFrame = 0
  #wheelDeltaY = 0
  #wheelFrame = 0
  #wheelPoint
  #zoom = 0
  #zoomPos = 0

  get src() {
    return this.getAttribute("src")
  }
  set src(value) {
    if (value == null || value === "") this.removeAttribute("src")
    else this.setAttribute("src", String(value))
  }

  get playhead() {
    return this.#builtinMarkerRaw.playhead.time
  }
  set playhead(value) {
    this.#setBuiltinMarkerTime("playhead", parseSeconds(value))
  }

  get selectionStart() {
    return this.#builtinMarkerRaw.selectionStart.time
  }
  set selectionStart(value) {
    this.#setBuiltinMarkerTime("selectionStart", parseSeconds(value))
  }

  get selectionEnd() {
    return this.#builtinMarkerRaw.selectionEnd.time
  }
  set selectionEnd(value) {
    this.#setBuiltinMarkerTime("selectionEnd", parseSeconds(value))
  }

  get zoom() {
    return this.#zoom
  }
  set zoom(value) {
    const nextZoom = parseNormalized(value, 0)
    if (almostEqual(nextZoom, this.#zoom)) return

    this.#zoom = nextZoom
    this.#samplesPerPixel = this.#zoomToSamplesPerPixel(nextZoom)
    this.#applyViewportMetrics(this.#pendingZoomAnchor)
    this.#pendingZoomAnchor = undefined
    this.#scheduleSync({ camera: true })
  }

  get samplesPerPixel() {
    return this.#samplesPerPixel
  }
  set samplesPerPixel(value) {
    const next = this.#clampSamplesPerPixel(
      Number(value) || this.#samplesPerPixel,
    )
    if (almostEqual(next, this.#samplesPerPixel)) return

    this.#samplesPerPixel = next
    this.#zoom = this.#samplesPerPixelToZoom(next)
    this.#applyViewportMetrics(this.#pendingZoomAnchor)
    this.#pendingZoomAnchor = undefined
    this.#scheduleSync({ camera: true })
  }

  get zoomPos() {
    return this.#zoomPos
  }
  set zoomPos(value) {
    const nextZoomPos = parseNormalized(value, 0)
    if (almostEqual(nextZoomPos, this.#zoomPos)) return

    this.#zoomPos = nextZoomPos
    this.#applyViewportMetrics()
    this.#scheduleSync({ camera: true })
  }

  get gutter() {
    return this.#gutter
  }
  set gutter(value) {
    const nextGutter = parseGutterPercent(value)
    if (nextGutter === this.#gutter) return

    this.#gutter = nextGutter
    this.#scheduleSync({ camera: true })
  }

  get selectable() {
    return this.#selectable
  }
  set selectable(value) {
    const next = Boolean(value)
    if (next === this.#selectable) return

    this.#selectable = next
    this.#setSelectable()
    this.#scheduleSync({ camera: true })
  }

  get channel() {
    return this.#channel
  }
  set channel(value) {
    const next = parseChannel(value)
    if (next === this.#channel) return

    this.#channel = next
    this.#scheduleSync({ camera: true })
  }

  /** @type {AudioBuffer | undefined} */
  get audioBuffer() {
    return this.#audioBuffer
  }
  set audioBuffer(value) {
    this.#audioBuffer = value
    this.#sampleLength = value?.length ?? 0
    this.#sampleRate = value?.sampleRate ?? 44_100
    this.#clampMarkerTimesToDuration()
    this.#reprojectViewport()
    this.#scheduleSync({ audio: true, camera: true, timeline: true })
  }

  get markers() {
    this.#createBuiltins()
    return [
      this.#builtinMarkerProxy.playhead,
      this.#builtinMarkerProxy.selectionStart,
      this.#builtinMarkerProxy.selectionEnd,
      ...this.#pluginMarkerEntries.map((entry) => entry.proxy),
    ]
  }
  set markers(value) {
    const nextItems = Array.isArray(value) ? value : []
    const nextPlugins = []

    for (const item of nextItems) {
      if (!item || typeof item !== "object") continue
      const raw = cloneValue(item)
      const { id } = raw

      if (id === "playhead") {
        this.#assignTracked(this.#builtinMarkerRaw.playhead, raw)
        continue
      }
      if (id === "selection-start") {
        this.#assignTracked(this.#builtinMarkerRaw.selectionStart, raw)
        continue
      }
      if (id === "selection-end") {
        this.#assignTracked(this.#builtinMarkerRaw.selectionEnd, raw)
        continue
      }

      raw.id ??= createId("marker")
      nextPlugins.push(this.#createTrackedEntry(raw))
    }

    this.#pluginMarkerEntries = nextPlugins
    this.#scheduleSync({ timeline: true })
  }

  get regions() {
    this.#createBuiltins()
    return [
      this.#builtinRegionProxy.selection,
      this.#builtinRegionProxy.played,
      ...this.#pluginRegionEntries.map((entry) => entry.proxy),
    ]
  }
  set regions(value) {
    const nextItems = Array.isArray(value) ? value : []
    const nextPlugins = []

    for (const item of nextItems) {
      if (!item || typeof item !== "object") continue
      const raw = cloneValue(item)
      const { id } = raw

      if (id === "selection") {
        this.#assignTracked(this.#builtinRegionRaw.selection, raw)
        continue
      }
      if (id === "played") {
        this.#assignTracked(this.#builtinRegionRaw.played, raw)
        continue
      }

      raw.id ??= createId("region")
      nextPlugins.push(this.#createTrackedEntry(raw))
    }

    this.#pluginRegionEntries = nextPlugins
    this.#scheduleSync({ timeline: true })
  }

  /** @returns {WaveformSelection} */
  get selection() {
    return {
      end: Math.max(this.selectionStart, this.selectionEnd),
      start: Math.min(this.selectionStart, this.selectionEnd),
    }
  }
  set selection(value) {
    this.selectionStart = value.start
    this.selectionEnd = value.end
  }

  constructed() {
    this.threadReady = defer()

    const { canvas, thread } = paintThread(WORKER_URL, {
      signal: this.signal,
      throttleExports: [],
    })

    this.canvas = canvas
    thread.then(async (thread) => {
      this.thread = thread

      if (
        supportSAB &&
        typeof (/** @type {any} */ (thread).setPointerState) === "function"
      ) {
        await this.#setupSharedPointerState(/** @type {any} */ (thread))
      }

      this.threadReady.resolve()
      this.#scheduleSync({ audio: true, camera: true, timeline: true })
    })
  }

  updated(key, _value, _prev, changedValue) {
    switch (key) {
      case "src":
        if (changedValue) this.load(changedValue)
        return

      case "playhead":
        this.playhead = changedValue
        return

      case "selection-start":
        this.selectionStart = changedValue
        return

      case "selection-end":
        this.selectionEnd = changedValue
        return

      case "zoom":
        this.zoom = changedValue
        return

      case "zoom-pos":
        this.zoomPos = changedValue
        return

      case "gutter":
        this.gutter = changedValue
        return

      case "channel":
        this.channel = changedValue
        return

      case "selectable":
        this.selectable = changedValue !== null
    }
  }

  render() {
    return {
      tag: ".ui-waveform__box",
      content: {
        tag: ".ui-waveform__viewport",
        created: (el) => {
          this.viewportEl = el
        },
        content: {
          tag: ".ui-waveform__content",
          created: (el) => {
            this.contentEl = el
          },
          content: {
            tag: ".ui-waveform__window",
            created: (el) => {
              this.windowEl = el
            },
            content: this.canvas,
          },
        },
      },
    }
  }

  created() {
    const { signal } = this

    this.#createBuiltins()
    this.#hydrateAttributeState()

    watchResize(this, { firstCall: true, signal, throttle: false }, () => {
      this.#reprojectViewport()
      this.#scheduleSync({ camera: true })
    })

    this.viewportEl.addEventListener("scroll", () => this.#queueScrollSync(), {
      passive: true,
      signal,
    })

    this.viewportEl.addEventListener(
      "pointermove",
      (event) => this.#queueHoverFromEvent(event),
      { passive: true, signal },
    )

    this.viewportEl.addEventListener("pointerleave", () => this.#clearHover(), {
      signal,
    })

    this.viewportEl.addEventListener(
      "wheel",
      (event) => this.#zoomFromWheel(event),
      { passive: false, signal },
    )

    signal.addEventListener(
      "abort",
      () => {
        if (this.#syncFrame) cancelAnimationFrame(this.#syncFrame)
        if (this.#scrollSyncFrame) cancelAnimationFrame(this.#scrollSyncFrame)
        if (this.#hoverFrame) cancelAnimationFrame(this.#hoverFrame)
        if (this.#pointerPollFrame) cancelAnimationFrame(this.#pointerPollFrame)
        if (this.#wheelFrame) cancelAnimationFrame(this.#wheelFrame)
        unsetCursor(this)
      },
      { once: true },
    )

    this.#setSelectable()
    this.#reprojectViewport()

    if (this.src) this.load(this.src)
    else if (this.#audioBuffer) {
      this.#scheduleSync({ audio: true, camera: true, timeline: true })
    }
  }

  async load(src) {
    try {
      const arrayBuffer = await loadArrayBuffer(src)
      this.audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer)
      dispatch(this, "load", {
        detail: {
          audioBuffer: this.audioBuffer,
          duration: this.duration,
          sampleRate: this.#sampleRate,
          src,
        },
      })
    } catch (err) {
      dispatch(this, /** @type {Error} */ (err))
    }
  }

  get duration() {
    return this.#sampleRate > 0 ? this.#sampleLength / this.#sampleRate : 0
  }

  addMarker(marker) {
    const raw = cloneValue(marker ?? {})
    raw.id ??= createId("marker")
    const entry = this.#createTrackedEntry(raw)
    this.#pluginMarkerEntries.push(entry)
    this.#scheduleSync({ timeline: true })
    return entry.proxy
  }

  addRegion(region) {
    const raw = cloneValue(region ?? {})
    raw.id ??= createId("region")
    const entry = this.#createTrackedEntry(raw)
    this.#pluginRegionEntries.push(entry)
    this.#scheduleSync({ timeline: true })
    return entry.proxy
  }

  removeMarker(id) {
    if (
      id === "playhead" ||
      id === "selection-start" ||
      id === "selection-end"
    ) {
      return false
    }

    const next = this.#pluginMarkerEntries.filter(
      (entry) => entry.raw.id !== id,
    )
    if (next.length === this.#pluginMarkerEntries.length) return false
    this.#pluginMarkerEntries = next
    this.#scheduleSync({ timeline: true })
    return true
  }

  removeRegion(id) {
    if (id === "selection" || id === "played") return false

    const next = this.#pluginRegionEntries.filter(
      (entry) => entry.raw.id !== id,
    )
    if (next.length === this.#pluginRegionEntries.length) return false
    this.#pluginRegionEntries = next
    this.#scheduleSync({ timeline: true })
    return true
  }

  getMarker(id) {
    this.#createBuiltins()
    if (id === "playhead") return this.#builtinMarkerProxy.playhead
    if (id === "selection-start") return this.#builtinMarkerProxy.selectionStart
    if (id === "selection-end") return this.#builtinMarkerProxy.selectionEnd
    return (
      this.#pluginMarkerEntries.find((entry) => entry.raw.id === id)?.proxy ??
      null
    )
  }

  getRegion(id) {
    this.#createBuiltins()
    if (id === "selection") return this.#builtinRegionProxy.selection
    if (id === "played") return this.#builtinRegionProxy.played
    return (
      this.#pluginRegionEntries.find((entry) => entry.raw.id === id)?.proxy ??
      null
    )
  }

  #createBuiltins() {
    if (this.#builtinMarkerProxy && this.#builtinRegionProxy) return

    this.#builtinMarkerProxy = {
      playhead: this.#trackObject(this.#builtinMarkerRaw.playhead),
      selectionEnd: this.#trackObject(this.#builtinMarkerRaw.selectionEnd),
      selectionStart: this.#trackObject(this.#builtinMarkerRaw.selectionStart),
    }

    this.#builtinRegionProxy = {
      played: this.#trackObject(this.#builtinRegionRaw.played),
      selection: this.#trackObject(this.#builtinRegionRaw.selection),
    }
  }

  /** @param {string} id */
  #setBuiltinMarkerTime(id, nextSeconds) {
    const marker = this.#builtinMarkerRaw[id]
    const clamped = clamp(nextSeconds, 0, this.duration || nextSeconds)
    if (almostEqual(marker.time ?? 0, clamped)) return
    marker.time = clamped
    this.#scheduleSync({ timeline: true })
  }

  #clampMarkerTimesToDuration() {
    for (const marker of Object.values(this.#builtinMarkerRaw)) {
      marker.time = clamp(marker.time ?? 0, 0, this.duration)
    }
    for (const entry of this.#pluginMarkerEntries) {
      if (typeof entry.raw.time === "number") {
        entry.raw.time = clamp(entry.raw.time, 0, this.duration)
      }
    }
  }

  #getTimelineMarkerEntries() {
    return [
      { raw: this.#builtinMarkerRaw.playhead },
      { raw: this.#builtinMarkerRaw.selectionStart },
      { raw: this.#builtinMarkerRaw.selectionEnd },
      ...this.#pluginMarkerEntries,
    ]
  }

  #getTimelineRegionEntries() {
    return [
      { raw: this.#builtinRegionRaw.selection },
      { raw: this.#builtinRegionRaw.played },
      ...this.#pluginRegionEntries,
    ]
  }

  /** @param {{ raw: any }} entry */
  #serializeMarker(entry) {
    const { raw } = entry
    const out = cloneValue(raw)
    const time = parseSeconds(out.time ?? 0)
    delete out.time
    out.sample = this.#secondsToSample(time)
    return out
  }

  /** @param {{ raw: any }} entry */
  #serializeRegion(entry) {
    const out = cloneValue(entry.raw)

    if (typeof out.start === "number") {
      out.startSample = this.#secondsToSample(out.start)
      delete out.start
    } else if (typeof out.start === "string") {
      out.startMarker = out.start
      delete out.start
    }

    if (typeof out.end === "number") {
      out.endSample = this.#secondsToSample(out.end)
      delete out.end
    } else if (typeof out.end === "string") {
      out.endMarker = out.end
      delete out.end
    }

    if (out.backgroundColor == null && out.id === "selection") {
      out.backgroundColor = this.#getStyles().selectionBackground
    }

    return out
  }

  async #flushSync() {
    this.#syncFrame = 0
    await this.threadReady
    if (this.signal.aborted) return

    const styles = this.#getStyles()
    const flags = { ...this.#syncFlags }
    this.#syncFlags.audio = false
    this.#syncFlags.camera = false
    this.#syncFlags.timeline = false

    if (flags.audio) {
      const thread = /** @type {any} */ (this.thread)
      const channels = this.#audioBuffer
        ? Array.from(
            { length: this.#audioBuffer.numberOfChannels },
            (_, index) => this.#audioBuffer.getChannelData(index).slice(),
          )
        : []
      await thread.setAudio({
        channels,
        sampleRate: this.#sampleRate,
      })
    }

    if (flags.timeline && this.#sampleLength > 0) {
      const thread = /** @type {any} */ (this.thread)
      const timeline = await thread.setTimeline({
        markers: this.#getTimelineMarkerEntries().map((entry) =>
          this.#serializeMarker(entry),
        ),
        playheadSeconds: this.playhead,
        regions: this.#getTimelineRegionEntries().map((entry) =>
          this.#serializeRegion(entry),
        ),
        selectionEndSeconds: this.selectionEnd,
        selectionStartSeconds: this.selectionStart,
      })

      this.#applyWorkerDetail(timeline)
    }

    if (flags.camera || flags.audio) {
      const thread = /** @type {any} */ (this.thread)
      await thread.setCamera({
        background: styles.background,
        channel: this.#channel,
        gutter: this.#gutter / 100,
        marker: styles.marker,
        regionBackground: styles.regionBackground,
        sampleStart: this.#sampleStart,
        samplesPerPixel: this.#samplesPerPixel,
        selectable: this.#selectable,
        waveform: styles.waveform,
      })
    }
  }

  #scheduleSync(flags) {
    if (flags.audio) this.#syncFlags.audio = true
    if (flags.camera) this.#syncFlags.camera = true
    if (flags.timeline) this.#syncFlags.timeline = true
    if (this.#syncFrame) return
    this.#syncFrame = requestAnimationFrame(() => this.#flushSync())
  }

  #setSelectable() {
    if (!this.viewportEl) return

    if (!this.#selectable) {
      this.dragger?.destroy?.()
      this.dragger = undefined
      return
    }

    if (this.dragger) return

    this.dragger = new Dragger(this, {
      signal: this.signal,
      init: (event) => {
        if (event.button !== 0) return false
        this.#queuePointerPhase("start", event)
      },
      start: (_x, _y, event) => {
        this.#queuePointerPhase("move", event)
      },
      drag: (_x, _y, event) => {
        this.#queuePointerPhase("move", event)
      },
      stop: (_x, _y, event) => {
        this.#queuePointerPhase("end", event)
      },
    })
  }

  async #setupSharedPointerState(thread) {
    const pointerMetaSAB = new SharedArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * 2,
    )
    const pointerPosSAB = new SharedArrayBuffer(
      Float64Array.BYTES_PER_ELEMENT * 2,
    )
    const responseMetaSAB = new SharedArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * 6,
    )
    const responseDataSAB = new SharedArrayBuffer(
      Float64Array.BYTES_PER_ELEMENT * 3,
    )

    this.#pointerMetaI32 = new Int32Array(pointerMetaSAB)
    this.#pointerPosF64 = new Float64Array(pointerPosSAB)
    this.#responseMetaI32 = new Int32Array(responseMetaSAB)
    this.#responseDataF64 = new Float64Array(responseDataSAB)
    this.#responseSeq = 0

    await thread.setPointerState({
      pointerMetaSAB,
      pointerPosSAB,
      responseDataSAB,
      responseMetaSAB,
    })

    this.#responseSeq = Number(Atomics.load(this.#responseMetaI32, 0))

    this.#startSharedPointerPolling()
  }

  #startSharedPointerPolling() {
    if (this.#pointerPollFrame) cancelAnimationFrame(this.#pointerPollFrame)
    this.#pointerPollFrame = requestAnimationFrame(() =>
      this.#pollSharedPointerState(),
    )
  }

  #pollSharedPointerState() {
    this.#pointerPollFrame = 0
    if (
      !this.#responseMetaI32 ||
      !this.#responseDataF64 ||
      this.signal.aborted
    ) {
      return
    }

    const responseSeq = Number(Atomics.load(this.#responseMetaI32, 0))
    if (responseSeq !== this.#responseSeq) {
      this.#responseSeq = responseSeq

      const eventType = Number(Atomics.load(this.#responseMetaI32, 1))
      const hoverKind = Number(Atomics.load(this.#responseMetaI32, 2))
      const markerSlot = Number(Atomics.load(this.#responseMetaI32, 3))
      const regionSlot = Number(Atomics.load(this.#responseMetaI32, 4))
      const handlerSlot = Number(Atomics.load(this.#responseMetaI32, 5))

      const playhead = this.#responseDataF64[0]
      const selectionStart = this.#responseDataF64[1]
      const selectionEnd = this.#responseDataF64[2]
      this.#applySharedHover(hoverKind, markerSlot, regionSlot, handlerSlot)

      if (
        eventType === SHARED_EVENT.input ||
        eventType === SHARED_EVENT.change
      ) {
        const detail = this.#createWorkerDetail(
          playhead,
          selectionStart,
          selectionEnd,
        )

        this.#applyWorkerDetail(detail)
      }

      if (eventType === SHARED_EVENT.input) {
        const detail = this.#createWorkerDetail(
          playhead,
          selectionStart,
          selectionEnd,
        )
        dispatch(this, "input", { detail })
      } else if (eventType === SHARED_EVENT.change) {
        const detail = this.#createWorkerDetail(
          playhead,
          selectionStart,
          selectionEnd,
        )
        dispatch(this, "change", { detail })
      }
    }

    this.#pointerPollFrame = requestAnimationFrame(() =>
      this.#pollSharedPointerState(),
    )
  }

  #writeSharedPointerPhase(phase, point) {
    if (!this.#pointerMetaI32 || !this.#pointerPosF64) return false
    this.#pointerPosF64[0] = point.x
    this.#pointerPosF64[1] = point.y
    Atomics.store(this.#pointerMetaI32, 1, POINTER_PHASE[phase])
    Atomics.add(this.#pointerMetaI32, 0, 1)
    Atomics.notify(this.#pointerMetaI32, 0)
    return true
  }

  #createWorkerDetail(playhead, selectionStart, selectionEnd) {
    return {
      playhead,
      played: {
        end: playhead,
        start: 0,
      },
      selection: {
        end: Math.max(selectionStart, selectionEnd),
        start: Math.min(selectionStart, selectionEnd),
      },
      selectionEnd,
      selectionStart,
    }
  }

  #getMarkerBySlot(slot) {
    if (slot === 0) return this.#builtinMarkerRaw.playhead
    if (slot === 1) return this.#builtinMarkerRaw.selectionStart
    if (slot === 2) return this.#builtinMarkerRaw.selectionEnd
    return this.#pluginMarkerEntries[slot - 3]?.raw ?? null
  }

  #getRegionBySlot(slot) {
    if (slot === 0) return this.#builtinRegionRaw.selection
    if (slot === 1) return this.#builtinRegionRaw.played
    return this.#pluginRegionEntries[slot - 2]?.raw ?? null
  }

  #applySharedHover(hoverKind, markerSlot, regionSlot, handlerSlot) {
    if (hoverKind === SHARED_HOVER.none) {
      unsetCursor(this)
      return
    }

    if (
      hoverKind === SHARED_HOVER.marker ||
      hoverKind === SHARED_HOVER.markerActive
    ) {
      const marker = this.#getMarkerBySlot(markerSlot)
      const cursor =
        hoverKind === SHARED_HOVER.markerActive
          ? (marker?.activeCursor ?? marker?.cursor)
          : marker?.cursor

      if (cursor) setCursor(cursor, this)
      else unsetCursor(this)
      return
    }

    const region = this.#getRegionBySlot(regionSlot)
    const handler = region?.handlers?.[handlerSlot]
    const cursor =
      hoverKind === SHARED_HOVER.handlerActive
        ? (handler?.activeCursor ?? handler?.cursor)
        : handler?.cursor

    if (cursor) setCursor(cursor, this)
    else unsetCursor(this)
  }

  /** @param {"start" | "move" | "end"} phase */
  #queuePointerPhase(phase, event) {
    if (phase === "start") this.#pointerActive = true

    const point = this.#getViewportPoint(event.clientX ?? 0, event.clientY ?? 0)
    if (this.#writeSharedPointerPhase(phase, point)) {
      if (phase === "end") this.#pointerActive = false
      return
    }

    this.#dragSequence = this.#dragSequence.then(async () => {
      await this.threadReady
      if (this.signal.aborted) return

      const response = await /** @type {any} */ (this.thread).pointer({
        phase,
        x: point.x,
        y: point.y,
      })

      this.#applyHover(response?.hover)
      if (response?.detail) this.#applyWorkerDetail(response.detail, true)
      if (response?.event) {
        dispatch(this, response.event, { detail: response.detail })
      }
      if (phase === "end") this.#pointerActive = false
    })
  }

  #queueHoverFromEvent(event) {
    if (this.#pointerActive || !this.viewportEl) return

    this.#hoverPoint = this.#getViewportPoint(
      event.clientX ?? 0,
      event.clientY ?? 0,
    )

    if (this.#hoverFrame) return
    this.#hoverFrame = requestAnimationFrame(() => this.#flushHover())
  }

  #flushHover() {
    this.#hoverFrame = 0
    const point = this.#hoverPoint
    if (!point) return

    if (this.#writeSharedPointerPhase("hover", point)) return

    const requestId = ++this.#hoverRequest
    this.#dragSequence = this.#dragSequence.then(async () => {
      await this.threadReady
      if (this.signal.aborted || this.#pointerActive) return

      const response = await /** @type {any} */ (this.thread).pointer({
        phase: "hover",
        x: point.x,
        y: point.y,
      })

      if (requestId !== this.#hoverRequest) return
      this.#applyHover(response?.hover)
    })
  }

  #clearHover() {
    if (this.#pointerActive) return
    if (this.#hoverFrame) {
      cancelAnimationFrame(this.#hoverFrame)
      this.#hoverFrame = 0
    }

    this.#hoverPoint = undefined
    this.#hoverRequest += 1

    if (this.#writeSharedPointerPhase("leave", { x: 0, y: 0 })) return

    unsetCursor(this)

    this.#dragSequence = this.#dragSequence.then(async () => {
      await this.threadReady
      if (this.signal.aborted || this.#pointerActive) return
      await /** @type {any} */ (this.thread).pointer({
        phase: "leave",
        x: 0,
        y: 0,
      })
    })
  }

  #applyHover(hover) {
    if (hover?.cursor) setCursor(hover.cursor, this)
    else unsetCursor(this)
  }

  #applyWorkerDetail(detail, syncWorker = false) {
    if (!detail) return
    let changed = false
    if (detail.playhead != null) {
      if (
        !almostEqual(this.#builtinMarkerRaw.playhead.time ?? 0, detail.playhead)
      ) {
        this.#builtinMarkerRaw.playhead.time = detail.playhead
        changed = true
      }
    }
    if (detail.selectionStart != null) {
      if (
        !almostEqual(
          this.#builtinMarkerRaw.selectionStart.time ?? 0,
          detail.selectionStart,
        )
      ) {
        this.#builtinMarkerRaw.selectionStart.time = detail.selectionStart
        changed = true
      }
    }
    if (detail.selectionEnd != null) {
      if (
        !almostEqual(
          this.#builtinMarkerRaw.selectionEnd.time ?? 0,
          detail.selectionEnd,
        )
      ) {
        this.#builtinMarkerRaw.selectionEnd.time = detail.selectionEnd
        changed = true
      }
    }
    if (syncWorker && changed) this.#scheduleSync({ timeline: true })
  }

  #secondsToSample(seconds) {
    return clamp(seconds * this.#sampleRate, 0, this.#sampleLength)
  }

  #sampleToSeconds(sample) {
    return this.#sampleRate > 0
      ? clamp(sample, 0, this.#sampleLength) / this.#sampleRate
      : 0
  }

  #reprojectViewport(anchor) {
    if (this.#sampleLength > 0) {
      this.#samplesPerPixel = this.#clampSamplesPerPixel(
        this.#zoomToSamplesPerPixel(this.#zoom),
      )
      this.#zoom = this.#samplesPerPixelToZoom(this.#samplesPerPixel)
    }

    if (anchor == null) this.#pendingZoomAnchor = undefined
    this.#applyViewportMetrics(anchor)
  }

  #getScaleBounds() {
    const viewportWidth = this.viewportEl?.clientWidth ?? this.clientWidth ?? 0
    if (viewportWidth <= 0 || this.#sampleLength <= 0) {
      return { max: 1, min: 1 }
    }

    const max = Math.max(1, this.#sampleLength / viewportWidth)
    const min = Math.min(max, MAX_ZOOM_SAMPLES_PER_PIXEL)
    return { max, min }
  }

  #clampSamplesPerPixel(value) {
    const { max, min } = this.#getScaleBounds()
    return clamp(value || max, min, max)
  }

  #zoomToSamplesPerPixel(zoom) {
    const { max, min } = this.#getScaleBounds()
    if (almostEqual(max, min)) return max
    return max * (min / max) ** clamp(zoom, 0, 1)
  }

  #samplesPerPixelToZoom(samplesPerPixel) {
    const { max, min } = this.#getScaleBounds()
    if (almostEqual(max, min)) return 0
    return clamp(Math.log(samplesPerPixel / max) / Math.log(min / max), 0, 1)
  }

  #applyViewportMetrics(anchor) {
    if (!this.viewportEl || !this.contentEl || !this.windowEl) return

    const viewportWidth = this.viewportEl.clientWidth
    if (viewportWidth <= 0) return

    if (this.#sampleLength <= 0) {
      this.#contentWidth = viewportWidth
      this.contentEl.style.width = `${viewportWidth}px`
      this.windowEl.style.width = `${viewportWidth}px`
      this.viewportEl.scrollLeft = 0
      this.#sampleStart = 0
      return
    }

    const rawContentWidth = Math.max(
      viewportWidth,
      (this.#sampleLength || viewportWidth) / this.#samplesPerPixel,
    )
    const contentWidth =
      rawContentWidth <= viewportWidth + 0.5 ? viewportWidth : rawContentWidth
    const renderContentWidth = Math.ceil(contentWidth)
    const maxScrollLeft = Math.max(0, contentWidth - viewportWidth)

    this.#contentWidth = contentWidth
    this.contentEl.style.width = `${renderContentWidth}px`
    this.windowEl.style.width = `${Math.ceil(viewportWidth)}px`

    let nextScrollLeft = this.#zoomPos * maxScrollLeft
    if (anchor?.sample != null) {
      nextScrollLeft =
        anchor.sample / this.#samplesPerPixel -
        (anchor.localX ?? viewportWidth / 2)
    }

    const clampedScrollLeft = clamp(nextScrollLeft, 0, maxScrollLeft)
    if (Math.abs(this.viewportEl.scrollLeft - clampedScrollLeft) > 0.5) {
      this.#suppressedScrollLeft = clampedScrollLeft
      this.viewportEl.scrollLeft = clampedScrollLeft
    }
    this.#syncFromScroll()
  }

  #syncFromScroll() {
    if (!this.viewportEl) return

    const { scrollLeft } = this.viewportEl
    const maxScrollLeft = Math.max(
      0,
      this.#contentWidth - this.viewportEl.clientWidth,
    )

    const nextZoomPos =
      maxScrollLeft === 0 ? 0 : clamp(scrollLeft / maxScrollLeft, 0, 1)
    const nextSampleStart = clamp(
      scrollLeft * this.#samplesPerPixel,
      0,
      Math.max(
        0,
        this.#sampleLength -
          this.viewportEl.clientWidth * this.#samplesPerPixel,
      ),
    )

    if (
      almostEqual(nextZoomPos, this.#zoomPos) &&
      almostEqual(nextSampleStart, this.#sampleStart)
    ) {
      return
    }

    this.#zoomPos = nextZoomPos
    this.#sampleStart = nextSampleStart
    this.#clearHover()
    this.#scheduleSync({ camera: true })
  }

  #queueScrollSync() {
    if (!this.viewportEl) return

    if (this.#suppressedScrollLeft != null) {
      const suppressedScrollLeft = this.#suppressedScrollLeft
      this.#suppressedScrollLeft = undefined
      if (Math.abs(this.viewportEl.scrollLeft - suppressedScrollLeft) <= 0.5) {
        return
      }
    }

    if (this.#scrollSyncFrame) return
    this.#scrollSyncFrame = requestAnimationFrame(() => {
      this.#scrollSyncFrame = 0
      this.#syncFromScroll()
    })
  }

  #zoomFromWheel(event) {
    if (this.#sampleLength === 0) return
    event.preventDefault()

    this.#wheelPoint = this.#getViewportPoint(event.clientX, event.clientY)
    this.#wheelDeltaY += event.deltaY
    if (this.#wheelFrame) return

    this.#wheelFrame = requestAnimationFrame(() => {
      this.#wheelFrame = 0
      const point = this.#wheelPoint
      const deltaY = this.#wheelDeltaY
      this.#wheelPoint = undefined
      this.#wheelDeltaY = 0

      if (!point) return

      const anchorSample = this.#sampleStart + point.x * this.#samplesPerPixel
      const nextSamplesPerPixel = this.#clampSamplesPerPixel(
        this.#samplesPerPixel * Math.exp(deltaY * 0.002),
      )

      if (almostEqual(nextSamplesPerPixel, this.#samplesPerPixel)) return

      this.#pendingZoomAnchor = {
        localX: point.x,
        sample: anchorSample,
      }
      this.samplesPerPixel = nextSamplesPerPixel
    })
  }

  #getViewportPoint(clientX, clientY) {
    const rect = this.viewportEl.getBoundingClientRect()
    return {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top, 0, rect.height),
    }
  }

  #getStyles() {
    const style = getComputedStyle(this)
    const background = style.getPropertyValue("--waveform-bg").trim() || "#000"
    const waveform = style.getPropertyValue("--waveform-color").trim()
    return {
      background,
      marker: this.#builtinMarkerRaw.playhead.color ?? (style.color || "#fff"),
      regionBackground: background,
      selectionBackground:
        this.#builtinRegionRaw.selection.backgroundColor ??
        (style.getPropertyValue("--waveform-selection-bg").trim() ||
          "#ffffff22"),
      waveform: waveform || "transparent",
    }
  }

  /** @param {any} raw */
  #createTrackedEntry(raw) {
    return {
      proxy: this.#trackObject(raw),
      raw,
    }
  }

  /** @param {any} value */
  #trackObject(value) {
    if (!value || typeof value !== "object") return value
    if (this.#proxyCache.has(value)) return this.#proxyCache.get(value)

    const proxy = new Proxy(value, {
      deleteProperty: (target, key) => {
        delete target[key]
        this.#scheduleSync({ timeline: true })
        return true
      },
      get: (target, key, receiver) => {
        const out = Reflect.get(target, key, receiver)
        return out && typeof out === "object" ? this.#trackObject(out) : out
      },
      set: (target, key, nextValue) => {
        target[key] = nextValue
        if (target.id === "playhead" && key === "time") {
          target[key] = clamp(parseSeconds(nextValue), 0, this.duration)
        }
        if (target.id === "selection-start" && key === "time") {
          target[key] = clamp(parseSeconds(nextValue), 0, this.duration)
        }
        if (target.id === "selection-end" && key === "time") {
          target[key] = clamp(parseSeconds(nextValue), 0, this.duration)
        }
        this.#scheduleSync({ timeline: true })
        return true
      },
    })

    this.#proxyCache.set(value, proxy)
    return proxy
  }

  /**
   * @param {Record<string, any>} target
   * @param {Record<string, any>} source
   */
  #assignTracked(target, source) {
    for (const [key, value] of Object.entries(source)) {
      target[key] = cloneValue(value)
    }
    this.#scheduleSync({ timeline: true })
  }

  #hydrateAttributeState() {
    if (this.hasAttribute("playhead")) {
      this.playhead = /** @type {any} */ (this.getAttribute("playhead"))
    }
    if (this.hasAttribute("selection-start")) {
      this.selectionStart = /** @type {any} */ (
        this.getAttribute("selection-start")
      )
    }
    if (this.hasAttribute("selection-end")) {
      this.selectionEnd = /** @type {any} */ (
        this.getAttribute("selection-end")
      )
    }
    if (this.hasAttribute("zoom")) {
      this.zoom = /** @type {any} */ (this.getAttribute("zoom"))
    }
    if (this.hasAttribute("zoom-pos")) {
      this.zoomPos = /** @type {any} */ (this.getAttribute("zoom-pos"))
    }
    if (this.hasAttribute("gutter")) {
      this.gutter = /** @type {any} */ (this.getAttribute("gutter"))
    }
    if (this.hasAttribute("channel")) {
      this.channel = /** @type {any} */ (this.getAttribute("channel"))
    }
    if (this.hasAttribute("selectable")) this.selectable = true
  }
}

export const waveform = Component.define(WaveformComponent)
