/* eslint-disable max-params */
//! Copyright (c) 2017 Rich Harris. Lil License.
// @src https://github.com/Rich-Harris/golden-fleece

const whitespace = /\s/
const validIdentifierCharacters = /[$A-Z_a-z][\w$]*/
const entirelyValidIdentifier = new RegExp(
  `^${validIdentifierCharacters.source}$`,
)
const number =
  /^NaN|(?:[+-]?(?:(?:Infinity)|(?:0[Xx][\dA-Fa-f]+)|(?:0[Bb][01]+)|(?:0[Oo][0-7]+)|(?:(?:(?:[1-9]\d*|0)?\.\d+|(?:[1-9]\d*|0)\.\d*|(?:[1-9]\d*|0))(?:[Ee|][+|-]?\d+)?)))/

const SINGLE_QUOTE = "'"
const DOUBLE_QUOTE = '"'

function noop() {}

function rangeContains(range, index) {
  return range.start <= index && index < range.end
}

function getLocator(source, options) {
  const offsetLine = options?.offsetLine ?? 0
  const offsetColumn = options?.offsetColumn ?? 0
  const originalLines = source.split("\n")
  let start = 0
  const lineRanges = originalLines.map((line, i) => {
    const end = start + line.length + 1
    const range = { start, end, line: i }
    start = end
    return range
  })
  let i = 0

  function getLocation(range, index) {
    return {
      line: offsetLine + range.line,
      column: offsetColumn + index - range.start,
      character: index,
    }
  }
  function locate(search, startIndex) {
    if (typeof search === "string") {
      search = source.indexOf(search, startIndex || 0)
    }
    let range = lineRanges[i]
    const d = search >= range.end ? 1 : -1
    while (range) {
      if (rangeContains(range, search)) return getLocation(range, search)
      i += d
      range = lineRanges[i]
    }
  }

  return locate
}

function locate(source, search, options) {
  if (typeof options === "number") {
    throw new TypeError(
      "locate takes a { startIndex, offsetLine, offsetColumn } object as the third argument",
    )
  }
  return getLocator(source, options)(search, options && options.startIndex)
}

function parse(str, opts) {
  const parser = new Parser(str, opts)
  return parser.value
}

class ParseError extends Error {
  constructor(message, pos, loc) {
    super(message)
    this.pos = pos
    this.loc = loc
  }
}

// https://mathiasbynens.be/notes/javascript-escapes
const escapeable = {
  b: "\b",
  n: "\n",
  f: "\f",
  r: "\r",
  t: "\t",
  v: "\v",
  0: "\0",
}

const hex = /^[\dA-Fa-f]+$/

