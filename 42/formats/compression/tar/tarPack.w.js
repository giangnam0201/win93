import { isHashmapLike } from "../../../lib/type/any/isHashmapLike.js"
import { flatten } from "../../../lib/type/object/flatten.js"
import { tarPackPipe } from "./tarPackPipe.js"

export async function pack(files, options) {
  const pack = tarPackPipe(options)

  if (Array.isArray(files)) {
    for (const item of files) {
      if (Array.isArray(item)) pack.add(...item)
      else pack.add(item)
    }
  } else {
    for (let [name, val] of flatten(files, "/")) {
      if (isHashmapLike(val)) {
        pack.add({ name, type: "directory" })
      } else {
        if (typeof val === "string") val = new Blob([val])
        pack.add({ name }, val)
      }
    }
  }

  return pack.stream()
}
