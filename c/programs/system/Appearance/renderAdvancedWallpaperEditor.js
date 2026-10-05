import { render } from "../../../../42/api/gui/render.js"
import { themesManager } from "../../../../42/api/os/managers/themesManager.js"
import { cssBackground } from "../../../../42/lib/cssom/cssBackground.js"
import { cssVar } from "../../../../42/lib/cssom/cssVar.js"
import { scrapeCSSUrls } from "../../../../42/lib/cssom/scrapeCSSUrls.js"
import { repaintThrottle } from "../../../../42/lib/timing/repaintThrottle.js"
import { capitalize } from "../../../../42/lib/type/string/capitalize.js"
import { getDesktopElementStyle } from "./renderWallpaperEditor.js"

export function renderAdvancedWallpaperEditor(el) {
  const res = cssBackground(getDesktopElementStyle())

  if (res.length > 1) {
    const id = "appearance-wallpaper-css"
    const value = cssVar.get("--desktop-bg")
    el.replaceChildren()
    render(
      {
        tag: "ui-code.h-full",
        lang: "css",
        id,
        value,
        on: {
          input: repaintThrottle((e, target) => {
            const cssText = target.value
            cssVar.set("--desktop-bg", cssText)
            themesManager.updateCurrentProperty("--desktop-bg", cssText)
            // theme.applyProperties()
          }),
        },
      },
      el,
    )
    return
  }

  const content = []

  const background = res[0]

  for (const [key, val] of Object.entries(background)) {
    const id = `appearance-wallpaper-${key}`
    content.push([
      { tag: "label", for: id, content: capitalize(key) },
      {
        tag:
          key === "color"
            ? "ui-colorpicker"
            : key === "image"
              ? "ui-pathpicker"
              : "input",
        id,
        value: val,
        on: {
          "ui:before-picker": ({ detail }) => {
            const urls = scrapeCSSUrls(detail.path)
            if (urls.length === 0) detail.path = ""
            else {
              const url = new URL(urls[0], location.href)
              detail.path = url.origin === location.origin ? url.pathname : ""
            }
          },
          "ui:after-picker": ({ detail }) => {
            detail.path = `url(${encodeURI(detail.path)})`
          },
          "input": repaintThrottle((e, target) => {
            background[key] = target.value
            const cssText = String(background)
            cssVar.set("--desktop-bg", cssText)
            themesManager.updateCurrentProperty("--desktop-bg", cssText)
            // theme.applyProperties()
          }),
        },
      },
    ])
  }

  el.replaceChildren()
  render({ tag: "table.table-form.ma-xxs", content }, el)
}
