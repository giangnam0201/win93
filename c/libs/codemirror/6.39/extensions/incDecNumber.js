import { EditorSelection } from "../lib/state.js"

/**
 * @typedef {import('@codemirror/state').StateCommand} StateCommand
 * @typedef {import('@codemirror/state').TransactionSpec} TransactionSpec
 */

/**
 * @typedef {import('../lib/types').StateCommandTarget} StateCommandTarget
 */

/**
 * @returns {boolean}
 */
export const incrementNumber1 = (target) => incDecNumber(target, 1)
/**
 * @returns {boolean}
 */
export const decrementNumber1 = (target) => incDecNumber(target, -1)
/**
 * @returns {boolean}
 */
export const incrementNumber01 = (target) => incDecNumber(target, 0.1)
/**
 * @returns {boolean}
 */
export const decrementNumber01 = (target) => incDecNumber(target, -0.1)
/**
 * @returns {boolean}
 */
export const incrementNumber10 = (target) => incDecNumber(target, 10)
/**
 * @returns {boolean}
 */
export const decrementNumber10 = (target) => incDecNumber(target, -10)

/**
 * @param {StateCommandTarget}
 * @param {number} delta
 * @returns {boolean}
 */
function incDecNumber({ state, dispatch }, delta) {
  const specs = []

  for (const sel of state.selection.ranges) {
    let { from, to } = sel
    if (from === to) {
      // No selection, extract number
      const line = state.doc.lineAt(from)
      const numRange = extractNumber(line.text, from - line.from)
      if (numRange) {
        from = line.from + numRange[0]
        to = line.from + numRange[1]
      }
    }

    if (from !== to) {
      // Try to update value in given region
      let value = updateNumber(state.doc.sliceString(from, to), delta)
      specs.push({
        changes: { from, to, insert: value },
        selection: EditorSelection.range(from, from + value.length),
      })
    } else {
      specs.push({ selection: sel })
    }
  }

  if (specs.some((s) => s.changes)) {
    const tr = state.update(...specs)
    dispatch(tr)
    return true
  }

  return false
}

/**
 * Extracts number from text at given location
 * @param {string} text
 * @param {number} pos
 * @returns {[number, number] | undefined}
 */
function extractNumber(text, pos) {
  let hasDot = false
  let end = pos
  let start = pos
  let ch
  const len = text.length

  // Read ahead for possible numbers
  while (end < len) {
    ch = text.charCodeAt(end)
    if (isDot(ch)) {
      if (hasDot) {
        break
      }
      hasDot = true
    } else if (!isNumber(ch)) {
      break
    }
    end++
  }

  // Read backward for possible numerics
  while (start >= 0) {
    ch = text.charCodeAt(start - 1)
    if (isDot(ch)) {
      if (hasDot) {
        break
      }
      hasDot = true
    } else if (!isNumber(ch)) {
      break
    }
    start--
  }

  // Negative number?
  if (start > 0 && text[start - 1] === "-") {
    start--
  }

  if (start !== end) {
    return [start, end]
  }

  return
}

/**
 * @param {string} num
 * @param {number} delta
 * @returns {string}
 */
function updateNumber(num, delta, precision = 3) {
  const value = parseFloat(num) + delta

  if (isNaN(value)) {
    return num
  }

  const neg = value < 0
  let result = Math.abs(value).toFixed(precision)

  // Trim trailing zeroes and optionally decimal number
  result = result.replace(/\.?0+$/, "")

  // Trim leading zero if input value doesn't have it
  if ((num[0] === "." || num.startsWith("-.")) && result[0] === "0") {
    result = result.slice(1)
  }

  return (neg ? "-" : "") + result
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isDot(ch) {
  return ch === 46
}

/**
 * Check if given code is a number
 * @param {number} code
 * @returns {boolean}
 */
export function isNumber(code) {
  return code > 47 && code < 58
}
