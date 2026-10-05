/* eslint-disable complexity */

// @thanks https://github.com/epoberezkin/fast-deep-equal
// @related https://github.com/substack/node-deep-equal

import { removeItem } from "../array/removeItem.js"
import { equalsArrayBufferView } from "../binary/equalsArrayBufferView.js"

const PRIMITIVES = new Set(["boolean", "number", "string"])

function equalsObjectKeys(a, b, keysA, keysB, config) {
  const l = keysA.length
  if (l !== keysB.length) return false

  for (let i = 0; i < l; i++) {
    if (Object.hasOwn(b, keysA[i]) === false) return false
  }

  if (config.visited.has(a) && config.visited.has(b)) return true
  config.visited.add(a)
  config.visited.add(b)

  for (let i = 0, l = keysA.length; i < l; i++) {
    if (!walk(a[keysA[i]], b[keysA[i]], config)) {
      return false
    }
  }

  return true
}

function equalsObject(a, b, config) {
  const keysA = Reflect.ownKeys(a)
  const keysB = Reflect.ownKeys(b)
  return equalsObjectKeys(a, b, keysA, keysB, config)
}

function equalsError(a, b, config) {
  if (a.stack !== b.stack) return false
  // Ignore stack because Firefox error stack property is in Error prototype
  const keysA = removeItem(Reflect.ownKeys(a), "stack")
  const keysB = removeItem(Reflect.ownKeys(b), "stack")
  return equalsObjectKeys(a, b, keysA, keysB, config)
}

function equalsArray(a, b, config) {
  if (a.length !== b.length) return false

  if (config.visited.has(a) && config.visited.has(b)) return true
  config.visited.add(a)
  config.visited.add(b)

  for (let i = 0, l = a.length; i < l; i++) {
    if (!walk(a[i], b[i], config)) return false
  }

  return true
}

function equalsCollection(a, b, config) {
  if (a.size !== b.size) return false
  if (!equalsArray(a.keys(), b.keys(), config)) return false

  if (config.visited.has(a) && config.visited.has(b)) return true
  config.visited.add(a)
  config.visited.add(b)

  const arrA = [...a]
  const arrB = [...b]
  for (let i = 0, l = arrA.length; i < l; i++) {
    if (!walk(arrA[i], arrB[i], config)) return false
  }

  return true
}

function equalsArrayBuffer(a, b) {
  if (a.byteLength !== b.byteLength) return false
  return equalsArrayBufferView(new Uint8Array(a), new Uint8Array(b))
}

const compareBlob = (a, b) =>
  a.size === b.size &&
  a.type === b.type &&
  a.name === b.name &&
  a.lastModified === b.lastModified &&
  a.webkitRelativePath === b.webkitRelativePath

const deep = (compare, a, b, visited) =>
  compare(a, b, visited) && equalsObject(a, b, visited)

const constructors = new Set([
  "Map", //
  "Set",
  "ArrayBuffer",
  "Error",
])

if ("Node" in globalThis) constructors.add("Node")
if ("Blob" in globalThis) constructors.add("Blob")

function getConstructor(obj) {
  let ctor = obj?.constructor

  while (ctor) {
    if (constructors.has(ctor.name)) return ctor.name
    ctor = Object.getPrototypeOf(ctor)
  }
}

/**
 * @private
 * @param {any} a
 * @param {any} b
 * @param {{
 *   visited?: WeakSet<WeakKey>
 *   proto: boolean
 *   placeholder: any
 * }} config
 */
function walk(a, b, config) {
  if (Object.is(a, b)) return true

  const typeA = typeof a
  const typeB = typeof b

  if (typeA !== typeB || PRIMITIVES.has(typeA)) {
    if (config.placeholder && b === config.placeholder) return true
    return false
  }

  if (typeA === "object") {
    if (!(a && b)) return false
    if (config.proto === false) return equalsObject(a, b, config)

    const protoA = a.constructor?.name
    const protoB = b.constructor?.name

    if (protoA !== protoB) return false

    if (protoA !== "Object") {
      if (Array.isArray(a)) return deep(equalsArray, a, b, config)
      if (ArrayBuffer.isView(a)) return equalsArrayBufferView(a, b)

      switch (getConstructor(a)) {
        case "Map":
        case "Set":
          return deep(equalsCollection, a, b, config)
        case "ArrayBuffer":
          return equalsArrayBuffer(a, b)
        case "Error":
          return equalsError(a, b, config)
        case "Node":
          if (a.isEqualNode(b) === false) return false
          break
        case "Blob":
          if (compareBlob(a, b) === false) return false
          break
        default:
          break
      }

      const toStringA = typeof a.toString === "function"
      const toStringB = typeof b.toString === "function"
      if (toStringA && toStringB && a.toString() !== b.toString()) {
        return false
      }

      if (toStringA !== toStringB) return false
    }

    return equalsObject(a, b, config)
  }

  if (typeA === "function" && a.toString() === b.toString()) {
    return equalsObject(a, b, config)
  }

  return false
}

/**
 * Deep equality comparison used in assertions.
 *
 * @param {any} a
 * @param {any} b
 * @param {{ proto?: boolean; placeholder?: any }} [options]
 * @returns {boolean}
 */
export function equals(a, b, options) {
  return walk(a, b, {
    visited: new WeakSet(),
    proto: options?.proto ?? true,
    placeholder: options?.placeholder,
  })
}
