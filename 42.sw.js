import { ipc } from "./42/api/ipc.js"
import { FileIndex } from "./42/api/fs/FileIndex.js"
import { getDriver } from "./42/api/fs/getDriver.js"
import { getPathInfo } from "./42/lib/syntax/path/getPathInfo.js"
import { Database } from "./42/api/db/Database.js"

// eslint-disable-next-line prefer-destructuring
const self = /** @type {ServiceWorkerGlobalScope} */ (
  /** @type {unknown} */ (globalThis.self)
)

// [1] TODO: check if needed https://web.dev/articles/sw-range-requests
// https://github.com/GoogleChrome/workbox/blob/v7/packages/workbox-range-requests/src/createPartialResponse.ts

const MAX_CACHE_SIZE = 1.5 * 1024 ** 2 // 2 MiB

let db
let state
let fileIndex

const debug = 1
const d = debug ? (...args) => console.debug(t(), ...args) : () => {}
const dd = debug > 1 ? (...args) => console.debug(t(), ...args) : () => {}

function t(date) {
  if (!date) date = new Date()
  else if (typeof date === "number") date = new Date(date)
  return `${date.toLocaleTimeString("zh-CN")}`
}

async function getFileIndex() {
  if (fileIndex) return
  db ??= new Database({ name: "fileindex" })

  const res = await db.store.get("value").catch((err) => {
    d("🛰️💥 database error", err)
  })

  if (res) {
    fileIndex ??= new FileIndex()
    fileIndex.value = res
    state = "handshake-completed"
    d("🛰️ fileindex synced")
  } else {
    d("🛰️💥 fileindex empty")
  }
}

ipc
  .on("42_SW_HANDSHAKE", () => getFileIndex())
  .on("42_SW_WAKE", async () => {
    await getFileIndex()
    d("🛰️ wake")
  })
  .on("42_FILEINDEX_CHANGE", async (filename, mode, inode) => {
    try {
      await fileIndex?.[mode](filename, inode)
    } catch (err) {
      d(`🛰️💥 42_FILEINDEX_CHANGE error`, err)
    }
  })

// Immediate page control

self.addEventListener("install", () => {
  d("🛰️ install")
  state = "install"
  self.skipWaiting()
})
self.addEventListener("activate", (e) => {
  d("🛰️ activate")
  state = "activate"
  e.waitUntil(self.clients.claim())
})

const REQUEST_INIT_KEYS = [
  "cache",
  "credentials",
  "headers",
  "integrity",
  "keepalive",
  "method",
  "mode",
  "priority",
  "redirect",
  "referrer",
  "referrerPolicy",
  "signal",
]

async function cloneRequest(url, request, requestInit = {}) {
  if (!requestInit.body) {
    let body
    if (request.headers.get("Content-Type")) body = await request.blob()
    requestInit.body = body
  }

  for (const key of REQUEST_INIT_KEYS) requestInit[key] ??= request[key]
  return new Request(url, requestInit)
}

async function fromCacheOrNetwork(req, pathname, forcePathname) {
  let res = await caches.match(pathname)
  if (res) return res

  const scopePath = new URL(self.registration.scope).pathname
  let targetUrl = req.url
  if (scopePath !== "/" && !pathname.startsWith(scopePath)) {
    targetUrl = location.origin + scopePath + pathname.slice(1)
    forcePathname = true
  }

  if (forcePathname) req = await cloneRequest(targetUrl, req)
  res =
    req.destination === "iframe"
      ? await fetch(req, {
          credentials: "same-origin",
          headers: {
            "Sec-Fetch-Dest": req.destination,
            "X-Sec-Fetch-Dest": req.destination,
          },
        })
      : await fetch(req, { credentials: "same-origin" })

  if (res.status === 404 && (pathname.includes("/retroarch/") || pathname.includes("/roms/"))) {
    // Fallback directly to windows93.net
    res = await fetch("https://www.windows93.net" + pathname)
  }

  if (
    res.status < 400 &&
    pathname !== "/42.tar.gz" &&
    !pathname.startsWith("/42_DEV") &&
    Number(res.headers.get("Content-Length")) < MAX_CACHE_SIZE
  ) {
    const clone = res.clone()
    caches.open("fetched").then((cache) => cache.put(pathname, clone))
  }

  return res
}

let handshakeRequestPromise
self.addEventListener("fetch", (e) => {
  const req = e.request
  let { origin, pathname, searchParams } = new URL(req.url)

  // if (searchParams.has("clear-site-data")) {
  //   if (searchParams.has("empty")) return false
  //   headers["Clear-Site-Data"] = '"cache", "storage"'
  // }

  // if (req.destination === "iframe") console.log("🛰️ iframe:", req)

  if (origin !== location.origin) {
    e.respondWith(
      (async () => {
        // Return simulated mock responses for common endpoints or empty responses with permissive CORS headers
        const headers = new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Content-Type": "application/json"
        });
        
        // Mock specific well-known requests
        if (req.url.includes("shop.windows93.net")) {
          // Return an empty array or valid JSON list of items
          return new Response(JSON.stringify([]), { headers });
        }
        
        // Return a mock successful status with empty content
        return new Response("", { status: 200, headers });
      })()
    );
    return;
  }

  if (
    (searchParams.has("original") && navigator.onLine) ||
    pathname.startsWith("/shop")
  ) {
    return
  }

  try {
    pathname = decodeURI(pathname)
  } catch {}
  if (pathname.endsWith("/")) pathname += "index.html"

  if (
    (pathname === "/index.html" || pathname === "/42.system.js") &&
    navigator.onLine
  ) {
    return
  }

  e.respondWith(
    (async () => {
      if (!fileIndex) {
        dd(`🛰️ state: ${state}`)
        if (state) return fromCacheOrNetwork(req, pathname)

        // If `state` is undefined the service worker was resumed
        // from an sleeping state. We need to request fileIndex again.
        handshakeRequestPromise ??= getFileIndex()
        await handshakeRequestPromise
        if (!fileIndex) {
          state = "handshake-failed"
          d("🛰️ handshake failed")
          return fromCacheOrNetwork(req, pathname)
        }
      }

      handshakeRequestPromise = undefined

      let inode = fileIndex.get(pathname)
      if (!inode) return fromCacheOrNetwork(req, pathname)

      // Check if symlink
      if (typeof inode === "string") {
        pathname = inode
        if (
          pathname.startsWith("http://") ||
          pathname.startsWith("https://") ||
          pathname.startsWith("//")
        ) {
          return fromCacheOrNetwork(req, pathname, true)
        }
        inode = fileIndex.get(pathname)
        if (!inode) return fromCacheOrNetwork(req, pathname, true)
      }

      const { headers } = getPathInfo(pathname, {
        headers: {
          "Accept-Ranges": "bytes", // [1]
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "credentialless",
        },
      })

      try {
        const driver = await getDriver(inode[1])
        const blob = await driver.open(pathname)
        headers["Content-Length"] = blob.size
        return new Response(blob, { headers })
      } catch (err) {
        const status = err.errno === 2 ? 404 : 500
        if (status === 404 && (pathname.includes("/retroarch/") || pathname.includes("/roms/"))) {
          try {
            return await fetch("https://www.windows93.net" + pathname)
          } catch (fetchErr) {
            d(`🛰️ Fallback fetch failed:`, fetchErr)
          }
        }
        return new Response(err, { headers, status })
      }
    })(),
  )
})

self.addEventListener("error", (e) => {
  d("🛰️💥 error", e)
})

self.addEventListener("unhandledrejection", (e) => {
  d("🛰️💥 unhandled rejection", e)
})
