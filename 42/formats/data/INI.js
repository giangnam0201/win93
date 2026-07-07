import { JSON5 } from "./JSON5.js"
import { decodeINI } from "./INI/decodeINI.js"
import { encodeINI } from "./INI/encodeINI.js"

export const INI = {
  decode: (str, options) =>
    decodeINI(str, { parseValue: JSON5.parse, ...options }),

  encode: (str, options) =>
    encodeINI(str, { stringifyValue: JSON5.stringify, ...options }),
}
