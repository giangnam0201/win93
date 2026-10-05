import { ensureURL } from "../os/ensureURL.js"

const DEFAULTS = {
  type: "text/javascript",
  async: true,
  data: undefined,
  once: true,
  cacheBusting: false,
}

function cleanup(el) {
  el.onload = null
  el.onerror = null
}

/**
 * @param {string | URL} url
 * @param {{
 *   type?: string;
 *   async?: boolean;
 *   data?: Record<string, any>
 *   once?: boolean;
 *   cacheBusting?: boolean;
 *   ignoreFileSystem?: boolean;
 * }} [options]
 * @returns {Promise<HTMLScriptElement | any>}
 */
export async function loadScript(url, options) {
  const config = { ...DEFAULTS, ...options }

  if (config.once === true) {
    if (document.head.querySelector(`script.js-loaded[src*="${url}"]`)) return
  }

  url = await ensureURL(url, options)
  url = String(url)
  if (config.cacheBusting && !url.startsWith("blob:")) {
    url += `?v=${Date.now()}`
  }

  if (config.type === "module") return import(url)

  return new Promise((resolve, reject) => {
    const el = document.createElement("script")

    el.type = config.type
    el.async = config.async
    el.className = "js-loaded"

    if (config.data) {
      for (const [key, val] of Object.entries(config.data)) {
        try {
          el.dataset[key] = JSON.stringify(val)
        } catch {}
      }
    }

    el.onload = async () => {
      resolve(el)
      cleanup(el)
    }

    el.onerror = async () => {
      const { rejectAsset } = await import("./inc/rejectAsset.js")
      rejectAsset(reject, "Script not loaded correctly", url)
      cleanup(el)
    }

    document.head.append(el)

    el.src = url
  })
}
