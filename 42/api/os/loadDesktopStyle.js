import { loadCSS } from "../load/loadCSS.js"

let loaded = false
export async function loadDesktopStyle() {
  if (loaded) return
  loaded = true
  const base = location.pathname.endsWith('/') ? location.pathname : location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
  await Promise.allSettled([
    loadCSS(base + "style.css", { ignoreFileSystem: true }),
    loadCSS(base + "desktop.css", { ignoreFileSystem: true }),
  ])
}
