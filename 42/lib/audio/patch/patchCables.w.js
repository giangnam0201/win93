import { readPatchScene } from "./patchScene.js"
import { routePatchCables } from "./routePatchCables.js"
import { rasterCable, clipCableSegment, CableRouter } from "./patchCables.js"
import { cableLayers, clearCableDialog } from "./cableLayers.js"
import { line } from "../../geometry/line.js"

let canvas
let ctx
let routeKey
let routes = []
let pointsById = new Map()
let stackingKey
let routings = 0
let rasterizations = 0
const rasterCache = new Map()
let hitData
let hitMeta
let lastRevision = 0
let sceneBuffer
let sceneStyle
let frame
let sceneMeta
let router
let paints = 0
let duration = 0

export function setup(init) {
  canvas = init.canvas
  ctx = canvas.getContext("2d")
  frame = requestAnimationFrame(renderFrame)
}

export function resize(width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    router = undefined
    routeKey = undefined
  }
}

/** Keep shared buffers attached; animation frames discover new revisions directly. */
export function configure({ buffer, style, hits }) {
  sceneBuffer = buffer
  sceneMeta = new Int32Array(buffer, 0, 4)
  sceneStyle = style
  hitMeta = new Int32Array(hits, 0, 4)
  hitData = new Int32Array(hits, 16)
  lastRevision = 0
}

function renderFrame() {
  try {
    paintScene()
  } finally {
    frame = requestAnimationFrame(renderFrame)
  }
}

/** Process only complete snapshots; expensive work stays on this worker. */
function paintScene() {
  if (!sceneMeta) return
  const revisionNow = Atomics.load(sceneMeta, 0)
  if (revisionNow === lastRevision || revisionNow % 2) return
  const scene = readPatchScene(sceneBuffer)
  if (!scene) return
  const start = performance.now()
  const { width, height, cables, dialogs, revision } = scene
  const style = sceneStyle
  resize(width, height)
  const fixed = cables.filter((cable) => cable.id > 0)
  const key = JSON.stringify([
    width,
    height,
    style.straightLines ? undefined : dialogs.map(({ z, ...rect }) => rect),
    style.width,
    style.borderWidth,
    fixed.map(({ selected, color, ...cable }) => cable),
  ])
  const geometryChanged = key !== routeKey
  if (geometryChanged) {
    if (style.straightLines) {
      routes = fixed.map((cable) => ({
        ...cable,
        points: [cable.from, cable.to],
        ignored: [],
      }))
    } else {
      router ??= new CableRouter(width + 60, height + 60, [])
      routes = routePatchCables(width, height, dialogs, fixed, {
        clearance: Math.max(
          1,
          Math.ceil((style.width + style.borderWidth * 2) / router.size),
        ),
        router,
      })
    }
    routeKey = key
    pointsById = new Map(routes.map((route) => [route.id, route.points]))
    routings++
  }
  const nextStackingKey = JSON.stringify([
    dialogs.map(({ id, z }) => [id, z]),
    fixed.filter((cable) => cable.selected).map(({ id }) => id),
  ])
  const hitsChanged = geometryChanged || nextStackingKey !== stackingKey
  stackingKey = nextStackingKey
  // Refresh cable objects (selection and drag state), retaining routed geometry.
  const layers = cableLayers(dialogs, cables, width, height, pointsById)
  const activeIds = new Set(cables.map(({ id }) => id))
  for (const id of rasterCache.keys()) {
    if (!activeIds.has(id)) rasterCache.delete(id)
  }
  ctx.clearRect(0, 0, width, height)
  const bank = hitsChanged
    ? 1 - Atomics.load(hitMeta, 0)
    : Atomics.load(hitMeta, 0)
  const pixels = hitData.subarray(
    bank * width * height,
    (bank + 1) * width * height,
  )
  if (hitsChanged) pixels.fill(0)
  const styleKey = JSON.stringify(style)
  const dimSelection = cables.at(-1)?.id < 0
  for (const layer of layers) {
    if (layer.rect) {
      clearCableDialog(
        ctx,
        hitsChanged ? pixels : undefined,
        width,
        height,
        layer.rect,
      )
    }
    for (const cable of layer.cables) {
      const points =
        cable.id < 0 ? [cable.from, cable.to] : pointsById.get(cable.id)
      paintCable(
        cable,
        points,
        styleKey,
        hitsChanged ? pixels : undefined,
        {
          rect: layer.clips?.get(cable.id),
          dimmed: shouldDim(cable, dimSelection),
        },
      )
    }
  }
  Atomics.store(hitMeta, 0, bank)
  Atomics.store(hitMeta, 1, revision)
  paints++
  lastRevision = revision
  duration = performance.now() - start
}

function shouldDim(cable, dimSelection) {
  return Boolean(dimSelection && cable.id > 0 && cable.selected)
}

function paintCable(cable, points, styleKey, pixels, { rect, dimmed }) {
  const { width, height } = canvas
  const raster = cableRaster(cable, points, sceneStyle, styleKey, [
    width,
    height,
  ])
  if (raster) {
    if (rect) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(
        Math.floor(rect.left),
        Math.floor(rect.top),
        Math.ceil(rect.right) - Math.floor(rect.left),
        Math.ceil(rect.bottom) - Math.floor(rect.top),
      )
      ctx.clip()
    }
    if (dimmed) ctx.globalAlpha = 0.5
    ctx.drawImage(raster.canvas, raster.left, raster.top)
    ctx.globalAlpha = 1
    if (rect) ctx.restore()
  }
  if (cable.id > 0 && pixels) {
    paintHits(pixels, [width, height, rect], cable.id, points, sceneStyle)
  }
}

function cableRaster(cable, points, style, styleKey, [width, height]) {
  const cacheKey = JSON.stringify([
    points,
    cable.selected,
    cable.color,
    styleKey,
    width,
    height,
  ])
  const cached = rasterCache.get(cable.id)
  if (cached?.key === cacheKey) return cached.raster
  const raster = rasterCable(points, cable.selected, {
    ...style,
    color: cable.color ? style.palette?.[cable.color - 1] : style.color,
    viewport: [width, height],
    canvas: cached?.raster?.canvas,
  })
  rasterCache.set(cable.id, { key: cacheKey, raster })
  rasterizations++
  return raster
}

function paintHits(pixels, [width, height, rect], id, points, style) {
  const left = Math.max(0, Math.floor(rect?.left ?? 0))
  const top = Math.max(0, Math.floor(rect?.top ?? 0))
  const right = Math.min(width, Math.ceil(rect?.right ?? width))
  const bottom = Math.min(height, Math.ceil(rect?.bottom ?? height))
  const radius = Math.max(3, Math.ceil(style.width / 2 + style.borderWidth))
  for (let i = 1; i < points.length; i++) {
    const segment = clipCableSegment(
      points[i - 1],
      points[i],
      width,
      height,
      radius,
    )
    if (!segment) continue
    const [a, b] = segment
    for (const { x, y } of line(a.x, a.y, b.x, b.y)) {
      for (
        let row = Math.max(top, y - radius);
        row <= Math.min(bottom - 1, y + radius);
        row++
      ) {
        for (
          let col = Math.max(left, x - radius);
          col <= Math.min(right - 1, x + radius);
          col++
        ) {
          pixels[row * width + col] = id
        }
      }
    }
  }
}

/** Diagnostics for geometry regressions; never used for normal pointer handling. */
export function inspect() {
  return {
    revision: lastRevision,
    routes,
    paints,
    routings,
    rasterizations,
    duration,
    frame: Boolean(frame),
  }
}
