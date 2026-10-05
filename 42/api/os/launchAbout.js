import { os } from "../os.js"
import { alert } from "../../ui/layout/dialog.js"
import { loadText } from "../load/loadText.js"

export async function launchAbout(app) {
  await os.apps.ready
  const icon = app.getIcon()

  let shouldTitle = false

  let md

  if (app.manifest.about || app.manifest.description || app.manifest.license) {
    const { Markdown } = await import("../../formats/language/Markdown.js")
    md = (text) => {
      const div = document.createElement("div")
      div.innerHTML = Markdown.compile(text)
      shouldTitle = Boolean(div.querySelector("h1,h2,h3,h4,h5,h6"))
      return [...div.childNodes]
    }
  }

  /** @type {any} */
  let content

  if (app.manifest.about || app.manifest.description) {
    const text = app.manifest.about
      ? await loadText(app.resolveURL(app.manifest.about))
      : `# ${app.name}\n\n${app.manifest.description}`

    content = {
      tag: ".app__about",
      content: md(text),
    }
  } else {
    content = {
      tag: ".app__about",
      content: [{ tag: "h1", content: app.name }],
    }
  }

  if (app.manifest.authors?.length > 0) {
    if (app.manifest.authors.length === 1) {
      const { name, web, description } = app.manifest.authors[0]
      content.content.push({
        tag: "p",
        content: [
          "Created by ",
          { tag: "a", href: web, target: "_blank", content: name },
          description ? md(description) : undefined,
        ],
      })
    } else {
      shouldTitle = true
      const ul = []

      content.content.push(
        { tag: "h2", content: "Authors" },
        { tag: "ul", content: ul },
      )

      for (const { name, web, description } of app.manifest.authors) {
        ul.push({
          tag: "li",
          content: [
            { tag: "a", href: web, target: "_blank", content: name },
            description ? md(description) : undefined,
          ],
        })
      }
    }
  }

  if (app.manifest.license) {
    content.content.push(
      shouldTitle ? { tag: "h2", content: "License" } : undefined, //
      md(app.manifest.license),
    )
  }

  const base = app.manifest.manifestURL

  content.created = (el) => {
    for (const item of el.querySelectorAll("img, iframe, audio, video, a")) {
      const key = item.localName === "a" ? "href" : "src"
      const src = item.getAttribute(key)
      if (src) {
        const url = new URL(src, base)
        if (url.origin === location.origin) item[key] = url.pathname
      }
    }
  }

  return alert(content, {
    label: "About",
    class: { "ui-dialog-about": true },
    icon,
    signal: app.signal,
    on: {
      selector: ".ui-dialog-demand__image img",
      click: () => os.explorer(app.manifest.dirPath),
    },
  })
}
