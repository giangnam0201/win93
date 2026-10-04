import { SGR } from "../../lib/constant/SGR.js"
import { Color } from "../../lib/syntax/color.js"
import { parseChalkTemplate } from "../../lib/syntax/chalk/parseChalkTemplate.js"

const capitalize = (word) => word[0].toUpperCase() + word.slice(1)

// create chalk like aliases
const ALIASES = {}

for (const [key, value] of Object.entries(SGR.BRIGHT)) {
  ALIASES[`${key}Bright`] = value
}

for (const [key, value] of Object.entries(SGR.BG)) {
  ALIASES[`bg${capitalize(key)}`] = value
}

for (const [key, value] of Object.entries(SGR.BG_BRIGHT)) {
  ALIASES[`bg${capitalize(key)}Bright`] = value
}

const states = {
  NORMAL: { ...ALIASES, ...SGR.STYLES, ...SGR.COLORS },
  BRIGHT: { ...ALIASES, ...SGR.STYLES, ...SGR.BRIGHT },
  BG: { ...ALIASES, ...SGR.STYLES, ...SGR.BG },
  BG_BRIGHT: { ...ALIASES, ...SGR.STYLES, ...SGR.BG_BRIGHT },
}

export function formatStyle(str, entries) {
  let modified

  const setOpen = new Set()
  const setClose = new Set()

  let state = states.NORMAL

  for (const key of entries) {
    if (key === "bright") {
      state = state === states.BG ? states.BG_BRIGHT : states.BRIGHT
    } else if (key === "bg") {
      state = state === states.BRIGHT ? states.BG_BRIGHT : states.BG
    } else if (
      key.startsWith("#") ||
      key.startsWith("rgb") ||
      key.startsWith("bgRgb")
    ) {
      modified = true
      const color = new Color(key)
      if (state === states.BG) {
        setOpen.add(`48;2;${color.r};${color.g};${color.b}`)
        setClose.add("49")
      } else {
        setOpen.add(`38;2;${color.r};${color.g};${color.b}`)
        setClose.add("39")
      }

      state = states.NORMAL
    } else {
      modified = true
      setOpen.add(state[key][0])
      setClose.add(state[key][1])
      state = states.NORMAL
    }
  }

  if (modified !== true) return str

  let open = ""
  let close = ""

  const arrayOpen = [...setOpen]
  const arrayClose = [...setClose]

  open = `\x1b[${arrayOpen.join(";")}m`
  close = `\x1b[${arrayClose.reverse().join(";")}m`

  return str
    .split("\n")
    .map((x) => (x ? `${open}${x}${close}` : ""))
    .join("\n")
}

export function formatAnsi(tokens) {
  let root = ""

  const state = { 0: undefined }

  for (const { type, content, nested } of tokens) {
    if (type === "text") {
      root += state[nested] ? formatStyle(content, state[nested]) : content
    } else {
      const prev = state[nested - 1]
      const style = content.split(".")
      state[nested] = prev ? [...prev, ...style] : style
    }
  }

  return root
}

/**
 * Parse a chalk template.
 *
 * @param {string} chalkTemplate
 */
export function ansi(chalkTemplate) {
  return formatAnsi(parseChalkTemplate(chalkTemplate))
}