class Parser {
  constructor(str, options) {
    this.str = str
    this.index = 0
    this.onComment = options?.onComment ?? noop
    this.onValue = options?.onValue ?? noop
    this.value = this.readValue()
    this.allowWhitespaceOrComment()
    if (this.index < this.str.length) {
      throw new Error("Unexpected character '" + this.peek() + "'")
    }
  }
  allowWhitespaceOrComment() {
    while (
      this.index < this.str.length &&
      whitespace.test(this.str[this.index])
    ) {
      this.index++
    }
    const start = this.index
    if (this.eat("/")) {
      if (this.eat("/")) {
        // line comment
        const text = this.readUntil(/\r\n|\n|\r/)
        this.onComment({
          start,
          end: this.index,
          type: "Comment",
          text,
          block: false,
        })
        this.eat("\n")
      } else if (this.eat("*")) {
        // block comment
        const text = this.readUntil(/\*\//)
        this.onComment({
          start,
          end: this.index,
          type: "Comment",
          text,
          block: true,
        })
        this.eat("*/", true)
      }
    } else {
      return
    }
    this.allowWhitespaceOrComment()
  }
  error(message, index) {
    if (index === void 0) {
      index = this.index
    }
    const loc = locate(this.str, index, { offsetLine: 1 })
    throw new ParseError(message, index, loc)
  }
  eat(str, required) {
    if (this.str.slice(this.index, this.index + str.length) === str) {
      this.index += str.length
      return str
    }
    if (required) {
      this.error(
        "Expected '" + str + "' instead of '" + this.str[this.index] + "'",
      )
    }
    return null
  }
  peek() {
    return this.str[this.index]
  }
  read(pattern) {
    const match = pattern.exec(this.str.slice(this.index))
    if (!match || match.index !== 0) return null
    this.index += match[0].length
    return match[0]
  }
  readUntil(pattern) {
    if (this.index >= this.str.length) this.error("Unexpected end of input")
    const start = this.index
    const match = pattern.exec(this.str.slice(start))
    if (match) {
      const start = this.index
      this.index = start + match.index
      return this.str.slice(start, this.index)
    }
    this.index = this.str.length
    return this.str.slice(start)
  }
  readArray() {
    const start = this.index
    if (!this.eat("[")) return null
    const array = {
      start,
      end: null,
      type: "ArrayExpression",
      elements: [],
    }
    this.allowWhitespaceOrComment()
    while (this.peek() !== "]") {
      array.elements.push(this.readValue())
      this.allowWhitespaceOrComment()
      if (!this.eat(",")) break
      this.allowWhitespaceOrComment()
    }
    if (!this.eat("]")) {
      this.error("Expected ']' instead of '" + this.str[this.index] + "'")
    }
    array.end = this.index
    return array
  }
  readBoolean() {
    const start = this.index
    const raw = this.read(/^(true|false)/)
    if (raw) {
      return {
        start,
        end: this.index,
        type: "Literal",
        raw,
        value: raw === "true",
      }
    }
  }
  readNull() {
    const start = this.index
    if (this.eat("null")) {
      return {
        start,
        end: this.index,
        type: "Literal",
        raw: "null",
        value: null,
      }
    }
  }
  readLiteral() {
    return (
      this.readBoolean() ||
      this.readNumber() ||
      this.readString() ||
      this.readNull()
    )
  }
  readNumber() {
    const start = this.index
    const raw = this.read(number)
    if (raw) {
      const sign = raw[0]
      let value = Number(sign === "-" || sign === "+" ? raw.slice(1) : raw)
      if (sign === "-") value = -value
      return {
        start,
        end: this.index,
        type: "Literal",
        raw,
        value,
      }
    }
  }
  readObject() {
    const start = this.index
    if (!this.eat("{")) return
    const object = {
      start,
      end: null,
      type: "ObjectExpression",
      properties: [],
    }
    this.allowWhitespaceOrComment()
    while (this.peek() !== "}") {
      object.properties.push(this.readProperty())
      this.allowWhitespaceOrComment()
      if (!this.eat(",")) break
      this.allowWhitespaceOrComment()
    }
    this.eat("}", true)
    object.end = this.index
    return object
  }
  readProperty() {
    this.allowWhitespaceOrComment()
    const property = {
      start: this.index,
      end: null,
      type: "Property",
      key: this.readPropertyKey(),
      value: this.readValue(),
    }
    property.end = this.index
    return property
  }
  readIdentifier() {
    const start = this.index
    const name = this.read(validIdentifierCharacters)
    if (name) {
      return {
        start,
        end: this.index,
        type: "Identifier",
        name,
      }
    }
  }
  readPropertyKey() {
    const key = this.readString() || this.readIdentifier()
    if (!key) this.error("Bad identifier as unquoted key")
    if (key.type === "Literal") {
      key.name = String(key.value)
    }
    this.allowWhitespaceOrComment()
    this.eat(":", true)
    return key
  }
  readString() {
    const start = this.index
    // const quote = this.read(/^['"]/);
    const quote = this.eat(SINGLE_QUOTE) || this.eat(DOUBLE_QUOTE)
    if (!quote) return
    let escaped = false
    let value = ""
    while (this.index < this.str.length) {
      const char = this.str[this.index++]
      if (escaped) {
        escaped = false
        // line continuations
        if (char === "\n") continue
        if (char === "\r") {
          if (this.str[this.index] === "\n") this.index += 1
          continue
        }
        if (char === "x" || char === "u") {
          const start2 = this.index
          this.index += char === "x" ? 2 : 4
          const end = this.index
          const code = this.str.slice(start2, end)
          if (!hex.test(code)) {
            this.error(
              "Invalid " +
                (char === "x" ? "hexadecimal" : "Unicode") +
                " escape sequence",
              start2,
            )
          }
          value += String.fromCharCode(Number.parseInt(code, 16))
        } else {
          value += escapeable[char] || char
        }
      } else if (char === "\\") {
        escaped = true
      } else if (char === quote) {
        const end = this.index
        return {
          start,
          end,
          type: "Literal",
          raw: this.str.slice(start, end),
          value,
        }
      } else {
        if (char === "\n") this.error("Bad string", this.index - 1)
        value += char
      }
    }
    this.error("Unexpected end of input")
  }
  readValue() {
    this.allowWhitespaceOrComment()
    const value = this.readArray() || this.readObject() || this.readLiteral()
    if (value) {
      this.onValue(value)
      return value
    }
    this.error("Unexpected EOF")
  }
}

function evaluate(str) {
  const ast = parse(str)
  return getValue(ast)
}

function getValue(node) {
  if (node.type === "Literal") {
    return node.value
  }
  if (node.type === "ArrayExpression") {
    return node.elements.map(getValue)
  }
  if (node.type === "ObjectExpression") {
    const obj = {}
    node.properties.forEach((prop) => {
      obj[prop.key.name] = getValue(prop.value)
    })
    return obj
  }
}

function stringify(value, options) {
  if (value === undefined) return
  const quote = options?.singleQuotes ? "'" : '"'
  const indentation = options?.spaces
    ? " ".repeat(options?.spaces)
    : options?.tabs
      ? "\t"
      : "  "
  return stringifyValue(value, quote, "\n", indentation, true)
}

// https://github.com/json5/json5/blob/65bcc556eb629984b33bb2163cbc10fba4597300/src/stringify.js#L110
const stringEscapeable = {
  "'": "'",
  '"': '"',
  "\\": "\\",
  "\b": "b",
  "\f": "f",
  "\n": "n",
  "\r": "r",
  "\t": "t",
  "\v": "v",
  "\0": "0",
  "\u2028": "u2028",
  "\u2029": "u2029",
}

const escapeableRegex = /[\b\0\t\n\v\f\r"'\\\u2028\u2029]/g

function stringifyString(str, quote) {
  const otherQuote = quote === '"' ? "'" : '"'
  return (
    quote +
    str.replaceAll(escapeableRegex, (char) =>
      char === otherQuote ? char : "\\" + stringEscapeable[char],
    ) +
    quote
  )
}

function stringifyProperty(
  key,
  value,
  quote,
  indentation,
  indentString,
  newlines,
) {
  return (
    (entirelyValidIdentifier.test(key) ? key : stringifyString(key, quote)) +
    ": " +
    stringifyValue(value, quote, indentation, indentString, newlines)
  )
}

function stringifyValue(value, quote, indentation, indentString, newlines) {
  const type = typeof value
  if (type === "string") {
    return stringifyString(value, quote)
  }
  if (type === "number" || type === "boolean" || value === null) {
    return String(value)
  }
  if (Array.isArray(value)) {
    const elements = []
    for (let element of value) {
      element ??= null
      elements.push(
        stringifyValue(
          element,
          quote,
          indentation + indentString,
          indentString,
          true,
        ),
      )
    }
    if (newlines) {
      if (elements.length === 0) return "[]"
      return (
        "[" +
        (indentation + indentString) +
        elements.join("," + (indentation + indentString)) +
        (indentation + "]")
      )
    }
    return "[ " + elements.join(", ") + " ]"
  }
  if (type === "object") {
    const properties = []
    for (const key of Object.keys(value)) {
      const val = value[key]
      if (val === undefined) continue
      properties.push(
        stringifyProperty(
          key,
          val,
          quote,
          indentation + indentString,
          indentString,
          newlines,
        ),
      )
    }

    if (newlines) {
      if (properties.length === 0) return "{}"
      return (
        "{" +
        (indentation + indentString) +
        properties.join("," + (indentation + indentString)) +
        (indentation + "}")
      )
    }
    return "{ " + properties.join(", ") + " }"
  }
  throw new Error("Cannot stringify " + type)
}

function patch(str, value, options) {
  const indentString = options?.guessIndent ? guessIndentString(str) : "  "

  let root
  let quote = DOUBLE_QUOTE

  if (options?.guessQuote) {
    const counts = {}
    counts[SINGLE_QUOTE] = 0
    counts[DOUBLE_QUOTE] = 0
    root = parse(str, {
      onValue(node) {
        if (node.type === "Literal" && typeof node.value === "string") {
          counts[node.raw[0]] += 1
        }
      },
    })

    quote =
      counts[SINGLE_QUOTE] > counts[DOUBLE_QUOTE] ? SINGLE_QUOTE : DOUBLE_QUOTE
  } else {
    root = parse(str)
  }

  const newlines = options?.guessNewlines
    ? /\n/.test(str.slice(root.start, root.end)) ||
      (root.type === "ArrayExpression" && root.elements.length === 0) ||
      (root.type === "ObjectExpression" && root.properties.length === 0)
    : true

  return (
    str.slice(0, root.start) +
    patchValue(root, value, str, "\n", indentString, quote, newlines) +
    str.slice(root.end)
  )
}

function patchValue(
  node,
  value,
  str,
  indentation,
  indentString,
  quote,
  newlines,
) {
  const type = typeof value
  if (type === "string") {
    if (node.type === "Literal" && typeof node.value === "string") {
      // preserve quote style
      return stringifyString(value, node.raw[0])
    }
    return stringifyString(value, quote)
  }
  if (type === "number") {
    return patchNumber(node.raw, value)
  }
  if (type === "boolean" || value === null) {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (node.type === "ArrayExpression") {
      return patchArray(
        node,
        value,
        str,
        indentation,
        indentString,
        quote,
        newlines,
      )
    }
    return stringifyValue(value, quote, indentation, indentString, newlines)
  }
  if (type === "object") {
    if (node.type === "ObjectExpression") {
      return patchObject(
        node,
        value,
        str,
        indentation,
        indentString,
        quote,
        newlines,
      )
    }
    return stringifyValue(value, quote, indentation, indentString, newlines)
  }
  throw new Error("Cannot stringify " + type + "s")
}

function patchNumber(raw, value) {
  const matchRadix = /^([+-])?0([BOXbox])/.exec(raw)
  if (matchRadix && value % 1 === 0) {
    return (
      (matchRadix[1] === "+" && value >= 0 ? "+" : value < 0 ? "-" : "") +
      "0" +
      matchRadix[2] +
      Math.abs(value).toString(
        matchRadix[2] === "b" || matchRadix[2] === "B"
          ? 2
          : matchRadix[2] === "o" || matchRadix[2] === "O"
            ? 8
            : matchRadix[2] === "x" || matchRadix[2] === "X"
              ? 16
              : null,
      )
    )
  }
  const match = /^([+-])?(\.)?/.exec(raw)
  if (match && match[0].length > 0) {
    return (
      (match[1] === "+" && value >= 0 ? "+" : value < 0 ? "-" : "") +
      (match[2]
        ? String(Math.abs(value)).replace(/^0/, "")
        : String(Math.abs(value)))
    )
  }
  return String(value)
}

function patchArray(
  node,
  value,
  str,
  indentation,
  indentString,
  quote,
  _newlines,
) {
  if (value.length === 0) {
    return node.elements.length === 0 ? str.slice(node.start, node.end) : "[]"
  }
  const precedingWhitespace = getPrecedingWhitespace(str, node.start)
  const empty = precedingWhitespace === ""
  const newline = empty || /\n/.test(precedingWhitespace)
  if (node.elements.length === 0) {
    return stringifyValue(value, quote, indentation, indentString, newline)
  }
  let i = 0
  let c = node.start
  let patched = ""
  const newlinesInsideValue =
    str.slice(node.start, node.end).split("\n").length > 1
  for (; i < value.length; i += 1) {
    const element = node.elements[i]
    if (element) {
      patched +=
        str.slice(c, element.start) +
        patchValue(
          element,
          value[i],
          str,
          indentation,
          indentString,
          quote,
          newlinesInsideValue,
        )
      c = element.end
    } else if (newlinesInsideValue) {
      // append new element
      patched +=
        "," +
        (indentation + indentString) +
        stringifyValue(value[i], quote, indentation, indentString, true)
    } else {
      patched +=
        ", " + stringifyValue(value[i], quote, indentation, indentString, false)
    }
  }
  if (i < node.elements.length) {
    c = node.elements[node.elements.length - 1].end
  }
  patched += str.slice(c, node.end)
  return patched
}

function patchObject(
  node,
  value,
  str,
  indentation,
  indentString,
  quote,
  _newlines,
) {
  const keys = Object.keys(value)
  if (keys.length === 0) {
    return node.properties.length === 0 ? str.slice(node.start, node.end) : "{}"
  }
  const existingProperties = {}
  node.properties.forEach((prop) => {
    existingProperties[prop.key.name] = prop
  })
  const precedingWhitespace = getPrecedingWhitespace(str, node.start)
  const empty = precedingWhitespace === ""
  const newline = empty || /\n/.test(precedingWhitespace)
  if (node.properties.length === 0) {
    return stringifyValue(value, quote, indentation, indentString, newline)
  }
  let i = 0
  let c = node.start
  let patched = ""
  const newlinesInsideValue = /\n/.test(str.slice(node.start, node.end))
  let started = false
  const intro = str.slice(node.start, node.properties[0].start)
  for (; i < node.properties.length; i += 1) {
    const property = node.properties[i]
    const propertyValue = value[property.key.name]
    indentation = getIndentation(str, property.start)
    if (propertyValue !== undefined) {
      patched += started
        ? str.slice(c, property.value.start)
        : intro + str.slice(property.key.start, property.value.start)
      patched += patchValue(
        property.value,
        propertyValue,
        str,
        indentation,
        indentString,
        quote,
        newlinesInsideValue,
      )
      started = true
    }
    c = property.end
  }
  // append new properties
  keys.forEach((key) => {
    if (key in existingProperties) return
    const propertyValue = value[key]
    patched +=
      (started ? "," + (newlinesInsideValue ? indentation : " ") : intro) +
      stringifyProperty(
        key,
        propertyValue,
        quote,
        indentation,
        indentString,
        newlinesInsideValue,
      )
    started = true
  })
  patched += str.slice(c, node.end)
  return patched
}

function getIndentation(str, i) {
  while (i > 0 && !whitespace.test(str[i - 1])) i -= 1
  const end = i
  while (i > 0 && whitespace.test(str[i - 1])) i -= 1
  return str.slice(i, end)
}

function getPrecedingWhitespace(str, i) {
  const end = i
  while (i > 0 && whitespace.test(str[i])) i -= 1
  return str.slice(i, end)
}

function guessIndentString(str) {
  let tabs = 0
  let spaces = 0
  let minSpaces = 8

  for (const line of str.split("\n")) {
    const match = /^(?: +|\t+)/.exec(line)
    if (!match) continue
    const whitespace = match[0]
    if (whitespace.length === line.length) continue
    if (whitespace[0] === "\t") {
      tabs += 1
    } else {
      spaces += 1
      if (whitespace.length > 1 && whitespace.length < minSpaces) {
        minSpaces = whitespace.length
      }
    }
  }

  if (spaces > tabs) {
    let result = ""
    while (minSpaces--) result += " "
    return result
  }

  return "\t"
}

export const JSON5 = {
  ast: parse,
  parse: evaluate,
  patch,
  stringify,
}
