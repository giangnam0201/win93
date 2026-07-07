/* eslint-disable max-params */
import { untilNextTask } from "../../../lib/timing/untilNextTask.js"

const TILE_WIDTH = 256
const BUFFER_VIEWPORTS = 1
const supportSAB = globalThis.SharedArrayBuffer !== undefined
const supportWaitAsync = typeof Atomics.waitAsync === "function"

const POINTER_PHASE = {
  end: 3,
  hover: 4,
  idle: 0,
  leave: 5,
  move: 2,
  start: 1,
}

const SHARED_EVENT = {
  change: 2,
  input: 1,
  none: 0,
}

const SHARED_HOVER = {
  handler: 3,
  handlerActive: 4,
  marker: 1,
  markerActive: 2,
  none: 0,
}

/** @type {OffscreenCanvas} */
let canvas
/** @type {OffscreenCanvasRenderingContext2D} */
let ctx

const state = {
  audio: {
    channels: /** @type {Float32Array[]} */ ([]),
    sampleCount: 0,
    sampleRate: 44_100,
  },
  builtins: {
    markerDefinitions: createBuiltinMarkerDefinitions(),
    playheadSample: 0,
    regionDefinitions: createBuiltinRegionDefinitions(),
    selectionEndSample: 0,
    selectionStartSample: 0,
  },
  camera: {
    channel: "merged",
    gutter: 0.1,
    sampleStart: 0,
    samplesPerPixel: 1,
    selectable: false,
  },
  graph: createEmptyGraph(),
  hover: null,
  interaction: null,
  shared: {
    loopToken: 0,
    pointerMeta: /** @type {Int32Array | null} */ (null),
    pointerPos: /** @type {Float64Array | null} */ (null),
    responseData: /** @type {Float64Array | null} */ (null),
    responseMeta: /** @type {Int32Array | null} */ (null),
    responseSeq: 0,
  },
  style: {
    background: "#000",
    marker: "#fff",
    regionBackground: "#000",
    waveform: "transparent",
  },
  timeline: {
    pluginMarkers: [],
    pluginRegions: [],
  },
}

class Projection {
  /**
   * @param {{
   *   height: number
   *   sampleCount: number
   *   sampleRate: number
   *   sampleStart: number
   *   samplesPerPixel: number
   *   width: number
   * }} options
   */
  constructor(options) {
    this.height = options.height
    this.sampleCount = options.sampleCount
    this.sampleRate = options.sampleRate
    this.sampleStart = clamp(options.sampleStart, 0, options.sampleCount)
    this.samplesPerPixel = Math.max(1e-6, options.samplesPerPixel || 1)
    this.width = options.width
    this.contentWidth = Math.max(
      options.width,
      Math.ceil(options.sampleCount / this.samplesPerPixel) || options.width,
    )
    this.scrollContentX = this.sampleStart / this.samplesPerPixel
    this.sampleEnd = Math.min(
      options.sampleCount,
      this.sampleStart + options.width * this.samplesPerPixel,
    )
  }

  /** @param {number} sample */
  sampleToContentX(sample) {
    return sample / this.samplesPerPixel
  }

  /** @param {number} sample */
  sampleToViewportX(sample) {
    return this.sampleToContentX(sample) - this.scrollContentX
  }

  /** @param {number} x */
  viewportXToSample(x) {
    return clamp(
      this.sampleStart + x * this.samplesPerPixel,
      0,
      this.sampleCount,
    )
  }

  /** @param {number} contentX */
  contentXToSample(contentX) {
    return clamp(contentX * this.samplesPerPixel, 0, this.sampleCount)
  }

  /** @param {number} sample */
  sampleToSeconds(sample) {
    if (!this.sampleRate) return 0
    return clamp(sample, 0, this.sampleCount) / this.sampleRate
  }

  get visibleContentStart() {
    return Math.floor(this.scrollContentX)
  }

  get visibleContentEnd() {
    return Math.ceil(this.scrollContentX + this.width)
  }
}

class Marker {
  /** @param {any} definition */
  constructor(definition) {
    this.activeCursor = definition.activeCursor ?? definition.cursor ?? null
    this.clear = definition.clear !== false
    this.color = definition.color ?? "#fff"
    this.cursor = definition.cursor ?? null
    this.draggable = definition.draggable !== false
    this.hoverColor = definition.hoverColor ?? null
    this.hitzone = Math.max(0, definition.hitzone ?? 5)
    this.id = definition.id
    this.sample = definition.sample ?? 0
    this.slot = definition.slot ?? -1
    this.visible = definition.visible !== false
    this.width = Math.max(0, definition.width ?? 1)
  }

