/**
 * @param {string} source
 */
export function parseCommand(source) {
  const tokens = []
  let buffer = ""
  let current = 0

  const flush = () => {
    if (buffer) {
      tokens.push(buffer)
      buffer = ""
    }
  }

  let inSingleQuote = false
  let inDoubleQuote = false
  let lastCharEscaped = false

  while (current < source.length) {
    const char = source[current]

    if (lastCharEscaped) {
      lastCharEscaped = false
      buffer += char
      current++
      continue
    }

    if (char === "\\") {
      lastCharEscaped = true
      current++
      continue
    }

    if (!inDoubleQuote && !inSingleQuote && char === " ") {
      flush()
      current++
      continue
    }

    if (!inDoubleQuote && char === "'") {
      inSingleQuote = !inSingleQuote
    }

    if (!inSingleQuote && char === '"') {
      inDoubleQuote = !inDoubleQuote
    }

    buffer += char
    current++
  }

  flush()

  return tokens
}
