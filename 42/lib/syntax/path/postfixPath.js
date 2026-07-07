import { getExtname } from "./getExtname.js"
import { getBasename } from "./getBasename.js"
import { getDirname } from "./getDirname.js"
import { joinPath } from "./joinPath.js"

/**
 * @param {string} path
 * @param {string} postfix
 */
export function postfixPath(path, postfix) {
  const type = typeof postfix
  if (type !== "string") {
    throw new TypeError(
      `The "postfix" argument must be a string. Received type ${type}`,
    )
  }

  const ext = getExtname(path, { preserveCase: true })
  const base = getBasename(path, ext)
  return joinPath(getDirname(path), base + postfix + ext)
}