  /**
   * @param {Projection} projection
   * @param {number} height
   */
  getRect(projection, height) {
    const centerX = Math.round(projection.sampleToViewportX(this.sample))
    const visualWidth = Math.max(1, Math.round(this.width))
    const x = Math.round(centerX - visualWidth / 2)

    return {
      centerX,
      height,
      hitLeft: centerX - this.hitzone / 2,
      hitRight: centerX + this.hitzone / 2,
      width: visualWidth,
      x,
      y: 0,
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {Projection} projection
   * @param {number} height
   */
  hitTest(x, y, projection, height) {
    if (!this.visible || this.hitzone <= 0) return false
    const rect = this.getRect(projection, height)
    return y >= 0 && y <= rect.height && x >= rect.hitLeft && x <= rect.hitRight
  }

  /**
   * @param {Projection} projection
   * @param {number} height
   * @param {boolean} [hovered]
   */
  render(projection, height, hovered = false) {
    const color =
      hovered && !isTransparent(this.hoverColor) ? this.hoverColor : this.color
    if (!this.visible || isTransparent(color)) return

    const rect = this.getRect(projection, height)
    if (rect.x + rect.width < 0 || rect.x > projection.width) return

    paintRect(rect.x, 0, rect.width, height, color, this.clear)
  }
}

class RegionHandler {
  /** @param {any} definition */
  constructor(definition) {
    this.alignX = definition.alignX ?? "start"
    this.alignY = definition.alignY ?? "start"
    this.activeCursor = definition.activeCursor ?? definition.cursor ?? null
    this.clear = definition.clear !== false
    this.color = definition.color ?? "transparent"
    this.cursor = definition.cursor ?? null
    this.height = definition.height ?? "100%"
    this.hoverColor = definition.hoverColor ?? null
    this.id = definition.id
    this.kind = definition.kind ?? "custom"
    this.slot = definition.slot ?? -1
    this.width = definition.width ?? "5px"
    this.x = definition.x ?? "0%"
    this.y = definition.y ?? "0%"
  }

  /**
   * @param {{ height: number, width: number, x: number, y: number }} regionRect
   */
  getRect(regionRect) {
    const width = Math.max(
      1,
      Math.round(parseUnit(this.width, regionRect.width)),
    )
    const height = Math.max(
      1,
      Math.round(parseUnit(this.height, regionRect.height)),
    )
    let x = regionRect.x + parseUnit(this.x, regionRect.width)
    let y = regionRect.y + parseUnit(this.y, regionRect.height)

    if (this.alignX === "center") x -= width / 2
    else if (this.alignX === "end") x -= width

    if (this.alignY === "center") y -= height / 2
    else if (this.alignY === "end") y -= height

    return {
      height,
      width,
      x: Math.round(x),
      y: Math.round(y),
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {{ height: number, width: number, x: number, y: number }} regionRect
   */
  hitTest(x, y, regionRect) {
    const rect = this.getRect(regionRect)
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    )
  }

  /**
   * @param {{ height: number, width: number, x: number, y: number }} regionRect
   * @param {boolean} [hovered]
   */
  render(regionRect, hovered = false) {
    const color =
      hovered && !isTransparent(this.hoverColor) ? this.hoverColor : this.color
    if (isTransparent(color)) return
    const rect = this.getRect(regionRect)
    paintRect(rect.x, rect.y, rect.width, rect.height, color, this.clear)
  }
}

class Region {
  /** @param {any} definition */
  constructor(definition) {
    this.backgroundColor = definition.backgroundColor ?? "transparent"
    this.clear = definition.clear !== false
    this.endMarker = definition.endMarker
    this.endSample = definition.endSample
    this.handlers = (definition.handlers ?? []).map(
      (handler, index) => new RegionHandler({ ...handler, slot: index }),
    )
    this.id = definition.id
    this.movable = definition.movable !== false
    this.overlap = definition.overlap ?? {}
    this.slot = definition.slot ?? -1
    this.startMarker = definition.startMarker
    this.startSample = definition.startSample
    this.visible = definition.visible !== false
    this.waveformColor = definition.waveformColor ?? "transparent"
  }

  /** @param {Map<string, Marker>} markers */
  resolveSamples(markers) {
    const start = this.startMarker
      ? (markers.get(this.startMarker)?.sample ?? 0)
      : (this.startSample ?? 0)
    const end = this.endMarker
      ? (markers.get(this.endMarker)?.sample ?? 0)
      : (this.endSample ?? 0)

    return {
      end: Math.max(start, end),
      start: Math.min(start, end),
    }
  }

  /**
   * @param {Projection} projection
   * @param {Map<string, Marker>} markers
   */
  getRect(projection, markers) {
    const { end, start } = this.resolveSamples(markers)
    const x0 = projection.sampleToViewportX(start)
    const x1 = projection.sampleToViewportX(end)

    return {
      height: projection.height,
      sampleEnd: end,
      sampleStart: start,
      width: Math.max(0, Math.round(x1 - x0)),
      x: Math.round(x0),
      y: 0,
    }
  }

  /**
   * @param {number} sample
   * @param {Map<string, Marker>} markers
   */
  containsSample(sample, markers) {
    const { end, start } = this.resolveSamples(markers)
    return sample >= start && sample <= end
  }
}

class TileCache {
  constructor() {
    this.reset()
  }

  reset() {
    this.bands = new Map()
    this.generatedTiles = 0
    this.lastFrame = {
      bandKey: "",
      coverageEnd: 0,
      coverageStart: 0,
      renderedTiles: [],
    }
  }

  /**
   * @param {Projection} projection
   * @param {string} channelKey
   */
  getBandKey(projection, channelKey) {
    return `${channelKey}:${projection.samplesPerPixel.toFixed(4)}:${projection.height}:${state.camera.gutter.toFixed(4)}`
  }

  /**
   * @param {{ channels: Float32Array[], sampleCount: number }} audio
   * @param {Projection} projection
   * @param {string} channelKey
   */
  ensure(audio, projection, channelKey) {
    const bandKey = this.getBandKey(projection, channelKey)
    let band = this.bands.get(bandKey)

    if (!band) {
      band = new Map()
      this.bands.set(bandKey, band)
    }

    const bufferPixels = projection.width * BUFFER_VIEWPORTS
    const bufferedStart = Math.max(
      0,
      projection.visibleContentStart - bufferPixels,
    )
    const bufferedEnd = Math.min(
      projection.contentWidth,
      projection.visibleContentEnd + bufferPixels,
    )
    const startTile = Math.floor(bufferedStart / TILE_WIDTH)
    const endTile = Math.floor(
      Math.max(bufferedStart, bufferedEnd - 1) / TILE_WIDTH,
    )
    const renderedTiles = []

    for (let tileIndex = startTile; tileIndex <= endTile; tileIndex++) {
      let tile = band.get(tileIndex)
      if (!tile) {
        tile = buildTile(audio, projection, channelKey, tileIndex)
        band.set(tileIndex, tile)
        this.generatedTiles += 1
      }
      renderedTiles.push(tileIndex)
    }

    this.lastFrame = {
      bandKey,
      coverageEnd: (endTile + 1) * TILE_WIDTH,
      coverageStart: startTile * TILE_WIDTH,
      renderedTiles,
    }

    return {
      band,
      bandKey,
      renderedTiles,
    }
  }

  debugState() {
    return {
      bandCount: this.bands.size,
      bandKey: this.lastFrame.bandKey,
      coverageEnd: this.lastFrame.coverageEnd,
      coverageStart: this.lastFrame.coverageStart,
      generatedTiles: this.generatedTiles,
      renderedTiles: [...this.lastFrame.renderedTiles],
    }
  }
}

const tileCache = new TileCache()

/**
 * @param {{ canvas: OffscreenCanvas }} init
 */
export function setup(init) {
  canvas = init.canvas
  ctx = canvas.getContext("2d")
  ctx.imageSmoothingEnabled = false
  rebuildGraph()
  render()
}

/**
 * @param {number} width
 * @param {number} height
 */
export function resize(width, height) {
  const prevWidth = canvas?.width ?? 0
  const prevHeight = canvas?.height ?? 0

  canvas.width = width
  canvas.height = height
  ctx.imageSmoothingEnabled = false

  state.camera.sampleStart = clamp(
    state.camera.sampleStart,
    0,
    getMaxSampleStart(width, state.camera.samplesPerPixel),
  )
  state.hover = null

  if (width !== prevWidth || height !== prevHeight) tileCache.reset()

  render()
  publishSharedState(SHARED_EVENT.none)
}

/** @param {{ channels?: Float32Array[], sampleRate?: number }} message */
export function setAudio(message) {
  state.audio.channels = message.channels ?? []
  state.audio.sampleCount = state.audio.channels[0]?.length ?? 0
  state.audio.sampleRate = Math.max(1, message.sampleRate ?? 44_100)
  state.camera.sampleStart = clamp(
    state.camera.sampleStart,
    0,
    getMaxSampleStart(canvas?.width ?? 0, state.camera.samplesPerPixel),
  )
  clampBuiltinSamples()
  state.hover = null
  tileCache.reset()
  rebuildGraph()
  render()
  publishSharedState(SHARED_EVENT.none)
}

/**
 * @param {{
 *   background?: string
 *   channel?: string | number
 *   gutter?: number
 *   marker?: string
 *   regionBackground?: string
 *   sampleStart?: number
 *   samplesPerPixel?: number
 *   selectable?: boolean
 *   waveform?: string
 * }} message
 */
export function setCamera(message) {
  if (message.background != null) state.style.background = message.background
  if (message.marker != null) state.style.marker = message.marker
  if (message.regionBackground != null) {
    state.style.regionBackground = message.regionBackground
  }
  if (message.waveform != null) state.style.waveform = message.waveform
  if (message.channel != null) state.camera.channel = String(message.channel)
  if (message.gutter != null) {
    const nextGutter = clamp(message.gutter, 0, 0.49)
    if (nextGutter !== state.camera.gutter) {
      state.camera.gutter = nextGutter
      tileCache.reset()
    }
  }
  if (message.samplesPerPixel != null) {
    state.camera.samplesPerPixel = Math.max(1e-6, message.samplesPerPixel)
  }
  if (message.selectable != null) {
    state.camera.selectable = Boolean(message.selectable)
  }
  if (message.sampleStart != null) {
    state.camera.sampleStart = clamp(
      message.sampleStart,
      0,
      getMaxSampleStart(canvas?.width ?? 0, state.camera.samplesPerPixel),
    )
  }

  state.hover = null
  render()
  publishSharedState(SHARED_EVENT.none)
}

/**
 * @param {{
 *   markers?: any[]
 *   playheadSeconds?: number
 *   regions?: any[]
 *   selectionEndSeconds?: number
 *   selectionStartSeconds?: number
 * }} message
 */
export function setTimeline(message) {
  if (message.playheadSeconds != null) {
    state.builtins.playheadSample = secondsToSample(message.playheadSeconds)
  }
  if (message.selectionStartSeconds != null) {
    state.builtins.selectionStartSample = secondsToSample(
      message.selectionStartSeconds,
    )
  }
  if (message.selectionEndSeconds != null) {
    state.builtins.selectionEndSample = secondsToSample(
      message.selectionEndSeconds,
    )
  }

  if (message.markers) {
    const parsed = parseTimelineMarkers(message.markers)
    state.builtins.markerDefinitions = parsed.builtins
    state.timeline.pluginMarkers = parsed.plugins
  }

  if (message.regions) {
    const parsed = parseTimelineRegions(message.regions)
    state.builtins.regionDefinitions = parsed.builtins
    state.timeline.pluginRegions = parsed.plugins
  }

  clampBuiltinSamples()
  state.hover = null
  rebuildGraph()
  render()
  publishSharedState(SHARED_EVENT.none)

  return getSnapshot()
}

/**
 * @param {{
 *   pointerMetaSAB?: SharedArrayBuffer
 *   pointerPosSAB?: SharedArrayBuffer
 *   responseDataSAB?: SharedArrayBuffer
 *   responseMetaSAB?: SharedArrayBuffer
 * }} message
 */
export function setPointerState(message) {
  if (!supportSAB) return false

  state.shared.pointerMeta = message.pointerMetaSAB
    ? new Int32Array(message.pointerMetaSAB)
    : null
  state.shared.pointerPos = message.pointerPosSAB
    ? new Float64Array(message.pointerPosSAB)
    : null
  state.shared.responseMeta = message.responseMetaSAB
    ? new Int32Array(message.responseMetaSAB)
    : null
  state.shared.responseData = message.responseDataSAB
    ? new Float64Array(message.responseDataSAB)
    : null
  state.shared.responseSeq = 0

  const token = ++state.shared.loopToken
  publishSharedState(SHARED_EVENT.none)

  if (
    state.shared.pointerMeta &&
    state.shared.pointerPos &&
    state.shared.responseMeta &&
    state.shared.responseData
  ) {
    runSharedPointerLoop(token)
  }

  return true
}

/**
 * @param {{ phase: "end" | "hover" | "leave" | "move" | "start", x: number, y: number }} message
 */
export function pointer(message) {
  return processPointerMessage(message, false)
}

export function debugState() {
  const projection = getProjection()
  const { graph } = state

  return {
    camera: {
      channel: normalizeChannelMode(
        state.camera.channel,
        state.audio.channels.length,
      ).key,
      sampleEnd: projection.sampleEnd,
      sampleStart: projection.sampleStart,
      samplesPerPixel: projection.samplesPerPixel,
      visibleContentEnd: projection.visibleContentEnd,
      visibleContentStart: projection.visibleContentStart,
    },
    hover: state.hover ? { ...state.hover } : null,
    markers: graph.markerList.map((marker) => ({
      id: marker.id,
      sample: marker.sample,
      seconds: projection.sampleToSeconds(marker.sample),
    })),
    regions: graph.regionList.map((region) => ({
      ...region.resolveSamples(graph.markers),
      id: region.id,
    })),
    sharedPointer: Boolean(state.shared.pointerMeta),
    style: {
      background: state.style.background,
      regionBackground: state.style.regionBackground,
      waveform: state.style.waveform,
    },
    tiles: tileCache.debugState(),
  }
}

function render() {
  if (!ctx || !canvas) return

  const { width, height } = canvas
  if (width === 0 || height === 0) return

  const projection = getProjection()
  const { graph } = state
  const { key } = normalizeChannelMode(
    state.camera.channel,
    state.audio.channels.length,
  )
  const { band } = tileCache.ensure(state.audio, projection, key)

  paintRect(0, 0, width, height, state.style.background, false)
  renderRegionBackgrounds(graph, projection)
  renderWaveform(band, graph, projection)
  renderMarkers(graph, projection)
  renderHandlers(graph, projection)
}

function getProjection() {
  return new Projection({
    height: canvas?.height ?? 0,
    sampleCount: state.audio.sampleCount,
    sampleRate: state.audio.sampleRate,
    sampleStart: state.camera.sampleStart,
    samplesPerPixel: state.camera.samplesPerPixel,
    width: canvas?.width ?? 0,
  })
}

function rebuildGraph() {
  const markers = new Map()
  const markerList = []
  const regions = new Map()
  const regionList = []
  let markerSlot = 0
  let regionSlot = 0

  const addMarker = (definition, sample) => {
    const marker = new Marker({ ...definition, sample, slot: markerSlot })
    markers.set(marker.id, marker)
    markerList.push(marker)
    markerSlot += 1
  }

  addMarker(
    state.builtins.markerDefinitions.playhead,
    state.builtins.playheadSample,
  )
  addMarker(
    state.builtins.markerDefinitions["selection-start"],
    state.builtins.selectionStartSample,
  )
  addMarker(
    state.builtins.markerDefinitions["selection-end"],
    state.builtins.selectionEndSample,
  )

  for (const definition of state.timeline.pluginMarkers) {
    addMarker(
      definition,
      clamp(definition.sample ?? 0, 0, state.audio.sampleCount),
    )
  }

  markers.set(
    "buffer-start",
    new Marker({
      color: "transparent",
      hitzone: 0,
      id: "buffer-start",
      sample: 0,
      visible: false,
      width: 0,
    }),
  )
  markers.set(
    "buffer-end",
    new Marker({
      color: "transparent",
      hitzone: 0,
      id: "buffer-end",
      sample: state.audio.sampleCount,
      visible: false,
      width: 0,
    }),
  )

  const addRegion = (definition) => {
    const region = new Region({ ...definition, slot: regionSlot })
    regions.set(region.id, region)
    regionList.push(region)
    regionSlot += 1
  }

  addRegion(state.builtins.regionDefinitions.selection)
  addRegion(state.builtins.regionDefinitions.played)
  for (const definition of state.timeline.pluginRegions) addRegion(definition)

  state.graph = { markerList, markers, regionList, regions }
}

async function runSharedPointerLoop(token) {
  const { pointerMeta, pointerPos } = state.shared
  if (!pointerMeta || !pointerPos) return

  let seenSeq = Atomics.load(pointerMeta, 0)

  while (
    token === state.shared.loopToken &&
    pointerMeta === state.shared.pointerMeta &&
    pointerPos === state.shared.pointerPos
  ) {
    const nextSeq = Atomics.load(pointerMeta, 0)
    if (nextSeq === seenSeq) {
      if (supportWaitAsync) {
        await Atomics.waitAsync(pointerMeta, 0, seenSeq).value
      } else {
        Atomics.wait(pointerMeta, 0, seenSeq, 16)
        await untilNextTask()
      }
      continue
    }

    seenSeq = nextSeq
    processPointerMessage(
      {
        phase: decodePointerPhase(Atomics.load(pointerMeta, 1)),
        x: pointerPos[0],
        y: pointerPos[1],
      },
      true,
    )
  }
}

/**
 * @param {{ phase: "end" | "hover" | "leave" | "move" | "start", x: number, y: number }} message
 * @param {boolean} fromShared
 */
// eslint-disable-next-line complexity
function processPointerMessage(message, fromShared) {
  const projection = getProjection()
  const { graph } = state
  const targetSample = projection.viewportXToSample(message.x)

  if (message.phase === "leave") {
    state.hover = null
    render()
    const response = {
      active: Boolean(state.interaction),
      hover: null,
    }
    if (fromShared) publishSharedState(SHARED_EVENT.none)
    return response
  }

  if (message.phase === "hover") {
    state.hover = hoverFromHit(hitTest(graph, message.x, message.y, projection))
    render()
    const response = {
      active: false,
      hover: state.hover,
    }
    if (fromShared) publishSharedState(SHARED_EVENT.none)
    return response
  }

  if (message.phase === "start") {
    if (!state.camera.selectable) {
      const response = { active: false, hover: state.hover }
      if (fromShared) publishSharedState(SHARED_EVENT.none)
      return response
    }

    const hit = hitTest(graph, message.x, message.y, projection)
    if (hit?.type === "handler") {
      const targetRegion = graph.regions.get(hit.regionId)
      const regionSamples = targetRegion?.resolveSamples(graph.markers) ?? {
        end: targetSample,
        start: targetSample,
      }
      state.interaction = {
        anchorSample: targetSample,
        handlerId: hit.handler.id,
        regionLength: Math.max(0, regionSamples.end - regionSamples.start),
        regionOffset: Math.max(0, targetSample - regionSamples.start),
        targetId: hit.regionId,
        targetKind: hit.handler.kind,
      }
    } else if (hit?.type === "marker" && hit.marker.draggable) {
      state.interaction = {
        anchorSample: targetSample,
        markerId: hit.marker.id,
        targetKind: "marker",
      }
    } else {
      updateBuiltinSamples({
        selectionEndSample: targetSample,
        selectionStartSample: targetSample,
      })
      state.interaction = {
        anchorSample: targetSample,
        targetKind: "create-selection",
      }
    }

    refreshBuiltinMarkers(graph)
    state.hover = hoverFromInteraction(graph)
    render()
    const response = {
      active: true,
      detail: getSnapshot(),
      event: "input",
      hover: state.hover,
    }
    if (fromShared) publishSharedState(SHARED_EVENT.input)
    return response
  }

  if (!state.interaction) {
    state.hover = hoverFromHit(hitTest(graph, message.x, message.y, projection))
    render()
    const response = { active: false, hover: state.hover }
    if (fromShared) publishSharedState(SHARED_EVENT.none)
    return response
  }

  switch (state.interaction.targetKind) {
    case "create-selection":
      updateBuiltinSamples({ selectionEndSample: targetSample })
      break

    case "resize-start":
      updateBuiltinSamples({ selectionStartSample: targetSample })
      break

    case "resize-end":
      updateBuiltinSamples({ selectionEndSample: targetSample })
      break

    case "move-region": {
      const regionLength = Math.max(0, state.interaction.regionLength)
      const nextStart = clamp(
        targetSample - (state.interaction.regionOffset ?? 0),
        0,
        Math.max(0, state.audio.sampleCount - regionLength),
      )
      updateBuiltinSamples({
        selectionEndSample: nextStart + regionLength,
        selectionStartSample: nextStart,
      })
      break
    }

    case "marker":
      if (state.interaction.markerId === "playhead") {
        updateBuiltinSamples({ playheadSample: targetSample })
      } else if (state.interaction.markerId === "selection-start") {
        updateBuiltinSamples({ selectionStartSample: targetSample })
      } else if (state.interaction.markerId === "selection-end") {
        updateBuiltinSamples({ selectionEndSample: targetSample })
      }
      break

    default:
  }

  refreshBuiltinMarkers(graph)

  if (message.phase === "end") {
    state.interaction = null
    state.hover = hoverFromHit(hitTest(graph, message.x, message.y, projection))
    render()
    const response = {
      active: false,
      detail: getSnapshot(),
      event: "change",
      hover: state.hover,
    }
    if (fromShared) publishSharedState(SHARED_EVENT.change)
    return response
  }

  state.hover = hoverFromInteraction(graph)
  render()
  const response = {
    active: true,
    detail: getSnapshot(),
    event: "input",
    hover: state.hover,
  }
  if (fromShared) publishSharedState(SHARED_EVENT.input)
  return response
}

function publishSharedState(eventType) {
  const { responseData, responseMeta } = state.shared
  if (!responseMeta || !responseData) return

  const snapshot = getSnapshot()
  const { hover } = state
  const hoverKind = hover
    ? hover.type === "marker"
      ? hover.active
        ? SHARED_HOVER.markerActive
        : SHARED_HOVER.marker
      : hover.active
        ? SHARED_HOVER.handlerActive
        : SHARED_HOVER.handler
    : SHARED_HOVER.none

  responseData[0] = snapshot.playhead
  responseData[1] = snapshot.selectionStart
  responseData[2] = snapshot.selectionEnd
  Atomics.store(responseMeta, 1, eventType)
  Atomics.store(responseMeta, 2, hoverKind)
  Atomics.store(responseMeta, 3, hover?.markerSlot ?? -1)
  Atomics.store(responseMeta, 4, hover?.regionSlot ?? -1)
  Atomics.store(responseMeta, 5, hover?.handlerSlot ?? -1)
  state.shared.responseSeq += 1
  Atomics.store(responseMeta, 0, state.shared.responseSeq)
}

/** @param {{ markers: Map<string, Marker> }} graph */
function refreshBuiltinMarkers(graph) {
  graph.markers.get("playhead").sample = state.builtins.playheadSample
  graph.markers.get("selection-start").sample =
    state.builtins.selectionStartSample
  graph.markers.get("selection-end").sample = state.builtins.selectionEndSample
}

/**
 * @param {{ playheadSample?: number, selectionEndSample?: number, selectionStartSample?: number }} message
 */
function updateBuiltinSamples(message) {
  if (message.playheadSample != null) {
    state.builtins.playheadSample = clamp(
      message.playheadSample,
      0,
      state.audio.sampleCount,
    )
  }
  if (message.selectionStartSample != null) {
    state.builtins.selectionStartSample = clamp(
      message.selectionStartSample,
      0,
      state.audio.sampleCount,
    )
  }
  if (message.selectionEndSample != null) {
    state.builtins.selectionEndSample = clamp(
      message.selectionEndSample,
      0,
      state.audio.sampleCount,
    )
  }
}

function clampBuiltinSamples() {
  updateBuiltinSamples({
    playheadSample: state.builtins.playheadSample,
    selectionEndSample: state.builtins.selectionEndSample,
    selectionStartSample: state.builtins.selectionStartSample,
  })
}

function createEmptyGraph() {
  return {
    markerList: [],
    markers: new Map(),
    regionList: [],
    regions: new Map(),
  }
}

function createBuiltinMarkerDefinitions() {
  return {
    "playhead": {
      color: "#fff",
      draggable: false,
      hitzone: 5,
      id: "playhead",
      width: 1,
    },
    "selection-end": {
      color: "#fff",
      cursor: "ew-resize",
      hoverColor: "#66d9ff",
      hitzone: 5,
      id: "selection-end",
      width: 1,
    },
    "selection-start": {
      color: "#fff",
      cursor: "ew-resize",
      hoverColor: "#66d9ff",
      hitzone: 5,
      id: "selection-start",
      width: 1,
    },
  }
}

function createBuiltinRegionDefinitions() {
  return {
    played: {
      endMarker: "playhead",
      id: "played",
      startSample: 0,
      waveformColor: "#00000080",
    },
    selection: {
      endMarker: "selection-end",
      handlers: [
        {
          activeCursor: "grabbing",
          color: "#ffffff99",
          cursor: "grab",
          height: "5%",
          hoverColor: "#f0f",
          id: "selection-drag-box",
          kind: "move-region",
          width: "100%",
          x: "0%",
          y: "0%",
        },
      ],
      id: "selection",
      overlap: {
        played: {
          background: "#1f1f1f",
        },
      },
      startMarker: "selection-start",
    },
  }
}

/** @param {any[]} definitions */
function parseTimelineMarkers(definitions) {
  const builtins = createBuiltinMarkerDefinitions()
  const plugins = []

  for (const definition of definitions) {
    if (!definition || typeof definition !== "object") continue
    const raw = cloneValue(definition)
    if (raw.id === "playhead") {
      builtins.playhead = mergeDefinition(builtins.playhead, raw)
      continue
    }
    if (raw.id === "selection-start") {
      builtins["selection-start"] = mergeDefinition(
        builtins["selection-start"],
        raw,
      )
      continue
    }
    if (raw.id === "selection-end") {
      builtins["selection-end"] = mergeDefinition(
        builtins["selection-end"],
        raw,
      )
      continue
    }
    plugins.push(raw)
  }

  return { builtins, plugins }
}

/** @param {any[]} definitions */
function parseTimelineRegions(definitions) {
  const builtins = createBuiltinRegionDefinitions()
  const plugins = []

  for (const definition of definitions) {
    if (!definition || typeof definition !== "object") continue
    const raw = cloneValue(definition)
    if (raw.id === "selection") {
      builtins.selection = mergeDefinition(builtins.selection, raw)
      continue
    }
    if (raw.id === "played") {
      builtins.played = mergeDefinition(builtins.played, raw)
      continue
    }
    plugins.push(raw)
  }

  return { builtins, plugins }
}

/**
 * @param {Record<string, any>} base
 * @param {Record<string, any>} override
 */
function mergeDefinition(base, override) {
  const merged = { ...cloneValue(base), ...cloneValue(override) }
  if (base.handlers || override.handlers) {
    merged.handlers = cloneValue(override.handlers ?? base.handlers ?? [])
  }
  if (base.overlap || override.overlap) {
    merged.overlap = cloneValue(override.overlap ?? base.overlap ?? {})
  }
  return merged
}

/** @param {unknown} value */
function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item))
  if (value && typeof value === "object") {
    const out = {}
    for (const [key, item] of Object.entries(value)) out[key] = cloneValue(item)
    return out
  }
  return value
}

