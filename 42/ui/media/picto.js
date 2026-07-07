import { Component } from "../../api/gui/Component.js"
import { TRANSPARENT } from "../../lib/constant/TRANSPARENT.js"
import { isURLImage } from "../../lib/syntax/url/isURLImage.js"
import { isPromiseLike } from "../../lib/type/any/isPromiseLike.js"
import { defer } from "../../lib/type/promise/defer.js"

let iconsManager

const pictos = {
  ready: defer(),
  list: new Set(),
}

const type = "image/svg+xml"

fetch(new URL("../../assets/img/pictos.svg", import.meta.url))
  .then((res) => res.text())
  .then((text) => {
    const svg = /** @type {SVGSVGElement} */ (
      new DOMParser().parseFromString(text, type).firstChild
    )
    svg.style.display = "none"
    svg.querySelector("style").remove()
    document.documentElement.append(svg)
    for (const item of svg.children) pictos.list.add(item.id.slice(6))
    pictos.ready.resolve()
  })

export class PictoComponent extends Component {
  static plan = {
    tag: "ui-picto",
    props: {
      value: true,
      size: true,
    },
  }

  get value() {
    return this.getAttribute("value") ?? ""
  }
  set value(value) {
    if (isPromiseLike(value)) {
      void (async () => {
        try {
          this.#setValue(await value)
        } catch {
          this.#setValue("transparent")
        }
      })()
    } else {
      this.#setValue(value)
    }
  }

  #setValue(value) {
    if (value) {
      if (value === "transparent") value = TRANSPARENT
      this.setAttribute("value", value)
    } else {
      this.removeAttribute("value")
    }
  }

  get size() {
    return this.getAttribute("size")
  }
  set size(value) {
    this.setAttribute("size", value)
  }

  updated(key, val) {
    switch (key) {
      case "size":
        this.style.setProperty("--size", `${val}px`)
        break

      case "value":
        this.rerender()
        break

      default:
        break
    }
  }

  async render() {
    if (!this.value) return

    await pictos.ready

    if (pictos.list.has(this.value)) {
      return {
        tag: "svg.ui-picto__image",
        viewBox: "0 0 16 16",
        width: "16",
        height: "16",
        draggable: false,
        aria: { hidden: true },
        content: {
          tag: "use",
          href: "#picto-" + this.value,
        },
      }
    }

    if (!this.img) {
      this.img = new Image()
      this.img.className = "ui-picto__image"
      this.img.draggable = false
      // img.fetchPriority = "high"
      this.img.loading = "lazy"
    }

    if (this.value.startsWith("blob:") || isURLImage(this.value)) {
      this.img.src = this.value
    } else {
      const { value, signal } = this
      iconsManager ??= (await import("../../api/os/managers/iconsManager.js"))
        .iconsManager
      const path = await iconsManager
        .getIconPath(this.value, "16x16")
        .then((path) => {
          this.img.classList.toggle("broken-image", false)
          return path
        })
        .catch(() => {
          this.img.classList.toggle("broken-image", true)
        })

      if (!signal.aborted && value === this.value) {
        this.img.src = path ?? TRANSPARENT
      }
    }

    return this.img
  }
}

Component.define(PictoComponent)

export const picto = (value, options) => {
  const config = typeof value === "string" ? { value, ...options } : value
  return new PictoComponent(config)
}
