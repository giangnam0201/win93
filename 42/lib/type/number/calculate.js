import { operators, parseMathFormula } from "./parseMathFormula.js"
import { precision } from "./precision.js"

const { max } = Math

// const toRad = (x) => x * (Math.PI / 180)
// const toDeg = (x) => x * (180 / Math.PI)

function getDecimalLength(token) {
  const index = token.indexOf("e")
  return index > 0 && token.at(index + 1) === "-"
    ? Number.parseInt(token.slice(index + 2), 10)
    : token.split(".")[1]?.length ?? 0
}

export function expr(tokens) {
  let left = Number.NaN

  let opType
  let op

  let sign = 1

  for (let i = 0, l = tokens.length; i < l; i++) {
    let token = tokens[i]

    if (Array.isArray(token)) {
      token = String(expr(token))
    } else if (token in operators) {
      opType = token
      op = operators[token]
      continue
    } else if (token === "-unary") {
      sign = -1
      continue
    }

    const right = Number.parseFloat(token)

    if (op) {
      if (opType === "+" || opType === "-") {
        const leftDecimals = getDecimalLength(String(left))
        const rightDecimals = getDecimalLength(token)
        left = precision(op(left, right), max(leftDecimals, rightDecimals))
      } else {
        left = op(left, right)
      }
    } else left = right

    left *= sign
    sign = 1
  }

  return left
}

export function calculate(formula, options) {
  const tokens = parseMathFormula(formula)

  const out = expr(tokens)
  if (Number.isInteger(out)) return out

  if (options?.ceilInfiniteDecimals !== false) {
    const str = String(out)
    const decimalIndex = str.indexOf(".")
    const mayRepeat = str[decimalIndex + 5]
    if (!mayRepeat || mayRepeat === "0") return out
    if (str.slice(decimalIndex + 1).includes(mayRepeat.repeat(8))) {
      return precision.ceil(out, 11)
    }
  }

  if (Number.isFinite(options?.decimals)) {
    return precision(out, options?.decimals)
  }

  return out
}
