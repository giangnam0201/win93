/* eslint-disable no-sequences */
/* eslint-disable no-unused-expressions */
/* eslint-disable complexity */
/* eslint-disable max-depth */

import { COLOR_NAMES } from "../../constant/COLOR_NAMES.js"

const { round } = Math

const RGB_ORDER = ["r", "g", "b", "a"]
const HSL_ORDER = ["h", "s", "l", "a"]

export function validateRange(obj) {
  if (obj.r > 255) (obj.r = 255), (obj.valid = false)
  if (obj.g > 255) (obj.g = 255), (obj.valid = false)
  if (obj.b > 255) (obj.b = 255), (obj.valid = false)

  if (obj.r < 0) (obj.r = 0), (obj.valid = false)
  if (obj.g < 0) (obj.g = 0), (obj.valid = false)
  if (obj.b < 0) (obj.b = 0), (obj.valid = false)

  if (obj.a > 1) (obj.a = 1), (obj.valid = false)
  if (obj.a < 0) (obj.a = 0), (obj.valid = false)
}

function validate(out, { r, g, b, a }) {
  out.valid = true
  if (r.unit !== g.unit || g.unit !== b.unit) out.valid = false
  if (a.needed && !("a" in out)) out.valid = false
  validateRange(out)
}

// @ts-ignore
let parseCSSUnitValue = globalThis.CSSUnitValue?.parse

if (!parseCSSUnitValue) {
  const units = { "": "number", "px": "px", "%": "percent" }
  parseCSSUnitValue = (str) => {
    let [, value, unit] = str.match(/\s*(\.?\d+\.?\d*)(\S*)\s*$/)
    value = Number(value)
    if (!Number.isNaN(value) && unit in units) {
      return { value, unit: units[unit] }
    }

    throw new SyntaxError("Invalid math expression")
  }
}

function parseValue(out, states, key) {
  const state = states[key]

  try {
    const { value, unit } = parseCSSUnitValue(state.buffer)
    state.unit = unit

    switch (unit) {
      case "number":
        return value
      case "percent":
        return key === "a" ? value / 100 : round((value / 100) * 255)
      default:
        out.valid = false
    }
  } catch {
    out.valid = false
  }
}

/** @param {string} val */
export function parseColor(val) {
  val = val.toLowerCase().trim()

  if (val in COLOR_NAMES) {
    const [r, g, b] = COLOR_NAMES[val]
    return { r, g, b, a: 1, valid: true, name: val }
  }

  const out = { r: 0, g: 0, b: 0, a: 1, valid: undefined }

  const states = {
    r: { buffer: "" },
    g: { buffer: "" },
    b: { buffer: "" },
    a: { buffer: "", needed: false },
  }

  let hexSyntax
  let funcSyntax
  let pushOrder = 0

  let cur = 0
  main: while (cur < val.length) {
    let code = val.codePointAt(cur)

    if (code === 35 && cur === 0) code = val.codePointAt(++cur) // #

    if (
      code === 114 && // r
      val.codePointAt(cur + 1) === 103 && // g
      val.codePointAt(cur + 2) === 98 // b
    ) {
      funcSyntax = RGB_ORDER
      cur += 3
      code = val.codePointAt(cur)
    }

    if (
      code === 104 && // h
      val.codePointAt(cur + 1) === 115 && // s
      val.codePointAt(cur + 2) === 108 // l
    ) {
      funcSyntax = HSL_ORDER
      cur += 3
      code = val.codePointAt(cur)
    }

    if (funcSyntax) {
      if (code === 97 /* a */) {
        states.a.needed = true
        code = val.codePointAt(++cur)
      }

      if (code === 40 /* ( */) {
        cur++
        let advanced = false
        while (cur < val.length) {
          const key = funcSyntax[pushOrder]

          code = val.codePointAt(cur)

          if (code === 41 /* ) */) {
            out[key] = parseValue(out, states, key)
            break main
          }

          if (
            code === 32 /* " " */ ||
            code === 44 /* , */ ||
            code === 47 /* / */
          ) {
            if (!advanced) {
              advanced = true
              out[key] = parseValue(out, states, key)
              pushOrder++
            }

            cur++
            continue
          }

          if (key) {
            states[key].buffer += val.charAt(cur++)
            advanced = false
            continue
          } else break main
        }
      }
    }

    // 0-9 || A-F
    if ((code > 47 && code < 58) || (code > 96 && code < 103)) {
      hexSyntax ??= []
      hexSyntax.push(val.charAt(cur++))
      continue
    }

    hexSyntax = undefined
    break
  }

  if (funcSyntax && out.valid !== false) {
    validate(out, states)
  } else if (hexSyntax) {
    switch (hexSyntax.length) {
      case 3:
      case 4: {
        for (let i = 0, l = RGB_ORDER.length; i < l; i++) {
          if (hexSyntax[i]) {
            const key = RGB_ORDER[i]
            out[key] = Number.parseInt(`${hexSyntax[i]}${hexSyntax[i]}`, 16)
          }
        }

        if (hexSyntax.length === 4) out.a /= 255
        out.valid = true
        break
      }

      case 6:
      case 8: {
        let i = 0
        for (const key of RGB_ORDER) {
          if (hexSyntax[i + 1]) {
            out[key] = Number.parseInt(`${hexSyntax[i]}${hexSyntax[i + 1]}`, 16)
            i += 2
          }
        }

        if (hexSyntax.length === 8) out.a /= 255
        out.valid = true
        break
      }

      default:
        out.valid = false
    }
  } else {
    out.valid = false
  }

  return out
}
