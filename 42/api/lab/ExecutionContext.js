import { Assert } from "./Assert.js"
import { Stub } from "./Stub.js"
import { Spy } from "./Spy.js"
import { AssertionError } from "./AssertionError.js"
import { chambers } from "./helper/chambers.js"
import { pluralize } from "../../lib/type/string/pluralize.js"
import { equals } from "../../lib/type/any/equals.js"
import { clear } from "../../lib/type/object/clear.js"
import { clone } from "../../lib/type/any/clone.js"
import { kill } from "./helper/kill.js"
import { isPromiseLike } from "../../lib/type/any/isPromiseLike.js"
import { untilNextTask } from "../../lib/timing/untilNextTask.js"

/**
 * @typedef {import("./helper/kill.js").KillOptions} KillOptions
 * @typedef {import("./Test.js").Test} Test
 * @typedef {{
 *   instanceOf?: ErrorConstructor
 *   message?: string | RegExp
 *   code?: string | number
 *   name?: string
 * }} ThrowsExpectation
 */

const setTimeoutNative = globalThis.setTimeout
const clearTimeoutNative = globalThis.clearTimeout

export const checkError = (err, expected) => {
  if (!expected) return true

  if (typeof expected === "string") return err.message === expected

  if (
    expected instanceof Error ||
    (expected.prototype && expected.prototype instanceof Error)
  ) {
    return err instanceof expected
  }

  if (expected instanceof RegExp) {
    const string =
      err.stack && err.stack.includes(err.message)
        ? err.stack
        : `${err.message}\n${err.stack}`
    expected.lastIndex = 0
    return expected.test(string)
  }

  for (const [key, val] of Object.entries(expected)) {
    if (key === "instanceOf") {
      if (!(err instanceof val)) return false
      continue
    }

    if (key in err === false) return false

    if (val instanceof RegExp) {
      if (!err[key].match(val)) return false
    } else if (!equals(err[key], val)) return false
  }

  return true
}

export const assertError = (actual, expected, message, stack) => {
  if (!checkError(actual, expected)) {
    throw new AssertionError(
      message ?? "Threw unexpected exception",
      { actual, expected },
      stack,
    )
  }

  return actual
}

export class ExecutionContext extends Assert {
  #count = 0
  #planned = 0
  #pending = 0
  #steps = []
  #stayings = []
  #teardowns = []
  #idRegistry = {}

  #cumulated
  #timeoutDelay
  #timeoutId
  #resolveTimeout

  spies = []
  stubs = []

  /**
   * @param {Test} test
   */
  constructor(test) {
    super()
    this.test = test
  }

  _call() {
    this.#count++
    this.timeout("reset")
  }

