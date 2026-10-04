/** Group cables above their highest visible endpoint, in dialog paint order. */
export function cableLayers(dialogs, cables, width, height, pointsById) {
  const ordered = [...dialogs].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const ranks = new Map(ordered.map((rect, i) => [rect.id, i + 1]))
  const layers = [
    { cables: [] },
    ...ordered.map((rect) => ({ rect, cables: [] })),
    { cables: [] },
  ]
  const endpoints = new Map()
  const rank = (point) => {
    const key = `${point.dialog},${point.x},${point.y}`
    if (endpoints.has(key)) return endpoints.get(key)
    let result = ranks.get(point.dialog) ?? 0
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
      result = 0
    } else {
      for (let i = ordered.length - 1; i >= result; i--) {
        const rect = ordered[i]
        if (
          point.x >= rect.left &&
          point.x < rect.right &&
          point.y >= rect.top &&
          point.y < rect.bottom
        ) {
          result = 0
          break
        }
      }
    }
    endpoints.set(key, result)
    return result
  }
  for (const cable of cables) {
    if (cable.id < 0 || cable.selected) {
      layers.at(-1).cables.push(cable)
      continue
    }
    const from = rank(cable.from)
    const to = rank(cable.to)
    const layer = Math.max(from, to)
    const { rect } = layers[layer]
    const points = pointsById?.get(cable.id) ?? [cable.from, cable.to]
    if (
      rect &&
      (!from || !to) &&
      points.every(
        (point) =>
          point.x >= rect.left &&
          point.x < rect.right &&
          point.y >= rect.top &&
          point.y < rect.bottom,
      )
    ) {
      continue
    }
    const lower = Math.min(
      ranks.get(cable.from.dialog) ?? 0,
      ranks.get(cable.to.dialog) ?? 0,
    )
    if ((!from || !to) && lower < layer) {
      layers[lower].cables.push(cable)
      layers[layer].clips ??= new Map()
      layers[layer].clips.set(cable.id, rect)
    }
    layers[layer].cables.push(cable)
  }
  return layers
}

/** Clear the same whole-pixel dialog rectangle from the image and hit bank. */
export function clearCableDialog(ctx, pixels, width, height, rect) {
  const left = Math.max(0, Math.floor(rect.left))
  const top = Math.max(0, Math.floor(rect.top))
  const right = Math.min(width, Math.ceil(rect.right))
  const bottom = Math.min(height, Math.ceil(rect.bottom))
  if (right <= left || bottom <= top) return
  ctx.clearRect(left, top, right - left, bottom - top)
  if (!pixels) return
  for (let y = top; y < bottom; y++) {
    pixels.fill(0, y * width + left, y * width + right)
  }
}
