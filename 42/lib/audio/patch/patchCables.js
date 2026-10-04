import { astar, Graph, heuristics } from "../../algo/astar.js"
import { line } from "../../geometry/line.js"
import { canvasEffects } from "../../graphic/canvas/canvasEffects.js"

function corners(points) {
  const result = []
  for (const point of points) {
    const b = result.at(-1)
    if (b?.x === point.x && b.y === point.y) continue
    const a = result.at(-2)
    if (
      a &&
      (b.x - a.x) * (point.y - b.y) === (b.y - a.y) * (point.x - b.x) &&
      (b.x - a.x) * (point.x - b.x) + (b.y - a.y) * (point.y - b.y) >= 0
    ) {
      result.pop()
    }
    result.push(point)
  }
  return result
}

function removeShortDiagonals(points, size, clear, from, to) {
  const result = [...points]
  for (let i = 1; i < result.length - 2; i++) {
    const [p, a, b, c] = result.slice(i - 1, i + 3)
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (!dx || !dy || Math.max(dx, dy) > size) continue
    const verticalThenHorizontal = p.x === a.x && b.y === c.y
    const horizontalThenVertical = p.y === a.y && b.x === c.x
    if (!verticalThenHorizontal && !horizontalThenVertical) continue
    const join = verticalThenHorizontal
      ? { x: a.x, y: b.y }
      : { x: b.x, y: a.y }
    const sourceRect = i === 1 ? from.rect : undefined
    const targetRect = i + 2 === result.length - 1 ? to.rect : undefined
    if (!clear(p, join, sourceRect) || !clear(join, c, targetRect)) continue
    result.splice(i, 2, join)
    i--
  }
  return corners(result)
}

function crosses(a, b, rect) {
  let lo = 0
  let hi = 1
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, rect.left, rect.right],
    [a.y, b.y - a.y, rect.top, rect.bottom],
  ]) {
    if (delta === 0) {
      if (start < min || start > max) return false
    } else {
      const t1 = (min - start) / delta
      const t2 = (max - start) / delta
      lo = Math.max(lo, Math.min(t1, t2))
      hi = Math.min(hi, Math.max(t1, t2))
    }
  }
  return lo <= hi
}

function mergeTerminalRun(points, clear) {
  if (points.length < 5) return points
  const [p, a, b, c] = points
  // H-D-H (or V-D-V): slide the diagonal along the terminal and eliminate
  // the extra grid-aligned run. Keep both port terminals axial.
  const horizontal = p.y === a.y && b.y === c.y
  const vertical = p.x === a.x && b.x === c.x
  if (
    (!horizontal && !vertical) ||
    Math.abs(b.x - a.x) !== Math.abs(b.y - a.y)
  ) {
    return points
  }
  const join = { x: a.x + c.x - b.x, y: a.y + c.y - b.y }
  if (
    (join.x - p.x) * (a.x - p.x) + (join.y - p.y) * (a.y - p.y) <= 0 ||
    !clear(a, join) ||
    !clear(join, c)
  ) {
    return points
  }
  return corners([p, join, ...points.slice(3)])
}

function approachSide(points, p, size) {
  const next =
    points.find((point) => Math.hypot(point.x - p.x, point.y - p.y) >= size) ??
    points.at(-1)
  const dx = next.x - p.x
  const dy = next.y - p.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left"
  return dy > 0 ? "bottom" : "top"
}

// Join the exact terminal axis to the first clear grid run.
function joinTerminal(points, endpoint, side, clear, size) {
  const p = { x: Math.round(endpoint.x), y: Math.round(endpoint.y) }
  if (points[0]?.x === p.x && points[0].y === p.y) return points
  if (side === "any") side = approachSide(points, p, size)
  const vertical = side === "top" || side === "bottom"
  const axis = vertical ? "y" : "x"
  const cross = vertical ? "x" : "y"
  const sign = side === "right" || side === "bottom" ? 1 : -1
  const boundary = endpoint.rect ? endpoint.rect[side] + sign : p[axis]
  const accept = (join, next) =>
    sign * (join[axis] - boundary) >= 0 &&
    clear(p, join, endpoint.rect) &&
    clear(join, next)

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const delta = b[cross] - a[cross]
    if (!delta) continue
    const t = (p[cross] - a[cross]) / delta
    if (
      t > 1 ||
      t * Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) < -size
    ) {
      continue
    }
    const join = { ...p, [axis]: Math.round(a[axis] + t * (b[axis] - a[axis])) }
    if (accept(join, b)) return corners([p, join, ...points.slice(i)])
  }
  for (let i = 0; i < points.length; i++) {
    const next = points[i]
    const join = {
      ...p,
      [axis]: next[axis] - sign * Math.abs(next[cross] - p[cross]),
    }
    if (accept(join, next)) return corners([p, join, ...points.slice(i)])
  }
  const next = points[0]
  return clear(p, next, endpoint.rect) ? corners([p, ...points]) : []
}

