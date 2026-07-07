import { Test } from "./lab/Test.js"
import { Lab } from "./lab/Lab.js"
import { getParentModule } from "./lab/helper/getParentModule.js"
import { noop } from "../lib/type/function/noop.js"

/**
 * @typedef {import("./lab/ExecutionContext.js").ExecutionContext} ExecutionContext
 * @typedef {import("./lab/Test.js").Meta} Meta
 * @typedef {import("./lab/Test.js").TaskData} TaskData
 * @typedef {(t: ExecutionContext) => void} HandlerFn
 * @typedef {{
 *   (title: string, handler: HandlerFn): Test;
 *   (handler: HandlerFn): Test;
 * }} TestFn
 * @typedef {typeof test} TestRegister
 */

export const PLACEHOLDER = Symbol.for("Assert.PLACEHOLDER")
const getParentModuleOptions = { match: /.test.js$/ }

let meta = {}

/** @type {TaskData | undefined} */
let currentTask

/**
 * @overload
 * @param {HandlerFn} handler
 * @returns {Test}
 */
/**
 * @overload
 * @param {string} title
 * @param {HandlerFn} handler
 * @returns {Test}
 */
/**
 * Declare a parallel test.
 *
 * @param {string | HandlerFn} title
 * @param {HandlerFn} [handler]
 * @returns {Test}
 */
export const test = (title, handler) => {
  if (typeof title === "function") {
    handler = title
    title = ""
  }

  if (currentTask) {
    const { only, skip, ...rest } = currentTask
    meta.task = rest
    meta.only = only
    meta.skip = skip
  }

  meta.only ??= false
  meta.skip ??= false
  meta.serial ??= false

  const { filename, line, column } = getParentModule(getParentModuleOptions)
  meta.filename = filename
  meta.line = line
  meta.column = column

  title ||= `${filename}:${line}`

  const test = lab.register(title, handler, meta)
  meta = {}
  return test
}

/**
 * @type {(...args: any[]) => void}
 */
test.todo = noop

/**
 * @type {(...args: any[]) => void}
 */
test.noop = noop

/**
 * Declare a parallel test. Only this test and others declared with `.only()` are run.
 *
 * @type {TestFn}
 */
test.only = (...args) => {
  meta = { only: true }
  return test(...args)
}

/**
 * Skip this test.
 *
 * @type {TestFn}
 */
test.skip = (...args) => {
  meta = { skip: true }
  return test(...args)
}

/**
 * Declare a serial test.
 *
 * @type {TestFn & {only: TestFn; skip: TestFn}}
 */
test.serial = (...args) => {
  meta = { serial: true }
  return test(...args)
}

/**
 * Declare a serial test. Only this test and others declared with `.only()` are run.
 *
 * @type {TestFn}
 */
test.serial.only = (...args) => {
  meta = { serial: true, only: true }
  return test(...args)
}

/**
 * Skip this test.
 *
 * @type {TestFn}
 */
test.serial.skip = (...args) => {
  meta = { serial: true, skip: true }
  return test(...args)
}

/**
 * Add line and column for the task test function.
 *
 * @template {TaskData} T
 * @param {T} taskData
 * @returns {T}
 */
export function task(taskData) {
  // @ts-ignore
  taskData[Test.TASK_ERROR] = new Error()
  return taskData
}

/**
 * Calls the specified callback function for each truthy tasks in an array.
 *
 * @param {TaskData[]} list
 * @param {(test: TestRegister, taskData: any, i?: number) => void} cb
 */
export function tasks(list, cb) {
  for (let i = 0, l = list.length; i < l; i++) {
    if (!list[i]) continue
    currentTask = list[i]
    cb(test, list[i], i)
  }

  currentTask = undefined
}

export const lab = new Lab()