/** @param {number} phase */
function decodePointerPhase(phase) {
  switch (phase) {
    case POINTER_PHASE.start:
      return "start"
    case POINTER_PHASE.move:
      return "move"
    case POINTER_PHASE.end:
      return "end"
    case POINTER_PHASE.hover:
      return "hover"
    case POINTER_PHASE.leave:
      return "leave"
    default:
      return "hover"
  }
}

/** @param {Map<number, any>} band */
function renderWaveform(band, graph, projection) {
  const visibleTileStart = Math.floor(
    projection.visibleContentStart / TILE_WIDTH,
  )
  const visibleTileEnd = Math.floor(
    Math.max(projection.visibleContentStart, projection.visibleContentEnd - 1) /
      TILE_WIDTH,
  )
  const previousByLane = new Map()

  for (
    let tileIndex = visibleTileStart;
    tileIndex <= visibleTileEnd;
    tileIndex++
  ) {
    const tile = band.get(tileIndex)
    if (!tile) continue

    for (
      let columnIndex = 0;
      columnIndex < tile.columns.length;
      columnIndex++
    ) {
      const column = tile.columns[columnIndex]
      const viewportX = Math.round(column.contentX - projection.scrollContentX)
      if (viewportX < 0 || viewportX >= projection.width) continue

      const colors = resolveColors(column.sampleMid, graph)

      for (let laneIndex = 0; laneIndex < column.lanes.length; laneIndex++) {
        const lane = column.lanes[laneIndex]
        if (!lane) continue
        const prev = previousByLane.get(laneIndex)
        const midY = Math.round((lane.top + lane.bottom) / 2)

        if (prev && Math.abs(viewportX - prev.x) <= 1) {
          line(prev.x, prev.y, viewportX, midY, colors.waveform)
        }

        paintRect(
          viewportX,
          lane.top,
          1,
          Math.max(1, lane.bottom - lane.top + 1),
          colors.waveform,
        )
        previousByLane.set(laneIndex, { x: viewportX, y: midY })
      }
    }
  }
}

