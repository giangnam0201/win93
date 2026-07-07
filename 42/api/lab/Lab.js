import "../env/polyfill/globalThis.requestIdleCallback.js"
import { Test } from "./Test.js"
import { run } from "./helper/run.js"
import { getParentModule } from "./helper/getParentModule.js"
import { inTop } from "../env/realm/inTop.js"
import { trap } from "../trap.js"
// import { serialize } from "../ipc/serialize.js"
// import { ipc } from "../ipc.js"

/**
 * @typedef {import("./helper/report.js").ReportOptions} ReportOptions
 * @typedef {(test: Test) => void} onEachFn
 * @typedef {{ onEach?: onEachFn; report?: boolean } & ReportOptions} ExecOptions
 */

let idleId

export class Lab {
  tests = /** @type {Test[]} */ ([])
  onlies = /** @type {Test[]} */ ([])
  files = {}
  started = false
  running = false
  ms = 0
  stats = {
    ran: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    onlies: 0,
  }

  /**
   * Load test files, run and report results.
   *
   * @param {string[]} urls
   * @param {ExecOptions | onEachFn} [options]
   * @param {onEachFn} [onEach]
   */
  async exec(urls, options, onEach) {
    if (typeof options === "function") {
      onEach = options
      options = /** @type {ExecOptions} */ ({ onEach })
    }

    const { onEach: fn, report, ...reportOptions } = options ?? {}

    trap((err) => {
      for (const test of this.tests) {
        if (test.isRunning) {
          test.trapError = err
          test.ok = false
          test.resolve()
        }
      }
      return false
    })

    await this.load(urls)
    await this.run(fn ?? onEach)
    if (report !== false) await this.report(reportOptions)
  }

  /**
   * Load test files.
   *
   * @param {string[]} urls
   */
  async load(urls) {
    const { filename } = getParentModule()
    this.started = true
    await Promise.all(urls.map((url) => import(new URL(url, filename).href)))
  }

  /**
   * Run registered tests.
   *
   * @param {onEachFn} [onEach]
   */
  async run(onEach) {
    const { stackTraceLimit } = Error
    Error.stackTraceLimit = Infinity

    this.onEach = onEach
    this.started = true
    this.running = true

    const time = performance.now()
    await run(this, this.tests, onEach)
    this.ms = performance.now() - time

    this.tests.sort((a, b) => a.meta.filename.localeCompare(b.meta.filename))

    Error.stackTraceLimit = stackTraceLimit
  }

  /**
   * Report test results.
   *
   * @param {{ verbose?: number }} [options]
   */
  async report(options) {
    const { report } = await import("./helper/report.js")
    report(this, options)
  }

  /**
   * Register a test implementation.
   *
   * @param {string} title
   * @param {Function} handler
   * @param {import("./Test.js").Meta} meta
   */
  register(title, handler, meta) {
    cancelIdleCallback(idleId)

    const test = new Test(title, handler, meta)

    this.files[test.meta.filename] ??= {
      ok: undefined,
      ms: 0,
      stats: {
        ran: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        onlies: 0,
      },
    }

    test.file = this.files[test.meta.filename]

    if (this.running) {
      let parent
      let parentIndex

      for (let i = 0, l = this.tests.length; i < l; i++) {
        const current = this.tests[i]
        if (current.isRunning && test.meta.filename === current.meta.filename) {
          if (
            test.meta.line > current.meta.line &&
            current.meta.line > (parent?.meta.line ?? 0)
          ) {
            parentIndex = i
            parent = current
          }
        }
      }

      parent.execCtx._call()

      test.title = parent.title + " › " + test.title
      this.tests.splice(parentIndex + 1, 0, test)
      parent.nesteds.push(run(this, [test], this.onEach))
    } else {
      this.tests.push(test)
    }

    // try self executing
    idleId = requestIdleCallback(async () => {
      if (this.started) return
      await this.run()
      if (inTop) {
        this.report()
      } else {
        // console.log(888_888)
        // ipc.emit("42_LAB_TESTS", {
        //   stats: this.stats,
        //   tests: serialize(this.tests),
        // })
        // globalThis.postMessage({
        //   type: "42_LAB_TESTS",
        //   value: {
        //     stats: this.stats,
        //     tests: serialize(this.tests),
        //   },
        // })
      }
    })

    return test
  }
}
