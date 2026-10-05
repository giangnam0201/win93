/* eslint-disable complexity */
import { isInstanceOf } from "../any/isInstanceOf.js"
import { ErrnoError } from "./ErrnoError.js"

/**
 * @typedef {(Error | DOMException | ErrorEvent | PromiseRejectionEvent)} ErrorLike
 */

const ERROR_EVENT_INFOS = ["lineno", "colno", "filename", "type", "message"]

const UncaughtLength = "Uncaught ".length

function formatFilename(e) {
  if ("lineno" in e) {
    if ("colno" in e) return `${e.filename}:${e.lineno}:${e.colno}`
    return `${e.filename}:${e.lineno}`
  }

  return e.filename
}

/**
 * @param {ErrorLike} e
 * @param {string} [originStack]
 * @returns {Error}
 */
export function normalizeError(e, originStack = new Error().stack) {
  let error = isInstanceOf(e, Error)
    ? e
    : (e.reason ?? e.error ?? e.target?.error)

  if (!error) {
    let msg = String(e?.message ?? "")

    if (e.constructor?.name === "ErrorEvent") {
      const index = e.message.indexOf(":")
      const errorName =
        index === -1
          ? "Error"
          : e.message.startsWith("Uncaught ")
            ? e.message.slice(UncaughtLength, index)
            : e.message.slice(0, index)

      const message = e.message.slice(index + 1).trim()

      const ErrorConstructor =
        errorName in globalThis ? globalThis[errorName] : Error

      error = new ErrorConstructor(message)

      if (errorName !== error.name) error.name = errorName

      if (e.stack) error.stack = e.stack
      else if (e.filename) {
        if (error.stack.includes("    at")) {
          error.stack = `${errorName}: ${message}\n    at ${formatFilename(e)}`
        } else if (error.stack.match(/(^|@)\S+:\d+/)) {
          error.stack = `@${formatFilename(e)}`
        } else error.stack = originStack
      } else error.stack = originStack
    } else {
      if (!msg) {
        msg += "Unable to extract information from error"
      }

      error = new Error(msg)
      error.stack = e.stack ?? originStack
      if (e.name !== error.name) error.name = e.name
    }
  } else if (typeof error !== "object") {
    error = new Error(String(error))
    error.stack = originStack
  }

  if (!error.stack) error.stack = originStack

  if (e.constructor?.name === "ErrorEvent") {
    error.errorEvent = {}
    for (const key of ERROR_EVENT_INFOS) {
      if (key in e) error.errorEvent[key] = e[key]
    }
  }

  if (error.constructor?.name === "ErrnoError") {
    const errno = error
    error = new ErrnoError(errno.message, errno)
  }

  // Remove stack in error.message
  if (error.message.match(/\n\s*at /)) {
    const parts = error.message.split(/\n\s*at /)
    if (error.stack.includes(parts[1])) error.message = parts[0]
  }

  return error
}