function renderRegionBackgrounds(graph, projection) {
  for (let x = 0; x < projection.width; x++) {
    const sample = projection.viewportXToSample(x + 0.5)
    const colors = resolveColors(sample, graph)
    if (isTransparent(colors.background)) continue
    paintRect(x, 0, 1, projection.height, colors.background, false)
  }
}

function renderMarkers(graph, projection) {
  const hoveredMarkerId =
    state.hover?.type === "marker" ? state.hover.markerId : null
  for (const marker of graph.markerList) {
    if (marker.id === "selection-start" || marker.id === "selection-end") {
      const selection = graph.regions.get("selection")
      const samples = selection?.resolveSamples(graph.markers)
      if (!samples || samples.start === samples.end) continue
    }
    marker.render(projection, projection.height, marker.id === hoveredMarkerId)
  }
}

function renderHandlers(graph, projection) {
  const hoveredHandlerId =
    state.hover?.type === "handler" ? state.hover.handlerId : null
  for (const region of graph.regionList) {
    if (!region.visible) continue
    const rect = region.getRect(projection, graph.markers)
    if (rect.width <= 0) continue
    for (const handler of region.handlers) {
      handler.render(rect, handler.id === hoveredHandlerId)
    }
  }
}

/**
 * @param {{ markerList: Marker[], markers: Map<string, Marker>, regionList: Region[], regions: Map<string, Region> }} graph
 * @param {number} x
 * @param {number} y
 * @param {Projection} projection
 * @returns {{ handler: RegionHandler, regionId: string, regionSlot: number, type: "handler" } | { marker: Marker, type: "marker" } | null}
 */
