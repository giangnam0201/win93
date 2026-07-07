/**
 * @typedef {{x: number; y: number;}} Point
 * @typedef {{left: any; right: any; top: any; bottom: any;}} Rect
 */

/**
 * @source https://stackoverflow.com/a/16511854
 *
 * @param {Point} a
 * @param {Point} b
 */
export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * @source http://jsfiddle.net/PerroAZUL/zdaY8/1/
 *
 * @param {Point} point
 * @param {Point} a
 * @param {Point} b
 * @param {Point} c
 */
// prettier-ignore
export function inTriangle(point, a, b, c) {
  const A = 1/2 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
  const sign = A < 0 ? -1 : 1;
  const s = (a.y * c.x - a.x * c.y + (c.y - a.y) * point.x + (a.x - c.x) * point.y) * sign;
  const t = (a.x * b.y - a.y * b.x + (a.y - b.y) * point.x + (b.x - a.x) * point.y) * sign;
  return s > 0 && t > 0 && (s + t) < 2 * A * sign;
}

/**
 * @param {Point} point
 * @param {Rect} rect
 * @param {Rect} [margin]
 */
export function inRect(point, rect, margin) {
  if (margin) {
    if (typeof margin === "number") {
      margin = { left: margin, right: margin, top: margin, bottom: margin }
    }
    return (
      point.x >= rect.left - margin.left &&
      point.x <= rect.right + margin.right &&
      point.y >= rect.top - margin.top &&
      point.y <= rect.bottom + margin.bottom
    )
  }

  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  )
}