/** A reusable routing grid for one layout. */
export class CableRouter {
  blocked = new Set()

  constructor(width, height, obstacles, size = 10) {
    this.size = size
    this.obstacles = obstacles
    const grid = Array.from({ length: Math.ceil(width / size) + 1 }, () =>
      new Array(Math.ceil(height / size) + 1).fill(1),
    )
    this.graph = new Graph(grid, { diagonal: true })
    this.setObstacles(obstacles)
    const neighbors = this.graph.neighbors.bind(this.graph)
    this.graph.neighbors = (node) =>
      neighbors(node).filter(
        (next) =>
          next.x === node.x ||
          next.y === node.y ||
          (this.graph.grid[node.x][next.y].weight &&
            this.graph.grid[next.x][node.y].weight),
      )
  }

  /** Reuse graph nodes when dialogs move; only update occupied cells. */
  setObstacles(obstacles) {
    const { size } = this
    this.obstacles = obstacles
    for (const node of this.blocked) node.weight = 1
    this.blocked.clear()
    for (const rect of obstacles) {
      for (
        let x = Math.max(0, Math.floor(rect.left / size));
        x <= Math.min(this.graph.grid.length - 1, Math.ceil(rect.right / size));
        x++
      ) {
        for (
          let y = Math.max(0, Math.floor(rect.top / size));
          y <=
          Math.min(
            this.graph.grid[x].length - 1,
            Math.ceil(rect.bottom / size),
          );
          y++
        ) {
          const node = this.graph.grid[x]?.[y]
          if (node) {
            node.weight = 0
            this.blocked.add(node)
          }
        }
      }
    }
  }

  /** Route exact endpoints through explicit, tidy terminal approaches. */
  route(from, to) {
    const { size, graph } = this
    const clear = (a, b, owner) => {
      if (
        this.obstacles.some((rect) => rect !== owner && crosses(a, b, rect))
      ) {
        return false
      }
      // Reservations live on the coarse grid too; never shortcut another cable.
      for (const { x, y } of line(
        Math.round(a.x / size),
        Math.round(a.y / size),
        Math.round(b.x / size),
        Math.round(b.y / size),
      )) {
        const node = graph.grid[x]?.[y]
        if (node && !node.weight && !this.blocked.has(node)) return false
      }
      return true
    }
    const terminal = (point, side) => {
      let x = Math.round(point.x / size)
      let y = Math.round(point.y / size)
      if (point.rect) {
        if (side === "right") x = Math.ceil(point.rect.right / size) + 1
        else if (side === "left") x = Math.floor(point.rect.left / size) - 1
        else y = Math.floor(point.rect.top / size) - 1
      }
      return graph.grid[x]?.[y]
    }
    const candidates = []
    const startSides = from.terminal === 2 ? ["right", "top"] : ["right"]
    const endSides =
      to.terminal === 1
        ? ["left", "top"]
        : to.terminal === 3
          ? ["any"]
          : ["left"]
    for (const startSide of startSides) {
      for (const endSide of endSides) {
        const start = terminal(from, startSide)
        const end = terminal(to, endSide)
        if (!start?.weight || !end?.weight) continue
        const cost =
          size * heuristics.diagonal(start, end) +
          Math.hypot(from.x - start.x * size, from.y - start.y * size) +
          Math.hypot(to.x - end.x * size, to.y - end.y * size)
        candidates.push({ start, end, startSide, endSide, cost })
      }
    }
    // Try the nearest exits first; one successful A* search is enough.
    candidates.sort((a, b) => a.cost - b.cost)
    for (const { start, end, startSide, endSide } of candidates) {
      const nodes = astar(graph, start, end, { heuristic: heuristics.diagonal })
      if (start !== end && nodes.length === 0) continue
      let points = corners([
        { x: start.x * size, y: start.y * size },
        ...nodes.map(({ x, y }) => ({ x: x * size, y: y * size })),
      ])
      points = joinTerminal(points, from, startSide, clear, size)
      if (points.length === 0) continue
      points = joinTerminal(
        points.reverse(),
        to,
        endSide,
        clear,
        size,
      ).reverse()
      if (points.length === 0) continue
      points = mergeTerminalRun(points, clear)
      points = mergeTerminalRun(points.reverse(), clear).reverse()
      points = removeShortDiagonals(points, size, clear, from, to)
      return points
    }
    return []
  }
}

