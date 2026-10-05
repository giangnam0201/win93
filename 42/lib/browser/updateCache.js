export async function updateCache(path, options) {
  if (!navigator.onLine && options?.force !== true) return

  if (Array.isArray(path)) {
    if (path.length === 0) return
    const urlMatches = new Set(path.map((p) => new Request(p).url))

    return caches.keys().then((keys) =>
      Promise.all(
        keys.map(async (key) => {
          const cache = await caches.open(key)
          const requests = await cache.keys()
          return Promise.all(
            requests.map(async (req) => {
              if (urlMatches.has(req.url)) {
                await cache.delete(req)
                if (options?.delete !== true) await cache.add(req.url)
              }
            }),
          )
        }),
      ),
    )
  }

  if (await caches.match(path)) {
    return caches.keys().then((keys) =>
      Promise.all(
        keys.map(async (key) => {
          const cache = await caches.open(key)
          if (await cache.match(path)) {
            await cache.delete(path)
            if (options?.delete !== true) await cache.add(path)
          }
        }),
      ),
    )
  }
}
