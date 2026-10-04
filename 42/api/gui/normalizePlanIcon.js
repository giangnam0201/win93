import "../../ui/media/picto.js"
import { isURLImage } from "../../lib/syntax/url/isURLImage.js"
import { iconsManager } from "../os/managers/iconsManager.js"

export async function normalizePlanIcon(config, size) {
  if (config.picto) {
    return { tag: "ui-picto", value: config.picto }
  }

  let src = config.img

  if (config.icon) {
    src = isURLImage(config.icon)
      ? config.icon
      : await iconsManager.getIconPath(config.icon, size)
  }

  if (src) {
    const img = new Image()
    img.src = src
    img.draggable = false
    img.style.userSelect = "none"
    img.setAttribute("aria-hidden", "true")

    try {
      await img.decode()
      return img
    } catch (err) {
      console.log(err)
    }
  }
}