function hitTest(graph, x, y, projection) {
  for (const region of graph.regionList) {
    const rect = region.getRect(projection, graph.markers)
    for (const handler of region.handlers) {
      if (handler.hitTest(x, y, rect)) {
        return {
          handler,
          regionId: region.id,
          regionSlot: region.slot,
          type: "handler",
        }
      }
    }
  }

  for (const marker of graph.markerList) {
    if (marker.hitTest(x, y, projection, projection.height)) {
      return {
        marker,
        type: "marker",
      }
    }
  }

  return null
}

/**
 * @param {{ handler: RegionHandler, regionId: string, regionSlot: number, type: "handler" } | { marker: Marker, type: "marker" } | null} hit
 */
function hoverFromHit(hit) {
  if (!hit) return null
  if (hit.type === "handler") {
    return {
      active: false,
      cursor: hit.handler.cursor,
      handlerId: hit.handler.id,
      handlerSlot: hit.handler.slot,
      regionId: hit.regionId,
      regionSlot: hit.regionSlot,
      type: "handler",
    }
  }

  return {
    active: false,
    cursor: hit.marker.cursor,
    markerId: hit.marker.id,
    markerSlot: hit.marker.slot,
    type: "marker",
  }
}

/** @param {{ markers: Map<string, Marker>, regions: Map<string, Region> }} graph */
function hoverFromInteraction(graph) {
  if (!state.interaction) return null

  if (state.interaction.targetKind === "marker") {
    const marker = graph.markers.get(state.interaction.markerId)
    if (!marker) return null
    return {
      active: true,
      cursor: marker.activeCursor,
      markerId: marker.id,
      markerSlot: marker.slot,
      type: "marker",
    }
  }

  if (
    state.interaction.targetKind === "resize-start" ||
    state.interaction.targetKind === "resize-end" ||
    state.interaction.targetKind === "move-region"
  ) {
    const region = graph.regions.get(state.interaction.targetId)
    const handler = region?.handlers.find(
      (item) => item.id === state.interaction.handlerId,
    )
    if (!region || !handler) return null
    return {
      active: true,
      cursor: handler.activeCursor,
      handlerId: handler.id,
      handlerSlot: handler.slot,
      regionId: region.id,
      regionSlot: region.slot,
      type: "handler",
    }
  }

  return null
}

