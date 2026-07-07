/**
 * @param {string} str
 * @returns {[string, string?]}
 */
export function parseRegexLiteral(str) {
  str = str.trim()
  if (str.startsWith("/") === false) {
    throw new TypeError(`malformed regex literal: ${str}`)
  }

  const end = str.lastIndexOf("/")
  if (end === 0) throw new TypeError(`malformed regex literal: ${str}`)
  const pattern = str.slice(1, end)
  const flag = str.slice(end + 1)
  return flag ? [pattern, flag] : [pattern]
}

/**
 * @param {string | RegExp} reg
 * @returns {Record<string, any>[]}
 */
export function parseRegexPattern(reg) {
  // @ts-ignore
  const source = reg.source ?? reg

  const type = typeof source
  if (type !== "string") {
    throw new TypeError(`First argument must be a regexp or a string: ${type}`)
  }

  let current = 0

  function walk() {
    let char = source[current]

    if (char === "(") {
      char = source[++current]
      const items = []
      let construct = ""
      let quantifier = ""

      if (source[current] === "?") {
        construct = char + source[++current]
        char = source[++current]
      }

      while (char !== ")") {
        items.push(walk())
        char = source[current]
      }

      current++

      const match = source
        .slice(Math.max(0, current))
        .match(/^({\d+,?\d*}|[*+?]+)/)

      if (match) {
        quantifier = match[0]
        current += quantifier.length
      }

      return { type: "Group", items, construct, quantifier }
    }

    if (char === "|") {
      current++
      return { type: "Pipe", value: "|" }
    }

    let value = ""
    while (char && char !== "(" && char !== ")" && char !== "|") {
      value += char
      char = source[++current]
    }

    return { type: "Text", value }
  }

  const tokens = []
  while (current < source.length) tokens.push(walk())

  return tokens
}
