import { slugify } from "../type/string/slugify.js"

/* TODO: fix when heading contain links or elements with `title` */
export function autoAnchor(root = document) {
  for (const item of root.querySelectorAll(`
:is(.document,.js-auto-anchor) > :is(h1, h2, h3, h4, h5, h6):not([id]):not(:has(a[href^="#"]:only-child))
  `)) {
    const anchor = document.createElement("a")
    item.id = slugify(item.textContent)
    anchor.href = `#${item.id}`
    anchor.append(...item.childNodes)
    item.replaceChildren(anchor)
  }

  if (location.hash) {
    const { hash } = location
    location.hash = ""
    location.hash = hash
  }
}
