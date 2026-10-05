/* eslint-disable complexity */

// @read https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence

/**
 * @typedef {string | MathTokenList[]} MathToken
 * @typedef {MathToken[]} MathTokenList
 */

const { PI, E } = Math

const CODE_ZERO = 48
const CODE_NINE = 57

const constants = {
  pi: String(PI),
  e: String(E),
}
constants["π"] = constants.pi

for (const [key, val] of Object.entries(constants)) {
  constants[`-${key}`] = `-${val}`
}

export const operators = {
  "**": (a, b) => a ** b,

  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "%": (a, b) => a % b,
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,

  "<<": (a, b) => a << b,
  ">>": (a, b) => a >> b,
  ">>>": (a, b) => a >>> b,

  "&": (a, b) => a & b,
  "^": (a, b) => a ^ b,
  "|": (a, b) => a | b,
  "&&": (a, b) => a && b,
  "||": (a, b) => a || b,
  "??": (a, b) => a ?? b,
}

export const prefixOperators = {
  "!": (a) => !a,
  "~": (a) => ~a,
  "-": (a) => -a,
}

const precedence = Object.keys(operators)
precedence.shift()

/**
 * @param {string} source
 * @returns {MathTokenList}
 */
export function parseMathFormula(source) {
  const tokens = []
  let buffer = ""
  let current = 0

  let context = tokens
  const nesteds = []

  const flush = () => {
    if (buffer) {
      const alias = constants[buffer.toLowerCase()]
      context.push(alias ?? buffer)

      // if (!Array.isArray(context.at(-3))) {
      const prevOp = context.at(-2)
      if (prevOp === "**" || prevOp === "*" || prevOp === "/") {
        context.push(context.splice(-3, 3))
      }
      // }

      buffer = ""
    }
  }

  while (current < source.length) {
    const char = source[current]

    if (char === " " || char === "_") {
      current++
      continue
    }

    if (char === "(") {
      const prevCode = buffer.codePointAt(buffer.length - 1)
      flush()

      if (
        (prevCode >= CODE_ZERO && prevCode <= CODE_NINE) ||
        Array.isArray(context[context.length - 1])
      ) {
        context.push("*")
      }

      context = []
      nesteds.push(context)

      current++
      continue
    }

    if (char === ")") {
      flush()
      if (nesteds.length === 0) {
        throw new SyntaxError("Unexpected token ')'", {
          cause: { column: current },
        })
      }

      const last = nesteds.pop()
      context = nesteds.at(-1) ?? tokens
      context.push(last)
      current++
      continue
    }

    if (char === "+") {
      if (buffer[buffer.length - 1] === "e") {
        buffer += char
        current++
        continue
      }

      const prevToken = context.at(-1)
      if (buffer.length === 0 && prevToken in operators) {
        if (prevToken === "+") {
          throw new SyntaxError(
            "Invalid left-hand side expression in postfix operation",
            { cause: { column: current } },
          )
        }

        // Ignore UnaryPlus
        current++
        continue
      }

      flush()
      context.push(char)
      current++
      continue
    }

    if (char === "-") {
      if (buffer.at(-1) === "e") {
        buffer += char
        current++
        continue
      }

      if (buffer.length === 0 && !Array.isArray(context.at(-1))) {
        if (context.at(-1) === "-" && source[current - 1] !== " ") {
          throw new SyntaxError(
            "Invalid left-hand side expression in postfix operation",
            { cause: { column: current } },
          )
        }

        flush()
        context.push("-unary")
        current++
        continue
      }

      flush()
      context.push(char)
      current++
      continue
    }

    if (char === ">" && source[current + 1] === ">") {
      flush()
      if (source[current + 2] === ">") {
        current += 3
        context.push(">>>")
      } else {
        current += 2
        context.push(">>")
      }

      continue
    }

    if (char in operators) {
      const nextChar = source[current + 1]
      if (char === nextChar) {
        current += 2
        flush()
        context.push(char + nextChar)
        continue
      }

      if (buffer.length === 0 && context.at(-1) in operators) {
        throw new SyntaxError(`Unexpected token '${char}'`, {
          cause: { column: current },
        })
      }

      flush()
      context.push(char)
      current++
      continue
    }

    buffer += char
    current++
  }

  flush()

  if (nesteds.length > 0) throw new SyntaxError("Unexpected end of input")

  return tokens
}

const DEFAULT_ALIASES = {
  ...Object.fromEntries(Object.keys(operators).map((k) => [k, ` ${k} `])),
  "-unary": "-",
}

export function formatMathFormula(tokens, aliases = DEFAULT_ALIASES) {
  const out = []

  for (const item of tokens) {
    if (Array.isArray(item)) {
      out.push("(", formatMathFormula(item), ")")
    } else out.push(aliases[item] ?? item)
  }

  return out.join("")
}
