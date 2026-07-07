import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { ensureURL } from "../os/ensureURL.js"
import { LoadError } from "./inc/LoadError.js"

const checkImage = (img) => img.complete && img.width > 0

const resolveImage = (img) => {
  if (checkImage(img)) return toImageData(img)
  return Promise.reject(
    new LoadError(`Invalid image: ${img.src}`, { url: img.src }),
  )
}

const rejectImage = async (url, reject, cause) => {
  const { rejectAsset } = await import("./inc/rejectAsset.js")
  rejectAsset(reject, "Image not loaded correctly", url, cause)
}

function toImageData(img) {
  const { height, width } = img
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, width, height)
}

/**
 * @param {string | HTMLImageElement} src
 * @param {any} [options]
 * @returns {Promise<ImageData>}
 */
export async function loadImageData(src, options) {
  let img
  if (isInstanceOf(src, HTMLImageElement)) {
    if (src.complete) return resolveImage(src)
    img = src
  } else {
    img = new Image()
    img.fetchPriority = "high"
    img.decoding = "sync"
    const url = await ensureURL(src, options)
    img.src = url
  }

  try {
    await img.decode()
  } catch (cause) {
    return new Promise((_, reject) => {
      rejectImage(img.src, reject, cause)
    })
  }

  return resolveImage(img)
}
