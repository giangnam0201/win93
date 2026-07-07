import { encodePath } from "../encodePath.js"

/**
 * Returns blob URL if service worker isn't active.
 *
 * @template {string | URL | Request} T
 * @param {T} url
 * @param {{
 *   ignoreFileSystem?: boolean,
 *   signal?: AbortSignal,
 * }} [options]
 * @returns {Promise<T>}
 */
export async function ensureURL(url, options) {
  if (
    options?.ignoreFileSystem !== true &&
    !globalThis.navigator?.serviceWorker?.controller &&
    globalThis.location?.origin &&
    globalThis.sys42?.fs &&
    typeof url === "string" &&
    url.startsWith("blob:") === false
  ) {
    const parsedURL = new URL(encodePath(url), location.origin)

    if (
      parsedURL.origin !== location.origin ||
      parsedURL.protocol !== location.protocol
    ) {
      return url
    }

    let path = parsedURL.pathname
    try {
      path = decodeURIComponent(path)
    } catch {}

    if (globalThis.sys42.fileIndex.get(path)) {
      url = await globalThis.sys42.fs.getURL(path, options)
    }
  }

  return url
}
