import { system } from "../system.js"
import { resolveWithOptions } from "../../lib/syntax/path/resolvePath.js"
import { expandEnvVariables } from "../os/expandEnvVariables.js"

function safeDecodeURIComponent(str) {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

export function normalizeFilename(path, options) {
  const out = safeDecodeURIComponent(
    resolveWithOptions(
      options,
      options?.expandEnvVariables === false
        ? path
        : expandEnvVariables(path, system.env),
    ),
  )

  if (options?.preserveDir && path.endsWith("/") && out !== "/") {
    return out + "/"
  }

  return out
}

export function normalizeDirname(path, options) {
  const out = safeDecodeURIComponent(
    resolveWithOptions(
      options,
      options?.expandEnvVariables === false
        ? path
        : expandEnvVariables(path, system.env),
    ),
  )

  if (out === "/") return out
  return out + "/"
}

export function shortenFilename(path) {
  path = safeDecodeURIComponent(path)
  const { HOME } = system.env

  if (globalThis.location) {
    path = path.startsWith(location.origin)
      ? path.replace(location.origin, "")
      : path
  } else if (globalThis.process?.cwd) {
    const cwd = process.cwd()
    path = path.startsWith(cwd) //
      ? path.replace(cwd, ".")
      : path
  }

  path = path.startsWith(HOME) ? path.replace(HOME, "~") : path

  return path
}

export function displayFilename(path, options) {
  const limit = options?.limit ?? 10

  const out = shortenFilename(path)
  if (out.length > limit) {
    const half = out.length / 2
    const start = out.slice(0, half)
    const end = out.slice(-half)
    return {
      tag: "span.truncate-center",
      content: [
        { tag: "span", content: start },
        { tag: "span", content: end },
      ],
    }
  }
  return out
}
