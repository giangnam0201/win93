import { postfixPath } from "../../lib/syntax/path/postfixPath.js"
import { fileIndex } from "../fileIndex.js"
import { normalizeFilename } from "./normalizeFilename.js"

export function incrementFilename(path, options) {
  if (!options?.data && options?.normalize !== false) {
    path = normalizeFilename(path)
  }

  const unpostfixed = path
  let cnt = 1

  const before = options?.before ?? " ("
  const after = options?.after ?? ")"

  if (options?.data) {
    while (path in options.data) {
      path = postfixPath(unpostfixed, `${before}${++cnt}${after}`)
    }
  } else {
    while (fileIndex.has(path)) {
      path = postfixPath(unpostfixed, `${before}${++cnt}${after}`)
    }
  }

  return path
}
