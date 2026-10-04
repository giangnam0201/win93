const INPUT_TYPES = new Set([
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "email",
  "file",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "search",
  "tel",
  // "text", // conflict with svg <text> and inputs are of type text by default
  // "time", // conflict with the <time> tag
  "url",
  "week",
])

const BUTTON_TYPES = new Set([
  "button", //
  "reset",
  "submit",
])

/**
 * @param {string} str
 * @param {{ defaultTag?: string }} [options]
 */
export function parseSingleSelector(str, options) {
  const tag = options?.defaultTag ?? "div"

  const attrs = {}
  const out = { tag, attrs }

  if (!str) return out

  let buffer = ""
  let current = 0

  let type = "tag"
  let lastCharEscaped = false

  const flush = () => {
    if (type === "id") attrs.id ??= buffer
    else if (type === "class") {
      attrs.class ??= []
      if (buffer) attrs.class.push(buffer)
    } else if (buffer && type === "tag") {
      if (BUTTON_TYPES.has(buffer)) {
        attrs.type = buffer
        out.tag = "button"
      } else if (INPUT_TYPES.has(buffer)) {
        attrs.type = buffer
        out.tag = "input"
      } else out.tag = buffer
    }

    buffer = ""
  }

  while (current < str.length) {
    const char = str[current]

    if (char === "\\") {
      lastCharEscaped = true
      const nextChar = str[current + 1]
      if (nextChar !== "{" && nextChar !== "}") buffer += char
      current++
      continue
    }

    if (lastCharEscaped) {
      lastCharEscaped = false
      buffer += char
      current++
      continue
    }

    if (char === ".") {
      flush()
      type = "class"
      current++
      continue
    }

    if (char === "#") {
      flush()
      type = "id"
      current++
      continue
    }

    buffer += char
    current++
  }

  flush()

  return out
}
