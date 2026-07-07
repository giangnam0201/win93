import { getBasename } from "./getBasename.js"
import { getExtname } from "./getExtname.js"

/**
 * @param {string} path
 */
export function getStemname(path) {
  return getBasename(path, getExtname(path, { preserveCase: true }))
}
