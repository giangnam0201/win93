import "../ui/media/picto.js"
import { create } from "../api/gui/create.js"
import { autoAnchor } from "../lib/dom/autoAnchor.js"
import { replaceIndentation } from "../lib/type/string/replaceIndentation.js"
import { clipboard } from "../api/io/clipboard.js"

function higlight(html) {
  html = html
    .replaceAll(/\s*<style>[\S\s]*<\/style>\s*/g, "")
    .replaceAll(/(?:(\s*)<div>1<\/div>\n){3,}/g, "\n$1<div>1</div>\n$1[…]\n")
    .replaceAll(
      /(?:(\s*)<div>[2-9]<\/div>\n){3,}/g,
      "\n$1<div>2</div>\n$1[…]\n",
    )

  html = replaceIndentation(html)

  html = html
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(/&lt;ui-([^\s/]+)/g, "&lt;<strong>ui-$1</strong>")
    // .replaceAll(/ui-([^\s/]+)&gt;/g, "<strong>ui-$1</strong>&gt;")
    .replaceAll(/&lt;([^\s/]+?)( |&gt;|$)/g, "&lt;<em>$1</em>$2")
    .replaceAll(/style="([^"]+)"/g, 'style="<strong>$1</strong>"')
    .replaceAll(/value="([^"]+)"/g, 'value="<strong>$1</strong>"')
    .replaceAll(/class="(.+?)(?: demo)?"/g, 'class="<strong>$1</strong>"')

  return html
}

function cloneAttributes(target, source) {
  for (const attr of source.attributes) {
    if (
      attr.nodeName === "src" ||
      attr.nodeName === "srcdoc" ||
      attr.nodeName === "disabled"
    ) {
      continue
    }

    target.setAttribute(attr.nodeName, attr.nodeValue)
  }
}

customElements.define(
  "demo-bloc",
  class extends HTMLElement {
    constructor() {
      super()
      this.content = fetch(this.getAttribute("src")).then((res) => res.text())
    }
    async connectedCallback() {
      const doc = new DOMParser().parseFromString(
        await this.content,
        "text/html",
      )

      const body = doc.querySelector("body")

      const undones = []

      const scripts = document.createDocumentFragment()

      for (const s of doc.querySelectorAll("script")) {
        const script = doc.createElement("script")
        script.type = s.type

        if (s.src) script.src = s.src
        else script.append(s.textContent)

        scripts.append(script)
        const { parentElement } = s
        s.remove()

        if (parentElement.children.length === 0) {
          undones.push(
            new Promise((resolve) => {
              new MutationObserver(
                ([record], observer) =>
                  record.addedNodes.length > 0 &&
                  resolve(observer.disconnect()),
              ).observe(parentElement, { childList: true })
            }),
          )
        }
      }

      if (this.getAttribute("disabled") !== null) {
        for (const legend of body.querySelectorAll("legend")) {
          legend.textContent += " (disabled)"
        }

        for (const item of /** @type NodeListOf<HTMLInputElement> */ (
          body.querySelectorAll("a, input, button, select, textarea")
        )) {
          if (item.id) item.id += "-disabled"
          if (item.name) item.name += "-disabled"
          item.toggleAttribute("disabled", true)
        }

        for (const item of /** @type NodeListOf<HTMLLabelElement> */ (
          body.querySelectorAll("label[for]")
        )) {
          item.htmlFor += "-disabled"
        }
      }

      for (const item of body.querySelectorAll(".demo")) {
        cloneAttributes(item, this)
      }

      const children = [...doc.querySelectorAll("head style"), ...body.children]

      this.replaceWith(...children)

      document.body.append(scripts)

      await Promise.all(undones)
      autoAnchor()
      window.dispatchEvent(new CustomEvent("ui.update"))

      for (const item of children) {
        if (!item.classList.contains("demo")) continue
        const code = create("code.code", {
          style: {
            display: "block",
            padding: 0,
            maxBlockSize: 0,
          },
        })
        code.innerHTML = higlight(item.innerHTML.trim())
        item.before(code)
      }
    }
  },
)

window.addEventListener("click", ({ target }) => {
  // @ts-ignore
  const picto = target.closest("#demo-pictos ui-picto")
  if (picto) {
    clipboard.copy(picto.value, { notif: true })
  }

  // @ts-ignore
  if (!target.closest(".demo,.code")) {
    // @ts-ignore
    if (!target.closest("h1, h2, h3, h4")) {
      location.hash = ""
    }

    for (const item of document.querySelectorAll(".demo")) {
      item.removeAttribute("style")
    }
  }
})

const showCodeToggle = document.querySelector("#toggle-show-code")
showCodeToggle?.addEventListener("input", ({ target }) => {
  document.body.classList.toggle("show-code", target.checked)
})

showCodeToggle?.dispatchEvent(new Event("input"))
