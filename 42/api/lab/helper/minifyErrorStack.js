import { parseErrorStack } from "../../../lib/type/error/parseErrorStack.js"
import { inFirefox } from "../../env/browser/inFirefox.js"

const DEFAULT_DESCRIPTOR = { configurable: true, writable: true }

/**
 * @template {Error} T
 * @param {T} error
 * @returns {T}
 */
export function minifyErrorStack(error) {
  const { configurable, writable } =
    Object.getOwnPropertyDescriptor(error, "stack") ?? DEFAULT_DESCRIPTOR

  if (!configurable && !writable) return error

  let stack = inFirefox ? "" : `${error.name}: ${error.message}\n`

  for (const stackframe of parseErrorStack(error)) {
    if (stackframe.filename.endsWith("AssertionError.js")) continue
    if (stackframe.filename.endsWith("Test.js")) break
    stack += stackframe.source + "\n"
  }

  if (writable) {
    error.stack = stack.trim()
  } else {
    Object.defineProperty(error, "stack", { value: stack.trim() })
  }

  return error
}
