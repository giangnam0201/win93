/**
 * Force-directed "magnetic" layout for rectangles.
 * Clusters rectangles toward a center point while avoiding overlaps.
 *
 * @param {Array<{x: number, y: number, width: number, height: number}>} rects
 * @param {object} [options]
 * @param {{x: number, y: number}} [options.center]
 * @param {number} [options.gap]
 * @param {number} [options.iterations]
 * @param {number} [options.gravity]
 * @param {{x: number, y: number, width: number, height: number}} [options.bounds]
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 */
export function forceRectLayout(rects, options = {}) {
  const {
    center = { x: 0, y: 0 },
    gap = 6,
    iterations = 1000,
    gravity = 0.99,
    bounds,
  } = options

  const repulsionRange = 150
  const repulsionStrength = 0.4

  for (let i = 0; i < iterations; i++) {
    const isFirstHalf = i < iterations * 0.5
    const isLastPhase = i > iterations * 0.8

    for (let j = 0; j < rects.length; j++) {
      const r1 = rects[j]
      const cx1 = r1.x + r1.width / 2
      const cy1 = r1.y + r1.height / 2

      // 1. Centripetal Attraction (Normalized to ensure circular spread)
      const dx = center.x - cx1
      const dy = center.y - cy1
      const dist = Math.hypot(dx, dy)
      if (dist > 1) {
        const speed = isLastPhase ? 0.05 : gravity
        r1.x += (dx / dist) * speed
        r1.y += (dy / dist) * speed
      }

      // 2. Jitter (Break local minima lines)
      if (isFirstHalf) {
        r1.x += (Math.random() - 0.5) * 0.2
        r1.y += (Math.random() - 0.5) * 0.2
      }

      // 3. Global Repulsion
      if (!isLastPhase) {
        applyRepulsion(r1, j, rects, repulsionRange, repulsionStrength)
      }
    }

    // 4. Collision resolution
    for (let step = 0; step < 2; step++) {
      resolveCollisions(rects, gap, bounds)
    }

    // 5. Boundary clamping
    if (bounds) applyBounds(rects, bounds)
  }

  // 6. Final strict convergence phase (Strict gap enforcement)
  for (let step = 0; step < 150; step++) {
    const changed = resolveCollisions(rects, gap, bounds)
    const moved = bounds ? applyBounds(rects, bounds) : false
    if (!changed && !moved) break
  }

  return rects
}

/**
 * @param {Array<{x: number, y: number, width: number, height: number}>} rects
 * @param {{x: number, y: number, width: number, height: number}} bounds
 * @returns {boolean} True if any rectangle was moved.
 */
function applyBounds(rects, bounds) {
  let changed = false
  for (const r of rects) {
    const oldX = r.x
    const oldY = r.y

    const right = bounds.x + bounds.width - r.width
    const bottom = bounds.y + bounds.height - r.height

    r.x = Math.max(bounds.x, Math.min(right, r.x))
    r.y = Math.max(bounds.y, Math.min(bottom, r.y))

    if (r.x !== oldX || r.y !== oldY) changed = true
  }
  return changed
}

/**
 * @param {{x: number, y: number, width: number, height: number}} r1
 * @param {number} index
 * @param {Array<{x: number, y: number, width: number, height: number}>} rects
 * @param {number} range
 * @param {number} strength
 */
function applyRepulsion(r1, index, rects, range, strength) {
  const cx1 = r1.x + r1.width / 2
  const cy1 = r1.y + r1.height / 2
  for (let k = index + 1; k < rects.length; k++) {
    const r2 = rects[k]
    const rdx = cx1 - (r2.x + r2.width / 2)
    const rdy = cy1 - (r2.y + r2.height / 2)
    const rdist = Math.hypot(rdx, rdy)

    if (rdist > 0 && rdist < range) {
      const force = ((range - rdist) / range) * strength
      r1.x += (rdx / rdist) * force
      r1.y += (rdy / rdist) * force
      r2.x -= (rdx / rdist) * force
      r2.y -= (rdy / rdist) * force
    }
  }
}

/**
 * @param {Array<{x: number, y: number, width: number, height: number}>} rects
 * @param {number} gap
 * @param {{x: number, y: number, width: number, height: number}} [bounds]
 * @returns {boolean} True if any collision was resolved.
 */
function resolveCollisions(rects, gap, bounds) {
  let changed = false
  for (let j = 0; j < rects.length; j++) {
    const r1 = rects[j]
    for (let k = j + 1; k < rects.length; k++) {
      const r2 = rects[k]

      const dx = r1.x + r1.width / 2 - (r2.x + r2.width / 2)
      const dy = r1.y + r1.height / 2 - (r2.y + r2.height / 2)

      const combinedHalfWidth = (r1.width + r2.width) / 2 + gap
      const combinedHalfHeight = (r1.height + r2.height) / 2 + gap

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDx < combinedHalfWidth && absDy < combinedHalfHeight) {
        changed = true
        const overlapX = combinedHalfWidth - absDx
        const overlapY = combinedHalfHeight - absDy

        const horizontalBias = 1.2
        if (overlapX * horizontalBias < overlapY) {
          pushAxis(r1, r2, {
            diff: dx,
            overlap: overlapX,
            horizontal: true,
            bounds,
          })
        } else {
          pushAxis(r1, r2, {
            diff: dy,
            overlap: overlapY,
            horizontal: false,
            bounds,
          })
        }
      }
    }
  }
  return changed
}

/**
 * @param {{x: number, y: number, width: number, height: number}} r1
 * @param {{x: number, y: number, width: number, height: number}} r2
 * @param {object} config
 * @param {number} config.diff
 * @param {number} config.overlap
 * @param {boolean} config.horizontal
 * @param {{x: number, y: number, width: number, height: number}} [config.bounds]
 */
function pushAxis(r1, r2, config) {
  const { diff, overlap, horizontal, bounds } = config
  const dir = diff === 0 ? Math.random() - 0.5 : diff < 0 ? -1 : 1
  let ratio1 = 0.5
  let ratio2 = 0.5

  if (bounds) {
    const r1AtEdge = horizontal
      ? dir < 0
        ? r1.x <= bounds.x
        : r1.x + r1.width >= bounds.x + bounds.width
      : dir < 0
        ? r1.y <= bounds.y
        : r1.y + r1.height >= bounds.y + bounds.height
    const r2AtEdge = horizontal
      ? dir > 0
        ? r2.x <= bounds.x
        : r2.x + r2.width >= bounds.x + bounds.width
      : dir > 0
        ? r2.y <= bounds.y
        : r2.y + r2.height >= bounds.y + bounds.height

    if (r1AtEdge && !r2AtEdge) {
      ratio1 = 0
      ratio2 = 1
    } else if (r2AtEdge && !r1AtEdge) {
      ratio1 = 1
      ratio2 = 0
    }
  }

  if (horizontal) {
    r1.x += overlap * dir * ratio1
    r2.x -= overlap * dir * ratio2
  } else {
    r1.y += overlap * dir * ratio1
    r2.y -= overlap * dir * ratio2
  }
}
