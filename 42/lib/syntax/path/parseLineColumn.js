const COLON = 58

export function parseLineColumn(source) {
  let pathname = ""
  let line = ""
  let column = ""

  let current = 0
  let isLine
  let isColumn
  let isValid = true

  while (current < source.length) {
    const code = source.codePointAt(current)

    if (code === COLON) {
      if (isLine) {
        isLine = false
        isColumn = true
      }

      isLine = true
      current++
      continue
    }

    if (isColumn) {
      if (code > 47 && code < 58) {
        column += source[current]
        current++
        continue
      } else {
        isValid = false
        break
      }
    }

    if (isLine) {
      if (code > 47 && code < 58) {
        line += source[current]
        current++
        continue
      } else {
        isValid = false
        break
      }
    }

    pathname += source[current]
    current++
  }

  return isValid
    ? {
        pathname,
        line: Number(line),
        column: Number(column),
      }
    : {
        pathname: source,
        line: 0,
        column: 0,
      }
}
