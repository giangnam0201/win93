import { getPathInfo } from "../../../lib/syntax/path/getPathInfo.js"

let manifest
async function getManifest() {
  manifest ??= fetch("/asset-map.json", { cache: "no-cache" })
    .then((res) => res.ok ? res.json() : {})
    .catch(() => ({}))
  return manifest
}

export async function pageAssetResponse(pathname, request) {
  if (!pathname.startsWith("/c/")) return
  let path = pathname
  try { path = decodeURIComponent(path) } catch {}
  const asset = (await getManifest())[path]
  if (!asset) return
  const response = await fetch(asset.url, { credentials: "same-origin" })
  if (!response.ok) return
  const blob = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).blob()
  const { headers } = getPathInfo(path, { headers: { "Accept-Ranges": "bytes" } })
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") ?? "")
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, blob.size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), blob.size - 1) : blob.size - 1
    if (start > end || start >= blob.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${blob.size}` } })
    }
    headers["Content-Range"] = `bytes ${start}-${end}/${blob.size}`
    headers["Content-Length"] = end - start + 1
    return new Response(blob.slice(start, end + 1), { status: 206, headers })
  }
  headers["Content-Length"] = blob.size
  return new Response(blob, { headers })
}
