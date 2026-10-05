/* eslint-disable no-sequences */
// @related https://gist.github.com/dgraham/92e4c45da3707a3fe789
// @related https://github.com/sindresorhus/ky
// @read https://developer.mozilla.org/en-US/docs/Web/API/AbortController

import { noop } from "../lib/type/function/noop.js"
import { updateCache } from "../lib/browser/updateCache.js"
import { configure } from "./configure.js"
import { ensureURL } from "./os/ensureURL.js"
import { encodePath } from "./encodePath.js"

/**
 * @typedef {RequestInit & {
 *   encodePath?: boolean;
 *   fresh?: boolean;
 *   ignoreFileSystem?: boolean;
 * }} HTTPOptions
 */

/** @type {HTTPOptions} */
const DEFAULTS = { referrerPolicy: "same-origin" }

export const POST_JSON_CONFIG = {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
}

let HTTP_STATUS_CODES

export class HTTPError extends Error {
  constructor(res, url) {
    const statusText =
      res.ok === false &&
      (res.statusText === "OK" || res.statusText === "") &&
      HTTP_STATUS_CODES
        ? HTTP_STATUS_CODES[res.status] || res.statusText
        : res.statusText

    url = String(url)

    if (res.url && url.endsWith(res.url) === false) url = res.url

    super(`${res.status} ${statusText} : ${url}`)
    Object.defineProperty(this, "name", { value: "HTTPError" })

    this.url = url
    this.status = res.status
    this.statusText = statusText
    this.headers = Object.fromEntries(res.headers)
  }
}

// 1. Accept 304 "Not Modified" (Inspired by jQuery ajax)
// @read https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304

export async function handleStatus(res, url) {
  if (res.ok || res.status === 304 /* 1 */) return res

  // Lazy load status codes list
  HTTP_STATUS_CODES ??= await import("../lib/constant/HTTP_STATUS_CODES.js") //
    .then((m) => m.HTTP_STATUS_CODES)

  throw new HTTPError(res, url)
}

export async function normalizeBody(body, out, parent) {
  if (body instanceof FormData || body instanceof ReadableStream) return body
  if (!out) out = new FormData()
  for (let [key, val] of Object.entries(body)) {
    if (parent) key = `${parent}[${key}]`

    if (val.localName === "form") val = new FormData(val)
    else if (val.form) {
      const input = val
      val = new FormData(val.form) // force any data serialization
      for (const inputFormKey of val.keys()) {
        if (input.name !== inputFormKey) val.delete(inputFormKey)
      }
    }

    if (val instanceof FormData) {
      for (const [subkey, value] of val) {
        out.append(`${key}[${subkey}]`, value)
      }

      return
    }

    if (typeof val === "object" && !(val instanceof File)) {
      normalizeBody(val, out, key)
    } else out.append(key, val)
  }

  return out
}

/**
 * @param {string | URL | Request} url
 * @param {HTTPOptions} options
 */
async function request(url, options) {
  url = await ensureURL(url, options)

  try {
    if (options.encodePath) {
      url = encodePath(url)
      delete options.encodePath
    }

    return await fetch(url, options)
  } catch (cause) {
    const infos = { url, reached: false }
    let message = "This url can't be reached"
    try {
      const res = await fetch(url, { ...options, mode: "no-cors" })
      infos.reached = true
      if (res.status !== 0) {
        infos.status = res.status
        infos.statusText = res.statusText
        infos.headers = Object.fromEntries(res.headers)
      }

      message =
        'This url can be reached using "no-cors" but the response is empty'
    } catch {}

    throw Object.assign(new Error(`${message} : ${url}`, { cause }), infos)
  }
}

function makeMethod(method) {
  /**
   * @param {string | URL | Request} url
   * @param {HTTPOptions[]} [options]
   */
  return async (url, ...options) => {
    const config = configure(...options, { method })
    if (config.fresh === true) {
      delete config.fresh
      await updateCache(url)
    }
    const res = await request(url, config)
    return handleStatus(res, url)
  }
}

