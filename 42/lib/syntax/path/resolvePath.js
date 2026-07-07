//! Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
// @src https://github.com/denoland/deno_std/tree/main/path

// import { cwd } from "../../../api/system.js"
import { assertPath } from "./assertPath.js"
import { normalizeString } from "./normalizePath.js"

const SEPARATOR = 47 /* / */

export function getCWD(options) {
  const cwd = options?.cwd ?? globalThis.sys42?.env?.PWD
  if (typeof cwd === "string") return cwd
  throw new TypeError(
    "Resolved a relative path without a current working directory (CWD)",
  )
}

export function resolveWithOptions(options, ...segments) {
  let resolvedPath = ""
  let resolvedAbsolute = false

  for (let i = segments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? segments[i] : getCWD(options)

    assertPath(path)

    if (path.length === 0) continue

    resolvedPath = `${path}/${resolvedPath}`
    resolvedAbsolute = path.charCodeAt(0) === SEPARATOR
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when cwd() fails)

  // Normalize the path
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute)

  return resolvedAbsolute
    ? resolvedPath.length > 0
      ? `/${resolvedPath}`
      : "/"
    : resolvedPath.length > 0
      ? resolvedPath
      : "."
}

/**
 * @param {string[]} segments
 */
export function resolvePath(...segments) {
  return resolveWithOptions({}, ...segments)
}
