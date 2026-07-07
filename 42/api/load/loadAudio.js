import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { ensureURL } from "../os/ensureURL.js"

const { HAVE_ENOUGH_DATA } = HTMLMediaElement

const rejectAudio = async (url, reject) => {
  const { rejectAsset } = await import("./inc/rejectAsset.js")
  rejectAsset(reject, "Audio not loaded correctly", url)
}

/**
 * @param {string | HTMLAudioElement} src
 * @returns {Promise<HTMLAudioElement>}
 */
export async function loadAudio(src, options) {
  let asset

  if (isInstanceOf(src, HTMLAudioElement)) {
    if (src.readyState === HAVE_ENOUGH_DATA) return src
    asset = src
  } else {
    asset = new Audio()
    asset.src = await ensureURL(src, options)
  }

  return new Promise((resolve, reject) => {
    const handler = (e) => {
      asset.removeEventListener("canplaythrough", handler)
      asset.removeEventListener("error", handler)
      if (e.type === "error") rejectAudio(asset.src, reject)
      else resolve(asset)
    }

    asset.addEventListener("canplaythrough", handler)
    asset.addEventListener("error", handler)
  })
}
