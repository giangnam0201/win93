import { loadCSS } from "../load/loadCSS.js"

let loading
export function loadDesktopStyle() {
  // Every caller waits for the same styles, including early boot preloading.
  loading ??= Promise.allSettled([
    loadCSS("/style.css", { ignoreFileSystem: true }),
    loadCSS("/desktop.css", { ignoreFileSystem: true }),
  ])
  return loading
}
