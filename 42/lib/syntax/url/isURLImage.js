import { getExtname } from "../path/getExtname.js"

export const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webm",
  ".ico",
])

export function isURLImage(url) {
  return url && (url.startsWith("data:image") || IMAGE_EXT.has(getExtname(url)))
}
