/* eslint-disable guard-for-in */

// TODO: add types https://stackoverflow.com/a/73502026/1289275 https://github.com/binier/tiny-typed-emitter/blob/master/lib/index.d.ts

/**
 * @typedef {new (...args: any[]) => {}} Constructable
 */

const SPLIT_REGEX = /\s*\|\|\s*/

const EVENTS = Symbol.for("Emitter.EVENTS")

const arrifyEvents = (events) =>
  Array.isArray(events) ? events : events.split(SPLIT_REGEX)

/**
 * @template {Constructable} TBase
 * @param {TBase} [Base]
 */
export function Emittable(Base) {
  // @ts-ignore
  Base ??= Object

  return class Emitter extends Base {
    static EVENTS = EVENTS;

    [EVENTS] = {}

    /**
     * Add an handler for a given event or a list of events.
     *
     * @overload
     * @param {string | string[]} events
     * @param {Function} fn
     * @returns {this}
     */
    /**
     * @overload
     * @param {string | string[]} events
     * @param {{ off: true; signal?: AbortSignal }} options
     * @param {Function} fn
     * @returns {() => this}
     */
    /**
     * @overload
     * @param {string | string[]} events
     * @param {{ off?: boolean; signal?: AbortSignal }} options
     * @param {Function} fn
     * @returns {this}
     */
    /**
     * @param {string | string[]} events
     * @param {Function | { off?: boolean; signal?: AbortSignal }} options
     * @param {Function} [fn]
     * @returns {this | (() => this)}
     */
    on(events, options, fn) {
      if (typeof options === "function") {
        fn = options
        options = /** @type {unknown} */ (undefined)
      } else if (typeof fn !== "function") {
        throw new TypeError("`fn` argument is not an function")
      }

      events = arrifyEvents(events)

      for (const event of events) {
        this[EVENTS][event] ??= []
        this[EVENTS][event].push(fn)
      }

      options?.signal?.addEventListener("abort", () => this.off(events, fn))

      return options?.off //
        ? () => this.off(events, fn)
        : this
    }

    /**
     * Add a one-time handler for a given event.
     * If no handler function is provided returns a Promise that resolves once the event is emitted.
     *
     * @overload
     * @param {string} event
     * @returns {Promise<any>}
     */
    /**
     * @overload
     * @param {string} event
     * @param {Function} fn
     * @returns {this}
     */
    /**
     * @param {string} event
     * @param {Function} [fn]
     */
    once(event, fn) {
      if (fn === undefined) {
        return new Promise((resolve) => {
          const on = (...args) => {
            this.off(event, on)
            resolve(args.length > 1 ? args : args[0])
          }

          this.on(event, on)
        })
      }

      const on = (...args) => {
        this.off(event, on)
        return fn(...args)
      }

      on.originalFn = fn
      this.on(event, on)
      return this
    }

    /**
     * Remove the handlers of a given event or a list of events.
     *
     * @param {string | string[]} events
     * @param {Function} [fn]
     */
    off(events, fn) {
      if (!this[EVENTS]) return this // off should never throw an error

      for (const event of arrifyEvents(events)) {
        if (event === "*" && !fn) {
          for (const key in this[EVENTS]) delete this[EVENTS][key]
        } else if (fn && this[EVENTS][event]) {
          this[EVENTS][event] = this[EVENTS][event].filter(
            (cb) => cb !== fn && cb.originalFn !== fn,
          )
          if (this[EVENTS][event].length === 0) delete this[EVENTS][event]
        } else delete this[EVENTS][event]
      }

      return this
    }

    /**
     * Calls each of the registered handlers for a given event or a list of events.
     *
     * @param {string | string[]} events
     * @param {...any} args
     */
    emit(events, ...args) {
      for (const event of arrifyEvents(events)) {
        if (this[EVENTS][event]) {
          for (const fn of this[EVENTS][event]) fn(...args)
        }

        if (this[EVENTS]["*"]) {
          for (const fn of this[EVENTS]["*"]) fn(event, ...args)
        }
      }

      return this
    }

    /**
     * Call the last registered handler of a given event and returns it's results.
     *
     * @param {string} event
     * @param {...any} args
     */
    ask(event, ...args) {
      const fn = this[EVENTS][event]?.at(-1)
      if (fn) return fn(...args)
    }

    /**
     * Calls each of the registered handlers for a given event or a list of events.
     * Returns a promise that resolves when all results are fulfilled.
     *
     * @param {string | string[]} events
     * @param {...any} args
     */
    async all(events, ...args) {
      const list = []

      for (const event of arrifyEvents(events)) {
        if (this[EVENTS][event]) {
          for (const fn of this[EVENTS][event]) list.push(fn(...args))
        }

        if (this[EVENTS]["*"]) {
          for (const fn of this[EVENTS]["*"]) list.push(fn(event, ...args))
        }
      }

      return Promise.all(list)
    }
  }
}

Emittable.EVENTS = EVENTS