function makeMethodWithBody(method) {
  /**
   * @param {string | URL | Request} url
   * @param {BodyInit} [body]
   * @param {HTTPOptions[]} [options]
   */
  return async (url, body, ...options) => {
    const config = configure(DEFAULTS, ...options, { method })
    body = config.body ?? body
    if (body) {
      config.body = config.headers["Content-Type"].startsWith(
        "application/json",
      )
        ? JSON.stringify(body)
        : await normalizeBody(body)
    }

    const res = await request(url, config)
    return handleStatus(res, url)
  }
}

/**
 * @param {string | URL | Request} url
 * @param {BodyInit} [body]
 * @param {HTTPOptions[]} [options]
 */
export async function postJSON(url, body, ...options) {
  const config = configure(...options, POST_JSON_CONFIG)
  body = config.body ?? body
  config.body = JSON.stringify(body)
  const res = await request(url, config)
  return handleStatus(res, url)
}

export const httpGet = makeMethod("GET")
export const httpHead = makeMethod("HEAD")
export const httpOptions = makeMethod("OPTIONS")
// export const httpConnect = makeMethod("CONNECT")
// export const httpTrace = makeMethod("TRACE")
export const httpPost = makeMethodWithBody("POST")
export const httpPut = makeMethodWithBody("PUT")
export const httpDelete = makeMethodWithBody("DELETE")
export const httpPatch = makeMethodWithBody("PATCH")

// @read https://web.dev/fetch-upload-streaming/

export function makeStreamWithBody(requestMethod) {
  return (url, cb = noop, ...rest) => {
    const { readable, writable } = new TransformStream()
    requestMethod(url, readable, ...rest).then(cb)
    return writable
  }
}

export function makeStream(requestMethod) {
  return (url, options, ...rest) => {
    let { queuingStrategy, onHeaders, onSize } = options ?? {}
    let reader
    const rs = new ReadableStream(
      {
        async pull(controller) {
          if (!reader) {
            const res = await requestMethod(url, options, ...rest)
            onHeaders?.(res.headers, rs)
            onSize?.(Number(res.headers.get("Content-Length")), rs)
            reader = res.body.getReader()
          }

          const { value, done } = await reader.read()
          if (done) controller.close()
          else controller.enqueue(value)
        },
      },
      queuingStrategy,
    )

    // @ts-ignore
    rs.headers = (fn) => ((onHeaders = fn), rs)
    // @ts-ignore
    rs.size = (fn) => ((onSize = fn), rs)
    return rs
  }
}

/**
 * @typedef {httpGet & {
 *   get: httpGet
 *   post: httpPost
 *   head: httpHead
 *   put: httpPut
 *   delete: httpDelete
 *   options: httpOptions
 *   patch: httpPatch
 *   postJSON: postJSON
 *   stream: httpStreamGet
 *   source: httpStreamGet
 *   sink: httpStreamPost
 * }} HTTP
 *
 * @typedef {httpStreamGet & {
 *   get: httpStreamGet
 *   post: httpStreamPost
 * }} HTTPStream
 */

export const httpStreamGet = makeStream(httpGet)
export const httpStreamPost = makeStreamWithBody(httpPost)

export const http = /** @type {HTTP} */ (httpGet)

http.get = httpGet
http.post = httpPost
http.head = httpHead
http.put = httpPut
http.delete = httpDelete
http.options = httpOptions
http.patch = httpPatch
http.postJSON = postJSON

http.stream = /** @type {HTTPStream} */ (httpStreamGet)
http.source = httpStreamGet
http.sink = httpStreamPost

// @ts-ignore
http.post.json = postJSON
// @ts-ignore
http.stream.get = httpStreamGet
// @ts-ignore
http.stream.post = httpStreamPost
