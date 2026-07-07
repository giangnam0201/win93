import {
  themesManager,
  WALLPAPER_STYLES,
} from "../../../../42/api/os/managers/themesManager.js"
import { cssBackground } from "../../../../42/lib/cssom/cssBackground.js"
import { render } from "../../../../42/api/gui/render.js"
import { cssVar } from "../../../../42/lib/cssom/cssVar.js"
import { scrapeCSSUrls } from "../../../../42/lib/cssom/scrapeCSSUrls.js"
import { getExtname } from "../../../../42/lib/syntax/path/getExtname.js"
import { unloadIframe } from "../../../../42/lib/dom/reloadIframe.js"
import { repaintThrottle } from "../../../../42/lib/timing/repaintThrottle.js"
import { encodePath } from "../../../../42/api/encodePath.js"

let desktopElement
let desktopElementStyles
export function getDesktopElementStyle() {
  if (desktopElementStyles) return desktopElementStyles
  // desktopElement ??= document.querySelector(".desktop")
  if (!desktopElement) {
    desktopElement = document.createElement("div")
    desktopElement.className = "desktop hide"
    document.documentElement.append(desktopElement)
  }
  desktopElementStyles = getComputedStyle(desktopElement)
  return desktopElementStyles
}

export const WALLPAPER_MODES = [
  ...Object.entries(WALLPAPER_STYLES),
  // ["Custom", ""],
]

let wallpaperIframe

function getWallpaperPath(path) {
  const urls = scrapeCSSUrls(path)
  if (urls.length === 0) path = ""
  else {
    const url = new URL(urls[0], location.href)
    path = url.origin === location.origin ? url.pathname : ""
  }

  return path
}

function getWallpaperStyle({ repeat, position, size }) {
  const str = `${repeat} ${position} / ${size}`

  for (const key in WALLPAPER_STYLES) {
    if (Object.hasOwn(WALLPAPER_STYLES, key)) {
      const value = WALLPAPER_STYLES[key]
      if (value === str) return { key, value }
    }
  }
}

export function renderWallpaperEditor(el) {
  const res = cssBackground(getDesktopElementStyle())
  const background = res[0] ?? {}

  const colorId = "appearance-wallpaper-color"
  const imageId = "appearance-wallpaper-image"
  const modeId = "appearance-wallpaper-mode"

  let colorEl
  let imageEl
  let modeEl

  const content = [
    [
      { tag: "label", for: colorId, content: "Color" },
      {
        tag: "ui-colorpicker",
        id: colorId,
        value: background.color,
        created(el) {
          colorEl = el
        },
      },
    ],
    [
      { tag: "label", for: imageId, content: "Background" },
      {
        tag: "ui-pathpicker",
        id: imageId,
        value: getWallpaperPath(background.image),
        // startIn: "~/interface/wallpapers/",
        startIn: "/c/users/windows93/interface/wallpapers/",
        // startIn: "/c/users/windows93/interface/screensavers/3DMaze/",
        accept: "text/html, image/*",
        created(el) {
          imageEl = el
        },
      },
    ],
    [
      { tag: "label", for: modeId, content: "Mode" },
      {
        tag: "select",
        id: modeId,
        content: WALLPAPER_MODES,
        value: getWallpaperStyle(background)?.value ?? WALLPAPER_STYLES.Fill, // WALLPAPER_STYLES.Fill,
        created(el) {
          modeEl = el
        },
      },
    ],
    // [{ tag: "td" }, { tag: "button", content: "Advanced", disabled: true }],
  ]

  el.replaceChildren()
  render(
    {
      tag: "table.table-form.ma-xxs",
      content,
      on: {
        input: repaintThrottle(() => {
          wallpaperIframe ??= document.querySelector("#wallpaper")
          let image = encodePath(imageEl.value)
          const extname = getExtname(image)
          if (wallpaperIframe) {
            if ([".html", ".htm", ".xhtml"].includes(extname)) {
              try {
                const url = new URL(image, location.href)
                if (wallpaperIframe.src !== url.href) {
                  wallpaperIframe.src = image
                }
                image = undefined
              } catch {}
            } else if (
              wallpaperIframe.src &&
              wallpaperIframe.src !== "about:blank"
            ) {
              unloadIframe(wallpaperIframe)
            }
          }
          let cssText = ""
          cssText = imageEl.value
            ? `${colorEl.value} url(${image}) ${modeEl.value}`
            : colorEl.value
          cssVar.set("--desktop-bg", cssText)
          themesManager.updateCurrentProperty("--desktop-bg", cssText)
        }),
      },
    },
    el,
  )
}
