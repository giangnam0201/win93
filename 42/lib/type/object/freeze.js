/**
 * @param {object} obj
 * @param {WeakSet<WeakKey>} visited
 */
function walk(obj, visited) {
  visited.add(obj)

  for (const key of Reflect.ownKeys(obj)) {
    const val = obj[key]
    const type = typeof val
    if (
      val !== null &&
      (type === "object" || type === "function") &&
      !visited.has(val)
    ) {
      walk(val, visited)
    }
  }

  if (!Object.isFrozen(obj)) Object.freeze(obj)
}

/**
 * Recursively freeze all unfrozen properties of `obj` that are functions or objects.
 *
 * @param {any} obj
 */
export function freeze(obj) {
  walk(obj, new WeakSet())
  return obj
}
