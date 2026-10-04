// @src https://github.com/proposal-signals/signal-utils/blob/39f5b32a29ced702908ee711f2422368482f57cd/src/array.ts

// Unfortunately, TypeScript's ability to do inference *or* type-checking in a
// `Proxy`'s body is very limited, so we have to use a number of casts `as any`
// to make the internal accesses work. The type safety of these is guaranteed at
// the *call site* instead of within the body: you cannot do `Array.blah` in TS,
// and it will blow up in JS in exactly the same way, so it is safe to assume
// that properties within the getter have the correct type in TS.
import { Signal } from "../../env/polyfill/globalThis.Signal.js"

/**
 * Equality check here is always false so that we can dirty the storage via setting to _anything_.
 * This is for a pattern where we don't *directly* use signals to back the values used in collections so that instanceof checks and getters and other native features "just work" without having to do nested proxying.
 * (though, see deep.ts for nested / deep behavior).
 *
 * @param {null} [initial]
 * @returns {any}
 */
export const createStorage = (initial = null) =>
  new Signal.State(initial, { equals: () => false })

const ARRAY_GETTER_METHODS = new Set([
  Symbol.iterator,
  "concat",
  "entries",
  "every",
  "filter",
  "find",
  "findIndex",
  "flat",
  "flatMap",
  "forEach",
  "includes",
  "indexOf",
  "join",
  "keys",
  "lastIndexOf",
  "map",
  "reduce",
  "reduceRight",
  "slice",
  "some",
  "values",
])

// For these methods, `Array` itself immediately gets the `.length` to return
// after invoking them.

/**
 * @type {Set<string | symbol>}
 */
const ARRAY_WRITE_THEN_READ_METHODS = new Set(["fill", "push", "unshift"])

/**
 * @param {number | string | symbol} prop
 * @returns {number | null}
 */
function convertToInt(prop) {
  if (typeof prop === "symbol") {
    return null
  }

  const num = Number(prop)
  if (Number.isNaN(num)) {
    return null
  }

  return num % 1 === 0 ? num : null
}

// This rule is correct in the general case, but it doesn't understand
// declaration merging, which is how we're using the interface here. This says
// `SignalArray` acts just like `Array<T>`, but also has the properties
// declared via the `class` declaration above -- but without the cost of a
// subclass, which is much slower than the proxied array behavior. That is: a
// `SignalArray` *is* an `Array`, just with a proxy in front of accessors and
// setters, rather than a subclass of an `Array` which would be de-optimized by
// the browsers.

/**
 * @template {unknown} T
 * @extends {Array<T>}
 */
export class SignalArray {
  /**
   * @static
   * @template T, U
   * @param {Iterable<T> | ArrayLike<T>} iterable
   * @param {(v: T, k: number) => U} [mapfn]
   * @param {unknown} [thisArg]
   * @returns {SignalArray<T> | SignalArray<U>}
   */
  static from(iterable, mapfn, thisArg) {
    return mapfn
      ? new SignalArray(Array.from(iterable, mapfn, thisArg))
      : new SignalArray(Array.from(iterable))
  }

  /**
   * @static
   * @template T
   * @param {...T} [arr]
   * @returns {SignalArray<T>}
   */
  static of(...arr) {
    return new SignalArray(arr)
  }

  /**
   * @param {T[]} [arr]
   */
  constructor(arr = []) {
    const clone = arr.slice()
    // eslint-disable-next-line unicorn/no-this-assignment
    const self = this
    const boundFns = new Map()

    // Flag to track whether we have *just* intercepted a call to `.push()` or
    // `.unshift()`, since in those cases (and only those cases!) the `Array`
    // itself checks `.length` to return from the function call.
    let nativelyAccessingLengthFromPushOrUnshift = false

    return new Proxy(clone, {
      get(target, prop) {
        const index = convertToInt(prop)
        if (index !== null) {
          self.#readStorageFor(index)
          self.#collection.get()
          return target[index]
        }

        if (prop === "length") {
          // If we are reading `.length`, it may be a normal user-triggered
          // read, or it may be a read triggered by Array itself. In the latter
          // case, it is because we have just done `.push()` or `.unshift()`; in
          // that case it is safe not to mark this as a *read* operation, since
          // calling `.push()` or `.unshift()` cannot otherwise be part of a
          // "read" operation safely, and if done during an *existing* read
          // (e.g. if the user has already checked `.length` *prior* to this),
          // that will still trigger the mutation-after-consumption assertion.
          if (nativelyAccessingLengthFromPushOrUnshift) {
            nativelyAccessingLengthFromPushOrUnshift = false
          } else {
            self.#collection.get()
          }

          return target[prop]
        }

        // Here, track that we are doing a `.push()` or `.unshift()` by setting
        // the flag to `true` so that when the `.length` is read by `Array` (see
        // immediately above), it knows not to dirty the collection.
        if (ARRAY_WRITE_THEN_READ_METHODS.has(prop)) {
          nativelyAccessingLengthFromPushOrUnshift = true
        }

        if (ARRAY_GETTER_METHODS.has(prop)) {
          let fn = boundFns.get(prop)
          if (fn === undefined) {
            fn = (...args) => {
              self.#collection.get()
              return target[prop](...args)
            }

            boundFns.set(prop, fn)
          }

          return fn
        }

        return target[prop]
      },
      set(target, prop, value) {
        target[prop] = value
        const index = convertToInt(prop)
        if (index !== null) {
          self.#dirtyStorageFor(index)
          self.#collection.set(null)
        } else if (prop === "length") {
          self.#collection.set(null)
        }

        return true
      },
      getPrototypeOf() {
        return SignalArray.prototype
      },
    })
  }

  /**
   * @type {any}
   */
  #collection = createStorage()

  /**
   * @type {Map<PropertyKey, Signal.State<null>>}
   */
  #storages = new Map()

  /**
   * @param {number} index
   * @returns {void}
   */
  #readStorageFor(index) {
    let storage = this.#storages.get(index)
    if (storage === undefined) {
      storage = createStorage()
      this.#storages.set(index, storage)
    }

    storage.get()
  }

  /**
   * @param {number} index
   * @returns {void}
   */
  #dirtyStorageFor(index) {
    const storage = this.#storages.get(index)
    if (storage) {
      storage.set(null)
    }
  }
}

// Ensure instanceof works correctly
Object.setPrototypeOf(SignalArray.prototype, Array.prototype)

/**
 * @template Item
 * @param {Item[]} [x]
 * @returns {SignalArray<Item>}
 */
export function signalArray(x) {
  return new SignalArray(x)
}
