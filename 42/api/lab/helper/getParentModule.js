import { parseErrorStack } from "../../../lib/type/error/parseErrorStack.js"

/**
 * @param {{ match?: RegExp }} [options]
 */
export function getParentModule(options) {
  const stackframes = parseErrorStack(new Error())
  stackframes.shift()

  let last = -1
  let firstInternalsPassed = false

  for (let i = 0, l = stackframes.length; i < l; i++) {
    const stackframe = stackframes[i]
    if (stackframe.filename.startsWith("/internal/")) {
      if (firstInternalsPassed) break
      else {
        firstInternalsPassed = true
        continue
      }
    }

    if (options?.match) {
      if (options.match.test(stackframe.filename)) return stackframes[i]
    } else {
      last = i
    }
  }

  return stackframes[last]
}
