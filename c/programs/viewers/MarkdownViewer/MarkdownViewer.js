import { exec } from "../../../../42/api/os/exec.js"
import { Markdown } from "../../../../42/formats/language/Markdown.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  let docEl

  app.on("decode", async (fileAgent) => {
    const text = await fileAgent.getText()
    docEl.innerHTML = Markdown.compile(text)

    const base = location.origin + fileAgent.path

    for (const item of docEl.querySelectorAll("img")) {
      const { pathname } = new URL(item.getAttribute("src"), base)
      item.src = pathname
    }

    for (const item of docEl.querySelectorAll("a")) {
      const { pathname } = new URL(item.getAttribute("href"), base)
      item.href = pathname
      item.toggleAttribute("data-skip-exec", true)
      if (pathname.endsWith(".md")) {
        item.onclick = (e) => {
          e.preventDefault()
          app.loadFile(pathname)
        }
      } else {
        item.onclick = (e) => {
          e.preventDefault()
          exec(pathname)
        }
      }
    }
  })

  return {
    tag: ".document.inset",
    created(el) {
      docEl = el
    },
  }
}
