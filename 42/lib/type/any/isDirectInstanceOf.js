/**
 * Same as `instanceof` but for direct instance only, and works with objects from other realms (i.e. iframes).
 *
 * @template {Function} T
 * @param {any} val
 * @param {T} Class
 * @returns {val is InstanceType<T>}
 */
export function isDirectInstanceOf(val, Class) {
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

  return val?.constructor?.name === Class.name
}
