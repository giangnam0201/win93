import { loadCSS } from "../load/loadCSS.js"

let loaded = false
export async function loadDesktopStyle() {
  if (loaded) return
  loaded = true
  const base = (() => {
    let p = location.pathname;
    if (!p.endsWith("/")) {
      p = p.substring(p.lastIndexOf("/") + 1).includes(".") ? p.substring(0, p.lastIndexOf("/") + 1) : p + "/";
    }
    return p;
  })();
  await Promise.allSettled([
    loadCSS(base + "style.css", { ignoreFileSystem: true }),
    loadCSS(base + "desktop.css", { ignoreFileSystem: true }),
  ])
}
