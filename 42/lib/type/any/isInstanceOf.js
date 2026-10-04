/**
 * Same as `instanceof` but works with objects from other realms (i.e. iframes).
 *
 * @see https://github.com/feross/buffer/issues/166
 * @template {Function} T
 * @param {any} val
 * @param {T} Class
 * @returns {val is InstanceType<T>}
 */
export function isInstanceOf(val, Class) {
  if (val instanceof Class) return true

  // `contentWindow` from sandboxed iframes throws when accessing constructor
  if (val?.window) {
    if (
      val.location &&
      val.window === val.self &&
      typeof val.postMessage === "function"
    ) {
      // @ts-ignore
      return Class === globalThis.Window
    }
  }

  let ctor = val?.constructor

  while (ctor) {
    if (ctor.name === Class.name) return true
    ctor = Object.getPrototypeOf(ctor)
  }

  return false
}
