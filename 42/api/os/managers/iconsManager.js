import { ConfigFile } from "../ConfigFile.js"
import { ensureURL } from "../ensureURL.js"
import { normalizeDirname } from "../../fs/normalizeFilename.js"
import { findIconPath } from "./iconsManager/findIconPath.js"
import { getIconFromPath } from "./iconsManager/getIconFromPath.js"

const DEFAULTS = {
  icons: [
    new URL("../../../assets/icons", import.meta.url).pathname,
    "~/config/assets/icons",
  ],
}

class IconsManager extends ConfigFile {
  #fallbackFileIcon
  #fallbackDirIcon

  async postload() {
    this.#fallbackFileIcon = {}
    this.#fallbackDirIcon = {}

    this.value.icons = this.value.icons.map((item) => normalizeDirname(item))

    const genericAppIcons = await Promise.all([
      findIconPath(this.value.icons[0], "apps/generic", "16x16"),
      findIconPath(this.value.icons[0], "apps/generic", "32x32"),
    ])

    this.fallbackAppIcon = {
      "16x16": genericAppIcons[0],
      "32x32": genericAppIcons[1],
    }
  }

  async #getIconPath(infos, size = "32x32") {
    await this.ready

    for (let i = this.value.icons.length - 1; i >= 0; i--) {
      const themePath = this.value.icons[i]
      const path = await findIconPath(themePath, infos, size)
      if (path) return path
    }

    if (typeof infos === "string") {
      // If unfound try from a freedesktop name
      // https://specifications.freedesktop.org/icon-naming-spec/latest/ar01s04.html
      infos = infos.replace("-", "/")
      for (let i = this.value.icons.length - 1; i >= 0; i--) {
        const themePath = this.value.icons[i]
        const path = await findIconPath(themePath, infos, size)
        if (path) return path
      }
    }

    if (infos.isDir) {
      this.#fallbackDirIcon[size] ??= await findIconPath(
        this.value.icons[0],
        "places/folder",
        size,
      )
      return this.#fallbackDirIcon[size]
    }

    this.#fallbackFileIcon[size] ??= await findIconPath(
      this.value.icons[0],
      "subtype/octet-stream",
      size,
    )
    return this.#fallbackFileIcon[size]
  }

  async getIconPath(infos, size = "32x32", options) {
    const path = await this.#getIconPath(infos, size)
    if (navigator.serviceWorker?.controller) return path

    try {
      return await ensureURL(path, options)
    } catch {
      return path ?? ""
    }
  }

  async getIconFromPath(path, size, options) {
    return getIconFromPath(path, size, options)
  }

  getDefaultIconsDir() {
    return this.value.icons[0]
  }
}

export const iconsManager = new IconsManager("config/icons.json5", DEFAULTS)
iconsManager.init()
