import { getDirname } from "./getDirname.js"
import { getStemname } from "./getStemname.js"
import { joinPath } from "./joinPath.js"

/**
 * @param {string} path
 * @param {string} extname
 */
export function replaceExtname(path, extname) {
  const dirname = getDirname(path)
  const stemname = getStemname(path)
  if (!extname.startsWith(".")) extname = `.${extname}`
  return joinPath(dirname, stemname + extname)
}
