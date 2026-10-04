import { isEmptyObject } from "./isEmptyObject.js"
import { isLength } from "./isLength.js"

export const isEmpty = (val) => {
  const type = typeof val
  return (
    type !== "boolean" &&
    (Boolean(val) === false ||
      (type === "object"
        ? isLength(val.length)
          ? val.length === 0
          : isLength(val.size)
            ? val.size === 0
            : isLength(val.byteLength)
              ? val.byteLength === 0
              : isEmptyObject(val)
        : false))
  )
}
