import { ensureURL } from "../os/ensureURL.js"

const DEFAULTS = {
  media: "all",
  append: true,
  once: false,
  cacheBusting: true,
}

function cleanup(el) {
  el.onload = null
  el.onerror = null
}

/**
 * @param {string | URL} url
 * @param {{
 *   media?: string;
 *   append?: boolean;
 *   once?: boolean;
 *   cacheBusting?: boolean;
 *   ignoreFileSystem?: boolean;
 * }} [options]
 * @returns {Promise<CSSStyleSheet>}
 */
export async function loadCSS(url, options) {
  const config = { ...DEFAULTS, ...options }

  if (config.once === true) {
    if (document.head.querySelector(`link.js-loaded[href*="${url}"]`)) return
  }

  url = await ensureURL(url, options)
  url = String(url)
  if (config.cacheBusting && !url.startsWith("blob:")) {
    url += `?v=${Date.now()}`
  }

  return new Promise((resolve, reject) => {
    const el = document.createElement("link")

    el.rel = "stylesheet"
    el.className = "js-loaded"
    if (config.media !== "all") el.media = config.media

    el.onload = async () => {
      // TODO: check styles are applied
      resolve(el.sheet)
      cleanup(el)
    }

    el.onerror = async () => {
      const { rejectAsset } = await import("./inc/rejectAsset.js")
      rejectAsset(reject, "Stylesheet not loaded correctly", url)
      cleanup(el)
    }

    if (config.append) document.head.append(el)
    else document.head.prepend(el)

    el.href = url
    return el
  })
}
