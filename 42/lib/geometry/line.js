const { abs } = Math

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @yields {{x: number, y: number}}
 */
export function* line(x0, y0, x1, y1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const adx = abs(dx)
  const ady = abs(dy)
  const sx = dx > 0 ? 1 : -1
  const sy = dy > 0 ? 1 : -1
  let eps = 0
  let x = x0
  let y = y0

  if (adx > ady) {
    for (; sx < 0 ? x >= x1 : x <= x1; x += sx) {
      yield { x, y }
      eps += ady
      if (eps << 1 >= adx) {
        y += sy
        eps -= adx
      }
    }
  } else {
    for (; sy < 0 ? y >= y1 : y <= y1; y += sy) {
      yield { x, y }
      eps += adx
      if (eps << 1 >= ady) {
        x += sx
        eps -= ady
      }
    }
  }
}
