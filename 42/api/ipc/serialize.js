import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"

// TODO: use mergeWalkCallback
function mergeWith(target, source, options, seen = new WeakMap()) {
  for (const [key, val] of Object.entries(source)) {
    if (seen.has(val)) {
      target[key] = options?.simplify
        ? Array.isArray(seen.get(val))
          ? []
          : {}
        : seen.get(val)
    } else if (Array.isArray(val)) {
      target[key] = []
      seen.set(val, target[key])
      mergeWith(target[key], val, options, seen)
    } else if (isHashmapLike(val)) {
      if (target[key] === null || typeof target[key] !== "object") {
        target[key] = {}
      }

      seen.set(val, target[key])
      mergeWith(target[key], val, options, seen)
    } else if (options?.simplify) {
      const type = typeof val
      target[key] =
        val && (type === "object" || type === "function" || type === "symbol")
          ? options.simplify(val, { target, source, options, memory: seen })
          : val
    } else {
      target[key] = val
    }
  }

  return target
}

export function serializeError(error) {
  if (!error) return
  const { name, message, stack } = error
  return {
    _42_SERIALIZED_: "Error",
    name,
    message,
    stack,
    ...Object.fromEntries(serialize(Object.entries(error))),
  }
}

function _simplify(obj) {
  if (isInstanceOf(obj, Error)) return serializeError(obj)
  return obj[Symbol.for("serialize")]?.() ?? obj.toJSON?.() ?? {}
}

export function serialize(val, simplify = _simplify) {
  if (val && typeof val === "object") {
    if (isHashmapLike(val)) return mergeWith({}, val, { simplify })
    if (Array.isArray(val)) return mergeWith([], val, { simplify })
    return simplify(val)
  }

  return val
}
