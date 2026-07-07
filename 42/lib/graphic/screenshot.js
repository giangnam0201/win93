import { walkAllStyleSheets } from "../cssom/walkStyleSheets.js"
import { base64Encode } from "../type/binary/base64.js"
import { ensureElement } from "../type/element/ensureElement.js"
import { copyStyles } from "../type/element/setStyles.js"

async function toDataURL(url) {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        }),
    )
}

export async function embedCSS(el) {
  const undones = []

  walkAllStyleSheets(
    (rule) => {
      if ("href" in rule === false) {
        const urls = []
        let cssText = rule.cssText.replaceAll(
          /url\((["'])?([^"')]*)(["']?)\)/g,
          (_, openQuote, urlString) => {
            if (urlString.endsWith(".cur") || urlString.endsWith(".ani")) return

            const url = new URL(
              urlString,
              rule.parentStyleSheet.href ?? el.ownerDocument.URL,
            )

            if (url.origin !== location.origin) return

            urls.push(url)
            return `url(__ASSET_${urls.length - 1}__)`
          },
        )

        if (urls.length > 0) {
          undones.push(
            Promise.all(
              urls.map(
                async (url) =>
                  (await toDataURL(url.pathname)) + url.hash + url.search,
              ),
            ).then((dataURLs) => {
              for (let i = 0, l = dataURLs.length; i < l; i++) {
                cssText = cssText.replace(`__ASSET_${i}__`, `"${dataURLs[i]}"`)
              }

              return cssText
            }),
          )
        } else {
          undones.push(cssText)
        }
      }
    },
    { document: el.ownerDocument },
  )

  const styles = await Promise.all(undones)
  return styles.join("\n")
}

async function embedAssets(el, original) {
  const undones = []

  for (const item of el.querySelectorAll("use")) {
    const ref = document.querySelector(item.getAttribute("href"))
    if (ref) item.replaceWith(ref.cloneNode(true))
  }

  for (const item of el.querySelectorAll("img")) {
    if (!item.src) continue
    undones.push(
      toDataURL(item.src).then(async (dataURL) => {
        item.src = dataURL
      }),
    )
  }

  const items = el.querySelectorAll("*")
  const originalItems = original.querySelectorAll("*")
  for (let i = 0, l = items.length; i < l; i++) {
    undones.push(commitStyles(items[i], originalItems[i]))
  }

  await Promise.all(undones)
}

async function commitStyles(clone, original) {
  if (!original?.nodeType) return

  const undones = []

  const isIframe = clone.localName === "iframe"

  if (clone.localName === "canvas") {
    const { width, height } = original.getBoundingClientRect()
    const img = new Image(width, height)

    if (globalThis.ImageCapture) {
      let mediaStream = original.captureStream()
      // @ts-ignore
      let imageCapture = new ImageCapture(mediaStream.getVideoTracks()[0])
      undones.push(
        imageCapture
          // @ts-ignore
          .grabFrame()
          .then((imageBitmap) => {
            const canvas = document.createElement("canvas")
            canvas.width = imageBitmap.width
            canvas.height = imageBitmap.height
            const ctx = canvas.getContext("2d")
            ctx.drawImage(imageBitmap, 0, 0)
            img.src = canvas.toDataURL()
            clone.replaceWith(img)
            copyStyles(img, original)

            // Cleanup
            for (const track of mediaStream.getTracks()) track.stop()

            mediaStream = undefined
            imageCapture = undefined
          })
          .catch(() => {
            img.src = original.toDataURL()
            clone.replaceWith(img)
            copyStyles(img, original)
          }),
      )
    } else {
      img.src = original.toDataURL()
      clone.replaceWith(img)
      copyStyles(img, original)
    }
  } else if (
    isIframe &&
    original.contentDocument &&
    original.contentDocument.URL !== "about:blank"
  ) {
    undones.push(
      screenshot(original.contentDocument.documentElement).then((img) => {
        clone.replaceWith(img)
        copyStyles(img, original)
      }),
    )
  } else {
    const styles = getComputedStyle(original)

    for (const prop of [
      "border-left-style",
      "border-right-style",
      "border-bottom-style",
      "border-top-style",
      "border-left-width",
      "border-right-width",
      "border-bottom-width",
      "border-top-width",
    ]) {
      clone.style[prop] = styles[prop]
    }

    // Iframes without src also need styles
    if (isIframe) {
      const div = document.createElement("div")
      clone.replaceWith(div)
      copyStyles(div, original)
    }
  }

  // @ts-ignore
  for (const { reason } of await Promise.allSettled(undones)) {
    if (reason) console.log(reason)
  }
}