/** Clip a segment before rasterizing offscreen endpoints. */
export function clipCableSegment(a, b, width, height, margin = 4) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let start = 0
  let end = 1
  for (const [p, q] of [
    [-dx, a.x + margin],
    [dx, width + margin - a.x],
    [-dy, a.y + margin],
    [dy, height + margin - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return
      continue
    }
    const r = q / p
    if (p < 0) start = Math.max(start, r)
    else end = Math.min(end, r)
    if (start > end) return
  }
  return [
    { x: Math.round(a.x + start * dx), y: Math.round(a.y + start * dy) },
    { x: Math.round(a.x + end * dx), y: Math.round(a.y + end * dy) },
  ]
}

/** Rasterize a themed cable, clipping distant endpoints before allocating a mask. */
export function rasterCable(points, selected = false, options = {}) {
  if (points.length === 0) return
  const width = Math.max(1, Math.round(options.width ?? 1))
  const border = Math.max(0, Math.round(options.borderWidth ?? 1))
  const margin = width + border
  const segments = []
  for (let i = 1; i < points.length; i++) {
    const pair = options.viewport
      ? clipCableSegment(points[i - 1], points[i], ...options.viewport, margin)
      : [points[i - 1], points[i]].map(({ x, y }) => ({
          x: Math.round(x),
          y: Math.round(y),
        }))
    if (pair) segments.push(pair)
  }
  if (segments.length === 0) return
  const vertices = segments.flat()
  const left = Math.min(...vertices.map((p) => p.x)) - margin
  const top = Math.min(...vertices.map((p) => p.y)) - margin
  const canvas =
    options.canvas ??
    (typeof document === "undefined"
      ? new OffscreenCanvas(1, 1)
      : document.createElement("canvas"))
  const canvasWidth = Math.max(...vertices.map((p) => p.x)) - left + margin + 1
  const canvasHeight = Math.max(...vertices.map((p) => p.y)) - top + margin + 1
  if (canvas.width !== canvasWidth) canvas.width = canvasWidth
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight
  const ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = selected
    ? (options.selectedColor ?? "#00f")
    : (options.color ?? "#fff")
  const offset = Math.floor(width / 2)
  for (const [a, b] of segments) {
    for (const { x, y } of line(a.x, a.y, b.x, b.y)) {
      ctx.fillRect(x - left - offset, y - top - offset, width, width)
    }
  }
  for (let i = 0; i < border; i++) {
    canvasEffects.outline(ctx, options.borderColor ?? "#000", "square")
  }
  return { canvas, left, top }
}

/** Spatial segment index; clicks only inspect segments in one nearby bucket. */
export class CableHitIndex {
  buckets = new Map()
  size = 16

  add(cable, points) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const segment = { cable, a, b }
      for (
        let x = Math.floor((Math.min(a.x, b.x) - 3) / this.size);
        x <= Math.floor((Math.max(a.x, b.x) + 3) / this.size);
        x++
      ) {
        for (
          let y = Math.floor((Math.min(a.y, b.y) - 3) / this.size);
          y <= Math.floor((Math.max(a.y, b.y) + 3) / this.size);
          y++
        ) {
          const key = `${x},${y}`
          if (!this.buckets.has(key)) this.buckets.set(key, [])
          this.buckets.get(key).push(segment)
        }
      }
    }
  }

  hit(x, y) {
    const bucket = this.buckets.get(
      `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`,
    )
    if (!bucket) return
    for (let i = bucket.length - 1; i >= 0; i--) {
      const { cable, a, b } = bucket[i]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length = dx * dx + dy * dy
      const t = length
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length))
        : 0
      if ((x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2 <= 9) return cable
    }
  }
}
