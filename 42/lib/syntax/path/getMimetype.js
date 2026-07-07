import { extnames, basenames } from "../../constant/FILE_TYPES.js"
import { getBasename } from "./getBasename.js"
import { getExtname } from "./getExtname.js"

export function getMimetype(filename) {
  const ext = getExtname(filename)
  const infos =
    extnames[ext.toLowerCase()] ??
    basenames[getBasename(filename).toLowerCase()]
  return infos?.mimetype
}