/**
 * @typedef {{
 *   signal?: AbortSignal
 *   returnCanvas?: boolean;
 *   returnSVG?: boolean;
 *   returnDataURL?: boolean;
 * }} ScreenshotOptions
 */

/**
 * @overload
 * @param {string | HTMLElement} [el]
 * @param {{returnDataURL: true}} options
 * @returns {Promise<string>}
 */
/**
 * @overload
 * @param {string | HTMLElement} [el]
 * @param {{returnCanvas: true}} options
 * @returns {Promise<HTMLCanvasElement>}
 */
/**
 * @overload
 * @param {string | HTMLElement} [el]
 * @param {{returnSVG: true}} options
 * @returns {Promise<SVGSVGElement>}
 */
/**
 * @overload
 * @param {string | HTMLElement} [el]
 * @param {ScreenshotOptions} [options]
 * @returns {Promise<HTMLImageElement>}
 */
/**
 * @param {string | HTMLElement} [el]
 * @param {ScreenshotOptions} [options]
 * @returns {Promise<string | HTMLImageElement | SVGSVGElement | HTMLCanvasElement>}
 */
export async function screenshot(el = document.documentElement, options) {
  el = ensureElement(el)

  const { width, height } =
    el.localName === "html"
      ? {
          width: el.ownerDocument.defaultView.innerWidth,
          height: el.ownerDocument.defaultView.innerHeight,
        }
      : el.getBoundingClientRect()

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  const foreignObject = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "foreignObject",
  )

  svg.setAttribute("width", String(width))
  svg.setAttribute("height", String(height))
  foreignObject.setAttribute("width", "100%")
  foreignObject.setAttribute("height", "100%")
  svg.append(foreignObject)

  const clone = /** @type {HTMLElement} */ (el.cloneNode(true))
  clone.id = el.id + "-cloned"
  await commitStyles(clone, el)
  if (options?.signal?.aborted) return
  // copyStyles(clone, el)
  clone.style.top = "0"
  clone.style.left = "0"
  clone.style.translate = "0 0"
  clone.style.minWidth = "0"
  clone.style.minHeight = "0"
  clone.style.maxWidth = "none"
  clone.style.maxHeight = "none"
  clone.style.width = width + "px"
  clone.style.height = height + "px"

  const iframe = document.createElement("iframe")
  iframe.style.opacity = "0.01"
  iframe.style.pointerEvents = "none"
  globalThis.top.document.documentElement.append(iframe)
  const doc = iframe.contentDocument
  doc.documentElement.setAttribute("xmlns", "http://www.w3.org/1999/xhtml")

  const styles = await embedCSS(el)
  if (options?.signal?.aborted) return
  const style = document.createElement("style")
  style.append(styles)

  await embedAssets(clone, el)
  if (options?.signal?.aborted) return

  if (clone.localName === "html") {
    doc.documentElement.style.cssText = clone.style.cssText
    for (const item of clone.children) {
      if (item.localName === "body") {
        doc.body.replaceWith(item)
      } else if (item.localName !== "head") {
        doc.documentElement.append(item)
      }
    }
  } else if (clone.localName === "body") {
    doc.body.replaceWith(clone)
  } else {
    doc.documentElement.append(clone)
  }

  doc.head.append(style)
  await doc.fonts.ready
  if (options?.signal?.aborted) return

  foreignObject.append(doc.documentElement)
  iframe.remove()

  if (options?.returnSVG) return svg

  const xml = new XMLSerializer().serializeToString(svg)

  const dataURL = `data:image/svg+xml;base64,${base64Encode(xml)}`

  if (options?.returnDataURL) return dataURL

  const img = new Image(width, height)
  img.src = dataURL
  await img.decode()
  if (options?.signal?.aborted) return

  if (options?.returnCanvas) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)

    return canvas
  }

  return img
}
