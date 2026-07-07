import { normalizeError } from "../lib/type/error/normalizeError.js"

const inNode =
  typeof process !== "undefined" &&
  toString.call(process) === "[object process]"

const AsyncFunction = async function () {}.constructor

/**
 * @param {any} val
 * @returns {val is AsyncFunction}
 */
function isAsyncFunction(val) {
  return val instanceof AsyncFunction
}

/**
 * @template {Array} T
 * @param {T} arr
 * @param {any} item
 * @returns {T}
 */
function removeItem(arr, item) {
  const index = arr.indexOf(item)
  if (index !== -1) arr.splice(index, 1)
  return arr
}

export const queue = []

let isListening = false
const { stackTraceLimit } = Error

const traceErrorsInTrap = (message, object, originStack) => {
  console.group(`❗ trap: ${message}`)
  console.log(object)
  console.group("origin")
  console.log(originStack)
  console.groupEnd()
  console.groupEnd()
}

const handleError = (type, e, cb, originStack) => {
  const error = type === "report" ? e : normalizeError(e, originStack)

  // close most opened console group
  for (let i = 100; i; i--) console.groupEnd()

  const label =
    type === "rejection"
      ? "Unhandled Rejection"
      : type === "report"
        ? "Report"
        : "Uncaught Error"

  const { reports } = error

  try {
    const res = cb(error, { label, reports, e })

    if (res === false) {
      if (!e.filename?.startsWith("blob:")) e.preventDefault?.()
      e.stopPropagation?.()
      e.stopImmediatePropagation?.()
      return false
    }
  } catch (err) {
    // TODO: check async error in trap to prevent infinite recursions
    traceErrorsInTrap("Error in listener", err, originStack)
  }
}

const handler = (type, e, handlerStack) => {
  trap.caught++
  for (let i = queue.length - 1; i >= 0; i--) {
    const [cb, originStack] = handlerStack
      ? [queue[i][0], handlerStack]
      : queue[i]
    if (handleError(type, e, cb, originStack) === false) break
  }
}

const errorHandler = (e) => handler("error", e)
const rejectionHandler = (e) => handler("rejection", e)

export const forget = inNode
  ? () => {
      isListening = false
      Error.stackTraceLimit = stackTraceLimit
      process.off("uncaughtException", errorHandler)
      process.off("unhandledRejection", rejectionHandler)
    }
  : () => {
      isListening = false
      Error.stackTraceLimit = stackTraceLimit
      // observer?.disconnect()
      globalThis.removeEventListener("error", errorHandler)
      globalThis.removeEventListener("unhandledrejection", rejectionHandler)
    }

export const listen = inNode
  ? () => {
      isListening = true
      Error.stackTraceLimit = Infinity
      process.on("uncaughtException", errorHandler)
      process.on("unhandledRejection", rejectionHandler)
    }
  : () => {
      isListening = true
      Error.stackTraceLimit = Infinity
      // observer?.observe()
      globalThis.addEventListener("error", errorHandler)
      globalThis.addEventListener("unhandledrejection", rejectionHandler)
    }

/**
 * @param {(err: Error, { label, reports }?: { label: any; reports: any; }) => void | boolean} cb
 * @param {{ signal?: AbortSignal; }} [options]
 */
export function trap(cb, options) {
  if (cb === undefined) {
    cb = (err) => {
      console.groupCollapsed(err.message)
      console.log(err)
      console.groupCollapsed("details")
      console.dir(err)
      console.groupEnd()
      console.groupEnd()
      return false
    }
  } else if (isAsyncFunction(cb)) {
    throw new Error("trap callback should be synchronous")
  }

  const instance = [cb, new Error().stack]
  queue.push(instance)
  if (!isListening) listen()

  options?.signal?.addEventListener("abort", () => forgetTrap())

  function forgetTrap() {
    removeItem(queue, instance)
    if (queue.length === 0) forget()
  }

  return forgetTrap
}

trap.handle =
  (stack = new Error().stack) =>
  (e) =>
    handler("error", e, stack)

trap.queue = queue
trap.caught = 0
