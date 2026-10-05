import { capitalize } from "./capitalize.js"
import { isCamelCase } from "./isCamelCase.js"
import { isHyphenCase } from "./isHyphenCase.js"
import { isLodashCase } from "./isLodashCase.js"
import { isUpperCase } from "./isUpperCase.js"

/** @typedef {(str: string, ...args: any[]) => string} EachFn */

/**
 * @param {string} source
 * @param {EachFn} [each]
 */
export function parseWords(source, each = (x) => x) {
  let current = 0
  let isUppercase = false
  let buffer = ""

  const tokens = []

  function flush() {
    tokens.push(each(buffer, tokens.length))
    buffer = ""
  }

  while (current < source.length) {
    const code = source.codePointAt(current)

    if (code > 64 /* A */ && code < 91 /* Z */) {
      if (!isUppercase && buffer) flush()
      isUppercase = true
      buffer += String.fromCodePoint(code)
    } else if (
      (code > 47 /* 0 */ && code < 58) /* 9 */ ||
      (code > 96 /* a */ && code < 123) /* z */
    ) {
      isUppercase = false
      buffer += String.fromCodePoint(code)
    } else if (buffer) {
      flush()
    }

    current++
  }

  if (buffer) tokens.push(each(buffer, tokens.length))

  return tokens
}

/**
 * @param {EachFn} each
 * @param {string} joiner
 */
export function combineWords(each, joiner = "") {
  return (
    /** @param {string} str */
    (str) => parseWords(str, each).join(joiner)
  )
}

export const toCamelCase = (str, ignoreAcronyms) =>
  ignoreAcronyms || isUpperCase(str)
    ? combineWords((x, i) =>
        i > 0
          ? x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase()
          : x.toLowerCase(),
      )(str)
    : combineWords((x, i) =>
        isUpperCase(x)
          ? x
          : i > 0
            ? x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase()
            : x.toLowerCase(),
      )(str)

export const fromCamelCase = (str) =>
  str
    .replaceAll(/([\da-z])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][\da-z]+)/g, "$1 $2")

export const toKebabCase = combineWords((str) => str.toLowerCase(), "-")

export const toHeaderCase = combineWords(
  (str) => str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase(),
  "-",
)
export const toConstantCase = combineWords((str) => str.toUpperCase(), "_")

export const toSnakeCase = combineWords((x) => x.toLowerCase(), "_")

export const toNoCase = combineWords((x) => x.toLowerCase(), " ")

export const toLowerCase = (str) =>
  isCamelCase(str)
    ? fromCamelCase(str).toLowerCase()
    : isLodashCase(str)
      ? str.replaceAll("_", " ").toLowerCase()
      : isHyphenCase(str)
        ? str.replaceAll("-", " ").toLowerCase()
        : str.toLowerCase()

export const toUpperCase = (str) =>
  isCamelCase(str)
    ? fromCamelCase(str).toUpperCase()
    : isLodashCase(str)
      ? str.replaceAll("_", " ").toUpperCase()
      : isHyphenCase(str)
        ? str.replaceAll("-", " ").toUpperCase()
        : str.toUpperCase()

export const SMALL_WORDS =
  /\b(a|an|and|as|at|but|by|en|for|if|in|nor|of|on|or|per|the|to|v.?|vs.?|via)\b/gi

export function toTitleCase(str) {
  if (!str) return ""
  str = toCapitalCase(str)
  return str.replaceAll(SMALL_WORDS, (_, __, index) =>
    _ === str || index === 0 ? _ : _.toLowerCase(),
  )
}
export const toSentenceCase = (str) => {
  if (!str) return ""
  if (isCamelCase(str)) str = fromCamelCase(str).toLowerCase()
  else if (isLodashCase(str)) {
    str = str.replaceAll("_", " ").toLowerCase()
  } else if (isHyphenCase(str)) {
    str = str.replaceAll("-", " ").toLowerCase()
  } else if (isUpperCase(str)) str = str.toLowerCase()
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const WORDS_REGEX = /[A-Z]?[a-z]+\d*|[\dA-Za-z]+/g

export function toCapitalCase(str) {
  if (!str) return ""
  if (isCamelCase(str)) str = fromCamelCase(str)
  else if (isLodashCase(str)) str = str.replaceAll("_", " ")
  else if (isHyphenCase(str)) str = str.replaceAll("-", " ")
  return str.replaceAll(WORDS_REGEX, (_) =>
    isUpperCase(_) ? _ : capitalize(_),
  )
}

export const toPascalCase = (str, ignoreAcronyms) =>
  ignoreAcronyms || isUpperCase(str)
    ? combineWords(
        (x) => x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase(),
      )(str)
    : combineWords((x) =>
        isUpperCase(x)
          ? x
          : x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase(),
      )(str)

export { capitalize }
