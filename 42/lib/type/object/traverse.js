import { isObjectOrArray } from "../any/isObjectOrArray.js"

/**
 * @typedef {(
 *   key: string,
 *   val: any,
 *   obj: Record<string | symbol, any>,
 *   parentKey: string | undefined
 * ) => boolean | void} TraverseCallback
 */

/**
 * @template {Record<string | symbol, any>} T
 * @param {T} obj
 * @param {TraverseCallback} cb
 * @returns {T}
 */
export function traverse(obj, cb, parentKey, seen = new WeakSet()) {
  if (parentKey === undefined && !(obj && typeof obj === "object")) return obj

  seen.add(obj)

  for (const [key, val] of Object.entries(obj)) {
    if (cb(key, val, obj, parentKey)) continue
    if (isObjectOrArray(val) && !seen.has(val)) {
      traverse(val, cb, key, seen)
    }
  }

  return obj
}
