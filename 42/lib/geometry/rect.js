/**
 * @typedef {{left: any; right: any; top: any; bottom: any;}} Rect
 */

// thanks: http://stackoverflow.com/a/19614185

const { min, max } = Math

/**
 * @param {Rect} a
 * @param {Rect} b
 */
export function isColliding(a, b) {
  return !(
    a.top > b.bottom ||
    a.right < b.left ||
    a.bottom < b.top ||
    a.left > b.right
  )
}

/**
 * @param {Rect} a
 * @param {Rect} b
 */
export function isInside(a, b) {
  return (
    b.top <= a.top &&
    a.top <= b.bottom &&
    b.top <= a.bottom &&
    a.bottom <= b.bottom &&
    b.left <= a.left &&
    a.left <= b.right &&
    b.left <= a.right &&
    a.right <= b.right
  )
}

/**
 * @param {Rect} a
 * @param {Rect} b
 * @returns {Rect}
 */
export function intersect(a, b) {
  return {
    left: max(a.left, b.left),
    top: max(a.top, b.top),
    right: min(a.right, b.right),
    bottom: min(a.bottom, b.bottom),
  }
}

/**
 * @param {Rect} a
 * @param {Rect} b
 * @returns {Rect}
 */
export function union(a, b) {
  return {
    left: min(a.left, b.left),
    top: min(a.top, b.top),
    right: max(a.right, b.right),
    bottom: max(a.bottom, b.bottom),
  }
}
