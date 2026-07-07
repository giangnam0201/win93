/* eslint-disable complexity */
import { esc, escapeLog } from "../logUtils.js"
import { formatEntries } from "./formatEntries.js"
import { formatFilename } from "./formatFilename.js"
import { configure } from "../../configure.js"
import { truncate } from "../../../lib/type/string/truncate.js"
import { normalizeError } from "../../../lib/type/error/normalizeError.js"
import { parseErrorStack } from "../../../lib/type/error/parseErrorStack.js"
import { isInstanceOf } from "../../../lib/type/any/isInstanceOf.js"

const DEFAULTS = {
  skipMessage: undefined,
  markdown: undefined,
  compact: false,
  colors: {
    message: "red",
    errorName: "grey",
    function: "red.dim",
    punctuation: "grey",
  },
  entries: {
    preset: "javascript",
    newline: "\n",
    colors: { key: `red.dim`, colon: "grey.dim" },
  },
  filename: {
    colors: { name: "white.dim", line: "red" },
  },
}

/**
 * @typedef {Partial<DEFAULTS>} FormatErrorOptions
 */

/**
 * @param {import("../../../lib/type/error/normalizeError.js").ErrorLike} error
 * @param {FormatErrorOptions} [options]
 */
export function formatError(error, options) {
  const config = configure(DEFAULTS, options)
  const { colors } = config

  error = normalizeError(error)

  const stackFrames = parseErrorStack(error)

  let out = config.skipMessage
    ? ""
    : `{${colors.message} ${escapeLog(error.message)}\n}`

  const isAggregateError =
    error instanceof AggregateError ||
    ("errors" in error &&
      Array.isArray(error.errors) &&
      error.errors.every((x) => x instanceof Error))

  out += esc`\
{${colors.punctuation} ${
    stackFrames.length > 0 || isAggregateError ? "┌╴" : "╶╴"
  }}\
{${colors.errorName} ${
    error.name ||
    ("ErrorEvent" in globalThis && error instanceof ErrorEvent
      ? "ErrorEvent"
      : "?")
  }}`

  if (stackFrames.length > 0) {
    const fnNames = []

    for (const stack of stackFrames) {
      stack.function = stack.function?.replace(/^Object\./, "{}.") ?? ""
      stack.function = truncate(stack.function, {
        max: 30,
        ending: " …",
        firstBreak: " ",
      })
      fnNames.push(stack.function.length)
    }

    let maxFnName = Math.max(...fnNames)
    if (maxFnName) maxFnName += 1

    // prevent vscode to ignore link in terminal
    // if there is no space before lineLocation
    const dash = maxFnName ? "╴" : " "

    for (let i = 0; i < stackFrames.length; i++) {
      const element = stackFrames[i]
      let lineLocation = formatFilename(element, config.filename)

      if (options?.markdown) lineLocation = `[](${lineLocation})`

      const functionName = element.function
        ? escapeLog(element.function.padEnd(maxFnName))
        : " ".repeat(maxFnName)

      out += `{${colors.punctuation} ${
        i === stackFrames.length - 1 ? "\n└" : "\n├"
      }${dash}}`

      out += `{${colors.function} ${functionName}}${lineLocation}`
    }
  }

  // @ts-ignore
  let d = error.details

  if (!d && error.name !== "LoadError") {
    const keys = Object.keys(error)
    if (keys.length > 0) {
      d = {}
      for (const key of keys) {
        if (key === "name" || key === "message" || key === "stack") continue
        d[key] = error[key]
      }
    }
  }

  if (d?.errorEvent?.message === error.message) {
    d.errorEvent = { type: d.errorEvent.type }
  }

  if (isAggregateError) {
    const aggOptions = { ...options, skipMessage: false }
    out += `\n`
    for (const err of d.errors) {
      out += `{${colors.punctuation} ┆\n┆ }` + formatError(err, aggOptions)
    }

    delete d.errors
  }

  if (isInstanceOf(error.cause, Error)) {
    out += `\n`
    out +=
      `{${colors.punctuation} \nCaused by:\n}` +
      formatError(error.cause, { ...options, skipMessage: false })
  }

  const details = formatEntries(d, config.entries)

  if (details) {
    if (!config.compact) out += `\n`
    out += `\n${details}`
  } else if (!config.compact) out += `\n`

  return out
}
