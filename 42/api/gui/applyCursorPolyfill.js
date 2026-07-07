import { scrapeCSSUrls } from "../../lib/cssom/scrapeCSSUrls.js"
import { getCSSVar } from "../../lib/cssom/cssVar.js"
import { loadArrayBuffer } from "../load/loadArrayBuffer.js"
import { generateCursorCSS } from "../../formats/container/ANI.js"
import { untilCSSVar } from "../../lib/cssom/untilCSSVar.js"

export const CURSORS = [
  "default",
  "none",
  "context-menu",
  "help",
  "pointer",
  "progress",
  "wait",
  "cell",
  "crosshair",
  "text",
  "vertical-text",
  "alias",
  "copy",
  "move",
  "no-drop",
  "not-allowed",
  "grab",
  "grabbing",
  "all-scroll",
  "col-resize",
  "row-resize",
  "n-resize",
  "e-resize",
  "s-resize",
  "w-resize",
  "ne-resize",
  "nw-resize",
  "se-resize",
  "sw-resize",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "zoom-in",
  "zoom-out",
  // "button",
]

let styleEl

export function resetCursorPolyfill() {
  for (const anim of document.documentElement.getAnimations({
    subtree: true,
  })) {
    // @ts-ignore
    const { animationName } = anim
    if (animationName?.startsWith("cursor-")) anim.cancel()
  }

  if (styleEl) styleEl.textContent = ""
}

export async function applyCursorPolyfill() {
  resetCursorPolyfill()

  const undones = []

  for (let cursor of CURSORS) {
    if (cursor === "none") continue
    cursor = `cursor-${cursor}`
    const value = getCSSVar(cursor)
    if (value.includes("url(")) {
      const [url] = scrapeCSSUrls(value)
      if (url?.endsWith(".ani")) {
        const { pathname } = new URL(url, location.href)
        // console.log(pathname)

        undones.push(
          loadArrayBuffer(pathname).then((arrayBuffer) =>
            generateCursorCSS(cursor, new Uint8Array(arrayBuffer)),
          ),
        )
      }
    }
  }

  if (undones.length > 0) {
    const rules = await Promise.all(undones)
    const cssText = rules.join("\n")
    if (!styleEl) {
      styleEl = document.createElement("style")
      styleEl.className = "js-loaded cursor-polyfill"
      document.head.append(styleEl)
    }
    styleEl.textContent = cssText
    // console.log(cssText)
  }
}

export async function initCursorPolyfill() {
  try {
    await untilCSSVar("--cursor-pointer")
    applyCursorPolyfill()
  } catch (err) {
    console.log(err)
  }
}
