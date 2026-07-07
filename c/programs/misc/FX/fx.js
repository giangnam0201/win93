import { loadCSS } from "../../../../42/api/load/loadCSS.js"
import { form } from "../../../../42/ui/layout/dialog.js"

export const effectList = [
  "none",
  "acid",
  "sepia",
  "grayscale",
  "invert",
  "invert-light",
  "blur",
  "rotate",
  "spin",
  "neon-satan",
  "neon-slug",
  "neon-hulk",
  "displacement",
  "ripple",
  "litho",
  "onebit",
  "dithering",
  "dithering-color",
  "dithering-smooth",
  "spectrum",
  "trichrome",
  "convo",
  "convo2",
  "convo3",
  "convo4",
  "convoblur",
  "postor",
  "postilt",
  "postel",
  "poster-color-fun",
  "poster-draw",
  "orton",
  "santabarbara",
  "santabarbara2",
  "zombi",
  "sys42",
  "hip",
  "fluorescence",
  "blueray",
  "xray",
  "emboss",
  "dark-emboss",
  "edge",
  "vhs",
  "vhs2",
  "anaglyph",
  "electrize",
  "aqua",
  "square",
  "plaster",
  "plasticine",
  "strobo",
  "strasto",
  "scato",
  "bublur",
  "disco",
]

export const epileptic = new Set([
  "acid",
  "spin",
  "rotate",
  "strobo",
  "strasto",
  "scato",
  "bublur",
  "disco",
])

export const effectListSafe = effectList.filter((item) => !epileptic.has(item))

const CSS_URL = new URL("./fx.css", import.meta.url).pathname
loadCSS(CSS_URL)

document.documentElement.classList.toggle("pattern-checkerboard", true)

function reset() {
  for (const name of effectList) {
    for (const el of document.querySelectorAll(`.fx-${name}`)) {
      el.classList.remove(`fx-${name}`)
    }
  }
}

export function fx(name, el = document.body, options) {
  if (options?.reset === true) reset()

  for (const name of effectList) el.classList.remove(`fx-${name}`)

  if (typeof el === "string") {
    for (const item of document.querySelectorAll(el)) {
      fx(name, item, { reset: false })
    }

    return
  }

  if (!name || name === "none" || name === "reset") return
  if (effectList.includes(name)) el.classList.toggle(`fx-${name}`, true)
  else throw new Error(`Unknown effect name: ${name}`)
}

let dialogEl

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  let value = ""
  for (const name of effectList) {
    if (document.body.classList.contains(`fx-${name}`)) value = name
  }

  return new Promise((resolve) => {
    form(
      [
        {
          content: [
            {
              tag: "select#all.w-full",
              content: effectList,
              value,
              oninput() {
                fx(this.value, undefined, { reset: true })
              },
            },
            {
              tag: "select#safe.w-full.hide",
              content: effectListSafe,
              value,
              oninput() {
                fx(this.value, undefined, { reset: true })
              },
            },
          ],
        },
        {
          tag: ".ma-b-xxxs",
          content: {
            tag: "checkbox",
            label: "Disable epileptic effects",
            oninput() {
              const allEl = dialogEl.querySelector("#all")
              const safeEl = dialogEl.querySelector("#safe")
              if (this.checked) {
                allEl.classList.toggle("hide", true)
                safeEl.classList.toggle("hide", false)
                safeEl.value = effectListSafe.includes(allEl.value)
                  ? allEl.value
                  : "none"
                fx(safeEl.value, undefined, { reset: true })
              } else {
                safeEl.classList.toggle("hide", true)
                allEl.classList.toggle("hide", false)
                allEl.value = safeEl.value
              }
            },
          },
        },
      ],
      {
        label: "FX",
        icon: app.getIcon(),
        agree: "Apply",
        decline: "Reset",
        fieldset: { class: { aligned: false } },
        on: {
          "ui:dialog.open"(e, target) {
            dialogEl = target
            resolve(dialogEl)
          },
          "ui:dialog.close"({ detail }) {
            if (detail.ok === false) reset()
            app.destroy()
          },
        },
      },
    )
  })
}
