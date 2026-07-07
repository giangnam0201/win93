import { isHashmapLike } from "./isHashmapLike.js"
import { mergeWalk } from "../object/merge.js"

export function unproxy(val) {
  if (isHashmapLike(val)) return mergeWalk({}, val)
  if (Array.isArray(val)) return mergeWalk([], val)
  return val
}
