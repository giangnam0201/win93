import { CableRouter } from "./patchCables.js"
import { line } from "../../geometry/line.js"

function distance(rect, point) {
  return (
    Math.abs((rect.left + rect.right) / 2 - point.x) +
    Math.abs((rect.top + rect.bottom) / 2 - point.y)
  )
}

function contains(rect, point) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  )
}

function blockCables(router, occupied, destination, from) {
  const blocked = []
  for (const [node, destinations] of occupied) {
    if (destinations.size === 1 && destinations.has(destination)) continue
    // A shared outlet needs a short unreserved exit to fan out.
    if (
      Math.abs(node.x * router.size - from.x) <= router.size &&
      Math.abs(node.y * router.size - from.y) <= router.size
    ) {
      continue
    }
    if (node.weight) {
      blocked.push(node)
      node.weight = 0
    }
  }
  return blocked
}

function findRoute(router, occupied, cable, from, to) {
  // Knobs route inside their dialog. Header inlets keep it as an obstacle so
  // their final segment can only enter from the left or top.
  const rects =
    to.terminal === 1
      ? router.obstacles
      : router.obstacles.filter((rect) => rect !== to.rect)
  if (to.terminal !== 1) to = { ...to, rect: undefined }
  const ordered = rects
    .filter(
      (rect) =>
        rect !== from.rect &&
        rect !== to.rect &&
        (contains(rect, from) || contains(rect, to)),
    )
    .sort(
      (a, b) =>
        Math.min(distance(a, from), distance(a, to)) -
        Math.min(distance(b, from), distance(b, to)),
    )
  let ignored = []
  for (const reserve of [true, false]) {
    for (let count = 0; count <= ordered.length; count++) {
      ignored = ordered.slice(0, count)
      router.setObstacles(rects.filter((rect) => !ignored.includes(rect)))
      const blocked = reserve
        ? blockCables(router, occupied, cable.destination, from)
        : []
      const points = router.route(
        { ...from, rect: ignored.includes(from.rect) ? undefined : from.rect },
        { ...to, rect: ignored.includes(to.rect) ? undefined : to.rect },
      )
      for (const node of blocked) node.weight = 1
      if (points.length > 0) return { points, ignored }
    }
  }
  return { points: [from, to], ignored }
}

function reservePoint(router, occupied, destination, point, radius) {
  const { x, y } = point
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const node = router.graph.grid[x + dx]?.[y + dy]
      if (!node) continue
      if (!occupied.has(node)) occupied.set(node, new Set())
      occupied.get(node).add(destination)
    }
  }
}

function reserveRoute(router, occupied, destination, points, radius) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    for (const { x, y } of line(
      Math.round(a.x / router.size),
      Math.round(a.y / router.size),
      Math.round(b.x / router.size),
      Math.round(b.y / router.size),
    )) {
      reservePoint(router, occupied, destination, { x, y }, radius)
    }
  }
}

/** Route the patch in a bounded world, reserving paths for other destinations. */
export function routePatchCables(
  width,
  height,
  dialogs,
  cables,
  { clearance = 1, router = new CableRouter(width + 60, height + 60, []) } = {},
) {
  const padding = 30
  const worldWidth = width + padding * 2
  const worldHeight = height + padding * 2
  const connectedDialogs = new Set(
    cables
      .filter((cable) => cable.id > 0)
      .flatMap((cable) => [cable.from.dialog, cable.to.dialog])
      .filter(Boolean),
  )
  const rects = dialogs
    .filter((rect) => connectedDialogs.has(rect.id))
    .map((rect) => ({
      ...rect,
      left: rect.left + padding,
      top: rect.top + padding,
      right: rect.right + padding,
      bottom: rect.bottom + padding,
    }))
  const occupied = new Map()
  const project = (point) => {
    const x = Math.max(0, Math.min(worldWidth, point.x + padding))
    const y = Math.max(0, Math.min(worldHeight, point.y + padding))
    // Distant endpoints route through a boundary proxy and retain an exact terminal.
    const rect =
      x === point.x + padding && y === point.y + padding
        ? rects.find((rect) => rect.id === point.dialog)
        : undefined
    return {
      x,
      y,
      rect,
      terminal: point.terminal,
    }
  }
  // Protect future destinations before routing the first cable.
  for (const cable of cables) {
    const point = project(cable.to)
    reservePoint(
      router,
      occupied,
      cable.destination,
      {
        x: Math.round(point.x / router.size),
        y: Math.round(point.y / router.size),
      },
      clearance,
    )
  }
  return cables.map((cable) => {
    router.setObstacles(rects)
    const { points, ignored } = findRoute(
      router,
      occupied,
      cable,
      project(cable.from),
      project(cable.to),
    )
    reserveRoute(router, occupied, cable.destination, points, clearance)
    const routed = points.map(({ x, y }) => ({
      x: x - padding,
      y: y - padding,
    }))
    const from = { x: Math.round(cable.from.x), y: Math.round(cable.from.y) }
    const to = { x: Math.round(cable.to.x), y: Math.round(cable.to.y) }
    if (routed[0]?.x !== from.x || routed[0]?.y !== from.y) {
      routed.unshift(from)
    }
    if (routed.at(-1)?.x !== to.x || routed.at(-1)?.y !== to.y) {
      routed.push(to)
    }
    return {
      ...cable,
      points: routed,
      ignored: ignored.map((rect) => rect.id),
    }
  })
}