/**
 * @param {number} sample
 * @param {{ markers: Map<string, Marker>, regionList: Region[], regions: Map<string, Region> }} graph
 */
function resolveColors(sample, graph) {
  let background = state.style.regionBackground
  let { waveform } = state.style

  for (const region of graph.regionList) {
    if (!region.visible || !region.containsSample(sample, graph.markers)) {
      continue
    }
    if (!isTransparent(region.backgroundColor)) {
      background = region.backgroundColor
    }
    if (!isTransparent(region.waveformColor)) waveform = region.waveformColor
  }

  for (const region of graph.regionList) {
    if (!region.visible || !region.containsSample(sample, graph.markers)) {
      continue
    }
    for (const [otherId, override] of Object.entries(region.overlap)) {
      const other = graph.regions.get(otherId)
      if (!other?.containsSample(sample, graph.markers)) continue
      if (override.background && !isTransparent(override.background)) {
        background = override.background
      }
      if (override.waveform && !isTransparent(override.waveform)) {
        waveform = override.waveform
      }
    }
  }

  return { background, waveform }
}

/**
 * @param {{ channels: Float32Array[], sampleCount: number }} audio
 * @param {Projection} projection
 * @param {string} channelKey
 * @param {number} tileIndex
 */
function buildTile(audio, projection, channelKey, tileIndex) {
  const channelMode = normalizeChannelMode(channelKey, audio.channels.length)
  const startContentX = tileIndex * TILE_WIDTH
  const endContentX = Math.min(
    projection.contentWidth,
    startContentX + TILE_WIDTH,
  )
  const columns = []

  for (let contentX = startContentX; contentX < endContentX; contentX++) {
    const sampleStart = Math.max(
      0,
      Math.floor(projection.contentXToSample(contentX)),
    )
    const sampleEnd = Math.max(
      sampleStart + 1,
      Math.min(
        audio.sampleCount,
        Math.ceil(projection.contentXToSample(contentX + 1)),
      ),
    )

    columns.push({
      contentX,
      lanes: buildColumnLanes(
        channelMode,
        audio.channels,
        sampleStart,
        sampleEnd,
      ),
      sampleMid: (sampleStart + sampleEnd) / 2,
    })
  }

  return {
    columns,
    tileIndex,
  }
}

