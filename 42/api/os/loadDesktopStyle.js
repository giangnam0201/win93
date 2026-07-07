import { loadCSS } from "../load/loadCSS.js"

let loaded = false
export async function loadDesktopStyle() {
  if (loaded) return
  loaded = true
  await Promise.allSettled([
    loadCSS("/style.css", { ignoreFileSystem: true }),
    loadCSS("/desktop.css", { ignoreFileSystem: true }),
  ])
}
