import { env } from "../../api/env.js"
import { preload } from "../../api/load/preload.js"
import { inOpaqueOrigin } from "../../api/env/realm/inOpaqueOrigin.js"
import { walkStyleSheets } from "../cssom/walkStyleSheets.js"
import { scrapeCSSUrls } from "../cssom/scrapeCSSUrls.js"
import { sleep } from "../timing/sleep.js"
import { until } from "../event/on.js"
import { noop } from "../type/function/noop.js"
import { updateCache } from "../browser/updateCache.js"

const { FONT_FACE_RULE, IMPORT_RULE, STYLE_RULE } = CSSRule

let { href: url, pathname: documentPath } = new URL(document.URL)
if (documentPath.endsWith("/")) {
  documentPath += "index.html"
  url += "index.html"
}

function findTopImport(href, url, rule) {
  if (rule.parentStyleSheet.ownerNode) {
    if (rule.parentStyleSheet.ownerNode.tagName === "LINK") {
      updateElement(
        rule.parentStyleSheet.ownerNode,
        new URL(rule.parentStyleSheet.ownerNode.href),
        "href",
      )
    } else {
      const el = rule.parentStyleSheet.ownerNode
      const clone = el.cloneNode(true)
      el.after(clone)
      el.textContent = ""
      el.remove()
    }
  } else if (rule.parentStyleSheet.ownerRule?.type === IMPORT_RULE) {
    findTopImport(href, url, rule.parentStyleSheet.ownerRule)
  }
}

async function updateRule(rule, sheet, relativeURL, url, i) {
  url.searchParams.set("t", Date.now())
  const changed = rule.cssText.replaceAll(relativeURL, url.href)

  const as =
    rule.type === FONT_FACE_RULE
      ? "font"
      : rule.type === IMPORT_RULE || rule.type === STYLE_RULE
        ? "style"
        : "image"

  await preload(url, { as })
  sheet.insertRule(changed, i + 1)
  await sleep(200) // Prevent FOUC. TODO: find how to check all imported css has loaded
  await document.fonts.ready
  sheet.deleteRule(i)
}

async function updateElement(el, url, key) {
  url.searchParams.set("t", Date.now())

  // prevent duplicates
  const sel = `${el.localName}[${key}^="${url.origin}${url.pathname}?t="]`
  const previous = document.querySelectorAll(sel)

  const clone = el.cloneNode(true)
  const { cssText } = clone.style
  clone.style.display = "none"

  clone.setAttribute(key, url.href)

  el.after(clone)

  await Promise.race([
    sleep(200),
    until(clone, "load"),
    until(clone, "readystatechange"),
    until(clone, "error"),
  ])

  if (el.localName === "link") await document.fonts.ready

  el.removeAttribute(key)
  el.remove()
  for (const item of previous) {
    item.removeAttribute(key)
    item.remove()
  }

  if (cssText) clone.style = cssText
  else clone.removeAttribute("style")
}

/**
 * @param {string} path
 * @param {(detail: {
 *   path: string
 *   url: string
 *   type: string
 *   target: any
 * }) => void | false} [callback]
 */
export async function liveReload(path, callback = noop) {
  await updateCache(path)

  if (
    path === "reload" ||
    path === documentPath ||
    path.endsWith(".js") ||
    path.endsWith(".json") ||
    path.endsWith(".json5") ||
    path.endsWith(".cbor") ||
    path.endsWith(".ttf") || // TODO: remove this
    path.endsWith(".glsl")
  ) {
    if (
      callback({
        path,
        url,
        type: "document",
        target: document,
      }) !== false
    ) {
      location.reload()
    }
  } else {
    for (const el of document.querySelectorAll(
      `link[href]:not([href=""]),
        [src]:not([src=""]),
        object[data]:not([data=""])`,
    )) {
      // @ts-ignore
      const key = el.src ? "src" : el.href ? "href" : "data"
      let url = el[key]
      url = url ? new URL(url, location.href) : undefined
      if (url?.pathname === path || inOpaqueOrigin) {
        if (
          callback({
            path,
            url: url.origin + url.pathname,
            type: "element",
            target: el,
          }) !== false
        ) {
          updateElement(el, url, key)
        }
      }
    }

    if (inOpaqueOrigin) return

    walkStyleSheets((rule, i, sheet) => {
      const urls =
        rule instanceof CSSImportRule
          ? [rule.href]
          : scrapeCSSUrls(rule.cssText)

      for (const relativeURL of urls) {
        if (relativeURL.startsWith("#")) continue
        let url
        try {
          url = new URL(relativeURL, sheet.href ?? location.origin)
        } catch (err) {
          console.log(err, relativeURL)
          continue
        }
        if (url.pathname === path) {
          if (
            callback({
              path,
              url: url.origin + url.pathname,
              type: "css",
              target: rule,
            }) !== false
          ) {
            if (env.engine.isBlink) {
              findTopImport(url, url, rule)
            } else {
              updateRule(rule, sheet, relativeURL, url, i)
            }
          }
        }
      }
    })
  }
}