/**
 * @param {{ key: string, lanes: number, type: string, indices?: number[] }} channelMode
 * @param {Float32Array[]} channels
 * @param {number} sampleStart
 * @param {number} sampleEnd
 */
function buildColumnLanes(channelMode, channels, sampleStart, sampleEnd) {
  const lanes = []
  const laneCount = Math.max(1, channelMode.lanes)
  const { gutterTop, laneGap, laneHeight } = getLaneLayout(laneCount)

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
    const laneStartY = gutterTop + laneIndex * (laneHeight + laneGap)
    const laneEndY = Math.max(laneStartY, laneStartY + laneHeight - 1)
    const indices =
      channelMode.type === "stacked"
        ? [Math.min(channels.length - 1, laneIndex)]
        : (channelMode.indices ?? [0])
    let min = 1
    let max = -1

    for (const channelIndex of indices) {
      const channel = channels[channelIndex]
      if (!channel) continue
      for (
        let sampleIndex = sampleStart;
        sampleIndex < sampleEnd;
        sampleIndex++
      ) {
        const value = channel[sampleIndex] ?? 0
        if (value < min) min = value
        if (value > max) max = value
      }
    }

    if (min > max) {
      lanes.push(null)
      continue
    }

    const amp = Math.max(1, (laneEndY - laneStartY + 1) / 2)
    const center = laneStartY + amp
    const top = clamp(Math.round(center - max * amp), laneStartY, laneEndY)
    const bottom = clamp(Math.round(center - min * amp), laneStartY, laneEndY)
    lanes.push({
      bottom: Math.max(top, bottom),
      top,
    })
  }

  if (channelMode.type === "merged") return lanes.slice(0, 1)
  if (channelMode.type === "single") return lanes.slice(0, 1)
  return lanes
}

