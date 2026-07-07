import { Component } from "../../api/gui/Component.js"
import { loadDataURL } from "../../api/load/loadDataURL.js"
import { TRANSPARENT } from "../../lib/constant/TRANSPARENT.js"
import { LRU } from "../../lib/structure/LRU.js"
import { isPromiseLike } from "../../lib/type/any/isPromiseLike.js"
import { pixelFontFix } from "../../api/os/managers/themesManager/pixelFontFix.js"
import {
  getIconFromTokens,
  tokenizeFilename,
} from "../../api/os/managers/iconsManager/getIconFromFilename.js"

/** @import { Transferable } from "../../api/gui/trait/transferable.js" */

const CSS_SUPPORTS_ROUND = CSS.supports("translate", "round(down, 50%, 1px) 0")

const cachedImages = new LRU(42)

let iconsManager
async function getIconPath(picto, size) {
  iconsManager ??= await import("../../api/os/managers/iconsManager.js") //
    .then(({ iconsManager }) => iconsManager)
  return iconsManager.getIconPath(picto, size)
}

function isFolderPath(path) {
  return (
    path.endsWith("/") &&
    (path.startsWith("/") ||
      path.startsWith("~/") ||
      path.startsWith("./") ||
      path.startsWith("../") ||
      path.startsWith("$HOME/"))
  )
}

function getFolderPath(icon) {
  return icon.ariaDescription === "folder"
    ? icon.value
    : icon.ariaDescription === "shortcut"
      ? icon.command && isFolderPath(icon.command)
        ? icon.command
        : false
      : false
}

export class IconComponent extends Component {
  static plan = {
    tag: "ui-icon",
    props: {
      value: true,
      picto: true,
      label: true,
      small: true,
      compact: true,
    },
  }

  get disabled() {
    return this.hasAttribute("disabled")
  }
  set disabled(value) {
    this.toggleAttribute("disabled", Boolean(value))
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

  get picto() {
    return this.getAttribute("picto") ?? ""
  }
  set picto(value) {
    this.setAttribute("picto", value)
  }

  get label() {
    return this.getAttribute("label") ?? ""
  }
  set label(value) {
    this.setAttribute("label", value)
  }

  get small() {
    return this.getAttribute("small")
  }
  set small(value) {
    this.setAttribute("small", value)
  }

  get compact() {
    return this.hasAttribute("compact")
  }
  set compact(value) {
    this.toggleAttribute("compact", Boolean(value))
  }

  #command
  get command() {
    return this.#command ?? ""
  }
  set command(value) {
    this.#command = value
  }

  updated() {
    this.rerender()
  }

  connected() {
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0
  }

  inited() {
    this.rootElement = this.parentElement

    this.img = new Image()
    this.img.className = "ui-icon__image"
    this.img.draggable = false
    this.img.fetchPriority = "high"

    this.maskEl = document.createElement("div")
    this.maskEl.className = "ui-icon__mask"

    this.figureEl = document.createElement("div")
    this.figureEl.className = "ui-icon__figure"
    this.figureEl.ariaHidden = "true"
    this.figureEl.append(this.img, this.maskEl)

    this.labelEl = document.createElement("div")
    this.labelEl.className = "ui-icon__label"
  }

  #renderLines() {
    if (!this.small && CSS_SUPPORTS_ROUND) {
      pixelFontFix.renderLines(this.labelEl, this)
    }
  }

  #folderPath = false
  get folderPath() {
    return this.#folderPath
  }
  get isFolder() {
    return Boolean(this.#folderPath)
  }

  /** @type {Transferable} */
  transferable = undefined

  #markIconType() {
    this.#folderPath = getFolderPath(this)
    this.toggleAttribute("folder", this.#folderPath)
    this.toggleAttribute("app", false)
    this.transferable?.destroy()
    this.transferable = undefined
    if (this.isFolder) {
      this.dispatchEvent(
        new CustomEvent("ui.check-icon-folder", { bubbles: true }),
      )
    } else if (this.command) {
      this.dispatchEvent(
        new CustomEvent("ui.check-icon-app", { bubbles: true }),
      )
    }
  }

  render() {
    const { signal, value, picto, label } = this

    let tokens

    if (value) {
      tokens = tokenizeFilename(value)
      if (!label) this.labelEl.textContent = tokens.join("\u200B")
    }

    if (label) this.labelEl.textContent = tokenizeFilename(label).join("\u200B")

    if (this.compact) this.replaceChildren(this.figureEl)
    else this.replaceChildren(this.figureEl, this.labelEl)

    if (picto) {
      this.#renderLines()
      this.ariaDescription = "shortcut"
      this.#markIconType()

      getIconPath(picto, this.small ? "16x16" : "32x32")
        .then((path = TRANSPARENT) => {
          if (signal.aborted || picto !== this.picto) return

          this.img.classList.toggle("broken-image", false)
          this.img.src = path
          this.maskEl.style.maskImage = `url("${path}")`
        })
        .catch(() => {
          this.img.src = TRANSPARENT
          this.maskEl.style.maskImage = `url("${TRANSPARENT}")`
          this.img.classList.toggle("broken-image", true)
        })
      return
    }

    if (!value) return

    getIconFromTokens(value, tokens)
      .then((infos) => {
        if (signal.aborted || value !== this.value) return

        if (infos.name) {
          this.labelEl.textContent = tokenizeFilename(infos.name).join("\u200B")
        }
        this.#renderLines()

        this.mime = infos.mime
        this.ariaDescription = infos.description
        this.command = infos.command
        this.#markIconType()

        if (cachedImages.has(infos.image)) return cachedImages.get(infos.image)

        const dataURL = loadDataURL(infos.image)
        cachedImages.set(infos.image, dataURL)
        return dataURL
      })
      .then((imageSrc) => {
        if (signal.aborted || value !== this.value) return

        this.img.classList.toggle("broken-image", false)
        this.img.src = imageSrc
        this.maskEl.style.maskImage = `url("${imageSrc}")`
      })
      .catch((err) => {
        console.debug("ui-icon getIconFromTokens():", err)
        this.ariaDescription = this.value.endsWith("/")
          ? "folder"
          : this.value.endsWith(".desktop")
            ? "shortcut"
            : "file"
        this.#markIconType()
        this.img.classList.toggle("broken-image", true)
        this.img.src = TRANSPARENT
        this.maskEl.style.maskImage = `url("${TRANSPARENT}")`
      })
  }
}

export const icon = Component.define(IconComponent)
