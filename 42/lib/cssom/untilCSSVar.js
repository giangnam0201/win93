import { untilIdle } from "../timing/untilIdle.js"
import { getCSSVar } from "./cssVar.js"

export async function untilCSSVar(name, value, options) {
  let cnt = 0
  const maxRetry = options?.maxRetry ?? 100
  const string = `"${value}"`
  const el = options?.element ?? document.documentElement

  if (options?.signal.aborted) return false

  while (true) {
    const x = getCSSVar(el, name)
    // console.log(name, value, x)

    if (
      value //
        ? x === value || x === string
        : x
    ) {
      return true
    }

    await untilIdle()
    if (options?.signal.aborted) return false

    if (++cnt > maxRetry) {
      throw new Error(
        value
          ? `CSS variable "${name}" never set to ${value}`
          : `CSS variable "${name}" never set`,
      )
    }
  }
}
