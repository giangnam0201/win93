import { unloadIframe } from "../../lib/dom/reloadIframe.js"
import { suspendGifs } from "../../lib/dom/suspendGifs.js"
import { toast } from "../../ui/layout/toast.js"

/** @type {HTMLIFrameElement} */
let wallpaperEl

let desktopEl

export function suspendIntensiveTasks(el, options) {
  desktopEl ??= document.querySelector("#desktop")

  const restoreGifs = suspendGifs(el ?? desktopEl, options)

  let restoreWallpaper
  wallpaperEl ??= desktopEl?.querySelector("iframe#wallpaper")
  if (wallpaperEl && wallpaperEl.src) {
    const { src } = wallpaperEl
    restoreWallpaper = () => {
      wallpaperEl.src = src
    }

    unloadIframe(wallpaperEl)
    toast("Dynamic wallpaper disabled during intensive task", { icon: "info" })
  }

  options?.signal?.addEventListener("abort", () => restore())

  function restore() {
    restoreGifs()
    restoreWallpaper?.()
  }

  return restore
}
