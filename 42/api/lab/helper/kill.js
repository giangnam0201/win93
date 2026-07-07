/**
 * @typedef {{
 *   reportMethod?: (key: string, method: any) => void
 *   reportError?: (err: Error) => void
 * }} KillOptions
 */

const killKeys = [
  "destroy",
  "cancel",
  "abort",
  "remove",
  "close",
  "clear",
  "resolve",
  "unregister",
  "terminate",
  "forget",
  "dispose",
]

/**
 * Try to destroy `value`.
 * Returns a Promise that resolves to true if the destroying seems to have worked.
 *
 * @param {any} value
 * @param {KillOptions} [options]
 */
export async function kill(value, options) {
  if (!value) return true

  try {
    if (typeof value === "string") {
      if (value.startsWith("blob:")) {
        URL.revokeObjectURL(value)
        return true
      }

      return false
    }

    if (Array.isArray(value)) {
      value.length = 0
      return true
    }

    for (const key of killKeys) {
      if (typeof value[key] === "function") {
        await value[key]()
        options?.reportMethod?.(key, value[key])
        return true
      }
    }
  } catch (err) {
    options?.reportError?.(err)
  }

  return false
}
