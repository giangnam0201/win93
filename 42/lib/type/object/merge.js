import { isHashmapLike } from "../any/isHashmapLike.js"

export function mergeWalk(target, source, seen = new WeakMap()) {
  for (const [key, val] of Object.entries(source)) {
    if (seen.has(val)) {
      target[key] = seen.get(val)
    } else if (Array.isArray(val)) {
      target[key] = []
      seen.set(val, target[key])
      mergeWalk(target[key], val, seen)
    } else if (isHashmapLike(val)) {
      if (target[key] == null || typeof target[key] !== "object") {
        target[key] = {}
      }

      seen.set(val, target[key])
      mergeWalk(target[key], val, seen)
    } else {
      target[key] = val
    }
  }

  return target
}

export function mergeWalkCallback(target, source, cb, seen = new WeakMap()) {
  for (const [key, val] of Object.entries(source)) {
    if (cb({ key, val, target, source, seen }) === true) continue

    if (seen.has(val)) {
      target[key] = seen.get(val)
    } else if (Array.isArray(val)) {
      target[key] = []
      seen.set(val, target[key])
      mergeWalkCallback(target[key], val, cb, seen)
    } else if (isHashmapLike(val)) {
      if (target[key] == null || typeof target[key] !== "object") {
        target[key] = {}
      }

      seen.set(val, target[key])
      mergeWalkCallback(target[key], val, cb, seen)
    } else {
      target[key] = val
    }
  }

  return target
}

export function merge(target, source, callback) {
  return callback
    ? mergeWalkCallback(target, source, callback)
    : mergeWalk(target, source)
}
