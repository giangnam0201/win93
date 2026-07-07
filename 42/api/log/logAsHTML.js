/* eslint-disable max-depth */
import { parseChalkTemplate } from "../../lib/syntax/chalk/parseChalkTemplate.js"

export function normalizeHref(href) {
  return href.replace(/:(\d+):?(\d+)?$/, (_, l, c) => {
    c = c ? `&column=${c}` : ""
    return `?line=${l}${c}`
  })
}

export function formatStyle(color) {
  return "ansi-" + color.split(".").join(" ansi-")
}

export function formatLog(tokens) {
  const root = document.createDocumentFragment()
  let current = /** @type {DocumentFragment | HTMLAnchorElement} */ (root)

  const state = { 0: undefined }

  let href

  for (let { type, content, nested } of tokens) {
    const hasHref = href !== undefined

    if (!hasHref && content.startsWith("[](")) {
      href = ""
      const link = document.createElement("a")
      link.className = "ansi--link"
      root.append(link)
      current = link
      content = content.slice(3)
      if (!content) continue
    }

    if (type === "text") {
      if (hasHref) {
        if (content.startsWith(")")) {
          // @ts-ignore
          current.href = normalizeHref(href)
          current = root
          content = content.slice(1)
          href = undefined
          if (!content) continue
        } else href += content
      }

      const span = document.createElement("span")
      span.append(content)
      if (state[nested]) span.className = state[nested]
      current.append(span)
    } else {
      state[nested] = formatStyle(content)
    }
  }

  return root
}

export function logAsHTML(str) {
  return formatLog(parseChalkTemplate(str))
}