  _verify() {
    if (this.#timeoutId === true) {
      const details = {}
      if (this.#steps.length > 0) details.steps = [...this.#steps]
      if (this.stubs.length > 0) details.stubs = [...this.stubs]
      if (this.spies.length > 0) details.spies = [...this.spies]
      throw new AssertionError(
        `Test timed out: ${this.#timeoutDelay}ms`,
        details,
      )
    } else clearTimeoutNative(this.#timeoutId)

    for (const { actual, expected, error } of this.#stayings) {
      if (equals(actual, expected) === false) {
        error.actual = clone(actual)
        error.expected = expected
        throw error
      }
    }

    if (this.#pending > 0) {
      throw new AssertionError(
        "An async assertion didn't resolved before test end, you should use `await` before it",
      )
    }

    if (this.#planned === 0) {
      if (this.#count === 0) {
        throw new AssertionError("Test finished without running any assertions")
      }
    } else if (this.#planned !== this.#count) {
      const assertion = pluralize("assertion", this.#planned)
      throw new AssertionError(
        `Planned for ${this.#planned} ${assertion}, but got ${this.#count}`,
      )
    }
  }

  async _cleanup() {
    for (const fn of this.#teardowns) await fn()
    this.#teardowns.length = 0

    for (const spy of this.spies) spy.restore()
    this.spies.length = 0
    this.stubs.length = 0

    this.#stayings.length = 0
    this.#steps.length = 0
    clear(this.#idRegistry)
  }

  async check() {
    await this.sleep(0)
    if (this.test.trapError) {
      throw this.test.trapError
    }
  }

  // MARK: Assertions

  /**
   * Plan how many assertion there are in the test.
   * The test will fail if the actual assertion count doesn't match the number of planned assertions.
   *
   * @param {number} count
   */
  plan(count) {
    this.#planned = count
  }

  /**
   * Pass the test even without other assertions.
   */
  pass() {
    this._call()
  }

  /**
   * Fail the test.
   *
   * @param {string} message
   * @param {object} [details]
   */
  fail(message, details) {
    throw new AssertionError(message ?? "Test failed via fail()", details)
  }

  /**
   * Check that `actual` don't mutate.
   *
   * @template {any} T
   * @param {T} actual
   * @param {string} [message]
   */
  stay(actual, message) {
    this._call()
    const expected = clone(actual)
    const error = new AssertionError(message ?? "Value has mutated")
    this.#stayings.push({ actual, expected, error })
    return actual
  }

  /**
   * Assert that the function throws a native error. The error must satisfy all expectations.
   * Returns the error value if the assertion passes and throws otherwise.
   *
   * @param {Function | Promise} fn
   * @param {ThrowsExpectation | string | ErrorConstructor | RegExp} [expected]
   * @param {string} [message]
   * @returns {Error | Promise<Error>}
   */
  throws(fn, expected, message) {
    if (arguments.length === 2 && expected === undefined) {
      throw new TypeError(
        `If "expected" argument is defined it can't be of type undefined`,
      )
    }

    this._call()

    const { stack } = new Error()

    if (isPromiseLike(fn)) {
      return this.#deferThrows(fn, expected, message, stack)
    }

    try {
      const res = fn()
      if (isPromiseLike(res)) {
        return this.#deferThrows(res, expected, message, stack)
      }
    } catch (err) {
      return assertError(err, expected, message, stack)
    }

    throw new AssertionError(message ?? "Function must throw", { expected })
  }

  #deferThrows(fn, expected, message, stack) {
    this.#pending++
    return new Promise((resolve, reject) => {
      fn.then(
        () =>
          reject(
            new AssertionError(
              message ?? "Function must throw",
              { expected },
              stack,
            ),
          ),
        (error) => {
          try {
            resolve(assertError(error, expected, message, stack))
          } catch (err) {
            reject(err)
          }
        },
      ).finally(() => this.#pending--)
    })
  }

  notThrows(fn, message) {
    this._call()

    const { stack } = new Error()

    if (isPromiseLike(fn)) return this.#deferNotThrows(fn, message, stack)

    try {
      const res = fn()
      if (isPromiseLike(res)) {
        return this.#deferNotThrows(res, message, stack)
      }
    } catch (error) {
      throw new AssertionError(message, `Function must not throw`, { error })
    }
  }

  #deferNotThrows(fn, message, stack) {
    this.#pending++
    return new Promise((resolve, reject) => {
      fn.then(
        () => resolve(),
        (error) => {
          reject(
            new AssertionError(
              message ?? "Function must not throw",
              error,
              stack,
            ),
          )
        },
      ).finally(() => this.#pending--)
    })
  }

  // MARK: Stub/Spy

  /**
   * Records arguments, this value, exceptions and return values for all calls.
   *
   * @param {Function} [fn]
   * @param {any} [thisArg]
   */
  stub(fn, thisArg) {
    const stub = new Stub(fn, thisArg)
    stub.on("call", () => this.timeout("reset"))
    this.stubs.push(stub)
    return stub
  }

  /**
   * Replaces the `object` method with a stub.
   * The original method is restored after the test has ended.
   *
   * @overload
   * @param {object} object
   * @param {string} [key]
   * @param {Function} [fn]
   * @param {any} [thisArg]
   * @returns {Spy}
   */
  /**
   * Replaces a `globalThis` method with a stub.
   * The original method is restored after the test has ended.
   *
   * @overload
   * @param {string} key
   * @param {Function} [fn]
   * @param {any} [thisArg]
   * @returns {Spy}
   */
  /**
   * @param {object | string} object
   * @param {string | Function} [key]
   * @param {Function | any} [fn]
   * @param {any} [thisArg]
   * @returns {Spy}
   */
  spy(object, key, fn, thisArg) {
    const spy = new Spy(object, key, fn, thisArg)
    spy.on("call", () => this.timeout("reset"))
    this.spies.push(spy)
    return spy
  }

  // MARK: Timing

  /**
   * Set a timeout for the test, in milliseconds.
   * The test will fail if the timeout is exceeded.
   * The timeout is reset each time an assertion is made.
   *
   * @param {number | "reset"} ms
   */
  timeout(ms = 300, cumulated = 0) {
    this.#cumulated ??= cumulated
    this.#timeoutDelay = ms === "reset" ? this.#timeoutDelay : ms

    clearTimeoutNative(this.#timeoutId)
    this.#timeoutId = setTimeoutNative(() => {
      this.#timeoutId = true
      this.#resolveTimeout()
      this.#resolveTimeout = undefined
    }, this.#timeoutDelay + this.#cumulated)

    if (this.#resolveTimeout === undefined) {
      return new Promise((resolve) => {
        this.#resolveTimeout = resolve
      })
    }
  }

  /**
   * Register how far the test has executed before a timeout.
   *
   * @template {any} T
   * @param {T} val
   * @param {string} [message]
   */
  step(val, message) {
    this.timeout("reset")
    this.#steps.push(new Error(message))
    return val
  }

  /**
   * Returns a Promise that resolves with a delay in milliseconds.
   * Also resets the test timeout and add the delay.
   *
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    this.timeout(this.#timeoutDelay + ms)
    return new Promise((resolve) => setTimeoutNative(resolve, ms))
  }

  // MARK: Decay

  /**
   * Declare a function to be run after the test has ended.
   * You can register multiple functions.
   * They'll run in reverse order, so the last registered function is run first.
   * You can use asynchronous functions: only one will run at a time.
   *
   * @param {(() => Promise<void>) | (() => void)} fn
   */
  teardown(fn) {
    this.#teardowns.unshift(fn)
  }

  /**
   * Try to destroy `value` after the test has ended.
   *
   * @template T
   * @param {T} value
   * @param {KillOptions} [options]
   * @returns {T}
   */
  decay(value, options) {
    this.#teardowns.unshift(() => kill(value, options))
    return value
  }

  // MARK: DOM

  /**
   * Create a full sized and invisible HTML element to serve as a container for the test.
   * The element is automaticaly removed after the test end.
   *
   * @param {object} [options]
   * @param {boolean} [options.keep] Don't remove the element if true.
   * @param {boolean} [options.visible] Don't hide the element if true.
   * @param {boolean} [options.connect] Connect the element if true.
   * @param {KillOptions} [options.decay] Decay options.
   */
  dest(options) {
    const el = document.createElement("section")

    const title = this.test.getTitle()
    this.#idRegistry[title] ??= 0
    const cnt = this.#idRegistry[title]++

    el.id = `dest__${title.replaceAll(" › ", "_")}--${cnt}`

    el.dataset.title = title
    el.dataset.source = this.test.getURL({ devtools: true })

    el.style.position = "fixed"
    el.style.overflow = "auto"
    el.style.margin = "0"
    el.style.inset = "0"

    if (options?.keep !== true) {
      this.decay(el, options?.decay)

      if (options?.visible !== true) {
        el.style.opacity = "0.001"
        el.style.pointerEvents = "none"
      }
    }

    if (options?.connect) document.body.append(el)

    return el
  }

  chambers(options) {
    this.timeout("reset")
    return chambers(this, options)
  }
}