/** @param {number} laneCount */
function getLaneLayout(laneCount) {
  const gutterTop = Math.min(
    Math.floor((canvas?.height ?? 0) / 2),
    Math.round((canvas?.height ?? 0) * clamp(state.camera.gutter, 0, 0.49)),
  )
  const gutterBottom = gutterTop
  const laneGap = laneCount > 1 ? 2 : 0
  const availableHeight = Math.max(
    1,
    (canvas?.height ?? 0) -
      gutterTop -
      gutterBottom -
      (laneCount - 1) * laneGap,
  )
  const laneHeight = Math.max(1, Math.floor(availableHeight / laneCount))

  return {
    gutterBottom,
    gutterTop,
    laneGap,
    laneHeight,
  }
}

/**
 * @param {string | number} channel
 * @param {number} channelCount
 */
function normalizeChannelMode(channel, channelCount) {
  if (channel === "stacked") {
    return {
      key: "stacked",
      lanes: Math.max(1, channelCount),
      type: "stacked",
    }
  }

  if (channel === "merged") {
    return {
      indices: [...new Array(Math.max(1, channelCount)).keys()],
      key: "merged",
      lanes: 1,
      type: "merged",
    }
  }

  let channelIndex = 0
  if (channel === "right") channelIndex = 1
  else if (channel === "left") channelIndex = 0
  else if (typeof channel === "string" && channel.startsWith("channel:")) {
    channelIndex = Number.parseInt(channel.slice(8), 10) || 0
  } else if (channel != null && channel !== "") {
    channelIndex = Number(channel) || 0
  }

  const clamped = clamp(
    Math.round(channelIndex),
    0,
    Math.max(0, channelCount - 1),
  )
  if (channelCount > 0 && clamped !== channelIndex) {
    console.warn(
      `[ui-waveform] channel ${channelIndex} exceeds ${channelCount} channels, clamped to ${clamped}`,
    )
  }

  return {
    indices: [clamped],
    key: `channel:${clamped}`,
    lanes: 1,
    type: "single",
  }
}

function getSnapshot() {
  const playhead = sampleToSeconds(state.builtins.playheadSample)
  const selectionStart = sampleToSeconds(state.builtins.selectionStartSample)
  const selectionEnd = sampleToSeconds(state.builtins.selectionEndSample)
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)

  return {
    playhead,
    played: {
      end: playhead,
      start: 0,
    },
    selection: { end, start },
    selectionEnd,
    selectionStart,
  }
}

/** @param {number} seconds */
function secondsToSample(seconds) {
  return clamp(seconds * state.audio.sampleRate, 0, state.audio.sampleCount)
}

/** @param {number} sample */
function sampleToSeconds(sample) {
  if (!state.audio.sampleRate) return 0
  return clamp(sample, 0, state.audio.sampleCount) / state.audio.sampleRate
}

/**
 * @param {number} width
 * @param {number} samplesPerPixel
 */
function getMaxSampleStart(width, samplesPerPixel) {
  return Math.max(0, state.audio.sampleCount - width * samplesPerPixel)
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} color
 * @param {boolean} [clear]
 */
function paintRect(x, y, width, height, color, clear) {
  if (!ctx || width <= 0 || height <= 0) return

  const left = Math.round(x)
  const top = Math.round(y)
  const drawWidth = Math.max(1, Math.round(width))
  const drawHeight = Math.max(1, Math.round(height))

  if (clear !== false) {
    ctx.clearRect(left, top, drawWidth, drawHeight)
  }

  ctx.fillStyle = color
  ctx.fillRect(left, top, drawWidth, drawHeight)
}

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {string} color
 */
function line(x0, y0, x1, y1, color) {
  const dx = x1 - x0
  const dy = y1 - y0
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  const sx = dx >= 0 ? 1 : -1
  const sy = dy >= 0 ? 1 : -1
  let eps = 0
  let x = x0
  let y = y0

  if (adx > ady) {
    for (; sx < 0 ? x >= x1 : x <= x1; x += sx) {
      paintRect(x, y, 1, 1, color)
      eps += ady
      if (eps << 1 >= adx) {
        y += sy
        eps -= adx
      }
    }
    return
  }

  for (; sy < 0 ? y >= y1 : y <= y1; y += sy) {
    paintRect(x, y, 1, 1, color)
    eps += adx
    if (eps << 1 >= ady) {
      x += sx
      eps -= ady
    }
  }
}

/**
 * @param {string | number} value
 * @param {number} base
 */
function parseUnit(value, base) {
  if (typeof value === "number") return value
  if (typeof value !== "string") return 0
  if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * base
  if (value.endsWith("px")) return Number.parseFloat(value)
  return Number.parseFloat(value) || 0
}

/** @param {string} color */
function isTransparent(color) {
  return !color || color === "transparent" || color === "rgba(0, 0, 0, 0)"
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
