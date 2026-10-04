import * as transform from "./transform.js"
import { deburr } from "./deburr.js"
import { pluralize } from "./pluralize.js"
import { slugify } from "./slugify.js"
import { countLetters, countWords, countBytes } from "./count.js"
import { trim, trimStart, trimEnd } from "./trim.js"

export const manipulation = {
  ...transform,

  slugify,
  deburr,
  pluralize,

  countLetters,
  countWords,
  countBytes,

  trim,
  trimStart,
  trimEnd,

  removeSpaces: (str, replacement = "_") => str.replaceAll(/\s+/g, replacement),
  slice: (str, ...rest) => str.slice(...rest),
  split: (str, delimiter) => str.split(delimiter),
  repeat: (str, num) => str.repeat(num),
  replace: (str, ...rest) => str.replace(...rest),
  replaceAll: (str, ...rest) => str.replaceAll(...rest),
  padEnd: (str, length, padString) => str.padEnd(length, padString),
  padStart: (str, length, padString) => str.padStart(length, padString),
  endsWith: (str, search) => str.endsWith(search),
  startsWith: (str, search) => str.startsWith(search),
}
