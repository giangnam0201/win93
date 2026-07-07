import { inNode } from "../env/runtime/inNode.js"
import { ExecutionContext } from "./ExecutionContext.js"
import { parseErrorStack } from "../../lib/type/error/parseErrorStack.js"
import { truncate } from "../../lib/type/string/truncate.js"
import { minifyErrorStack } from "./helper/minifyErrorStack.js"
import { serializeError } from "../ipc/serialize.js"
import { deserializeError } from "../ipc/deserialize.js"
import { untilNextTask } from "../../lib/timing/untilNextTask.js"
import { Deferred } from "../../lib/type/promise/defer.js"

const TASK_ERROR = Symbol.for("TestRegister.TASK_ERROR")

/**
 * @typedef {Record<string | symbol, any>} TaskData
 *
 * @typedef {{
 *   only?: boolean
 *   skip?: boolean
 *   serial?: boolean
 *   filename?: string
 *   line?: number
 *   column?: number
 *   task?: TaskData
 * }} Meta
 */

export class Test extends Deferred {
  static TASK_ERROR = TASK_ERROR

  /**
   * @param {string} title
   * @param {Function} handler
   * @param {Meta} meta
   */
  constructor(title, handler, meta) {
    super()
    this.ok = undefined
    this.title = title
    this.error = /** @type {Error | undefined} */ (undefined)
    this.trapError = /** @type {Error | undefined} */ (undefined)
    this.ms = 0
    this.meta = meta
    this.handler = handler
    this.file = /** @type {object | undefined} */ (undefined)
    this.execCtx = /** @type {ExecutionContext | undefined} */ (undefined)
    this.isRunning = false
    this.nesteds = /** @type {Promise[]} */ ([])
  }

  getFileTitle() {
    return `${this.meta.filename
      .replace(/file:\/{2}/, "")
      .replace(inNode ? process.cwd() : `${location.origin}/`, "")
      .replace(/^tests?\//, "")
      .replace(/(.test)?.js$/, "")
      .split("/")
      .join(" › ")}`
  }

  /**
   * @param {{devtools?: boolean; verbose?: number; truncate?: object}} [options]
   */
  getTitle(options) {
    const sep = options?.devtools ? "%c" : ""
    const x = truncate(this.title, options?.truncate)
    if (options?.verbose !== undefined && options?.verbose < 4) {
      return `${sep}${x}${sep}`
    }

    return `${sep}${this.getFileTitle()} › ${sep}${x}`
  }

  /**
   * @param {{ devtools?: boolean }} [options]
   */
  getURL(options) {
    const { filename, line, column } = this.meta.task?.[TASK_ERROR]
      ? parseErrorStack(this.meta.task?.[TASK_ERROR]).at(-1)
      : this.meta

    return options?.devtools ? `${filename}:${line}:${column}` : filename
  }

  async run(parallelCtx) {
    if (parallelCtx) await untilNextTask()
    this.isRunning = true

    this.execCtx = new ExecutionContext(this)

    const time = performance.now()

    try {
      await Promise.race([
        this.execCtx.timeout(undefined, parallelCtx?.cumulated), //
        this.handler(this.execCtx),
      ])
      this.execCtx._verify()
      this.ok = true
    } catch (err) {
      this.error = minifyErrorStack(err)
      this.ok = false
    }

    if (this.nesteds.length > 0) await Promise.all(this.nesteds)

    await this.execCtx._cleanup()

    if (this.trapError) {
      this.error = this.trapError
      this.ok = false
    }

    this.ms = performance.now() - time

    if (parallelCtx) parallelCtx.cumulated += this.ms

    this.resolve()
    this.isRunning = false
  }

  toJSON() {
    return {
      ok: this.ok,
      title: this.title,
      error: serializeError(this.error),
      ms: this.ms,
      meta: this.meta,
    }
  }

  static deserialize(serializedTest) {
    const { title, meta } = serializedTest
    const test = new Test(title, undefined, meta)
    test.ok = serializedTest.ok
    test.ms = serializedTest.ms
    test.error = deserializeError(serializedTest.error)
    return test
  }
}
