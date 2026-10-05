import "../../../../42/ui/layout/tabs.js"
// import "../../../../42/ui/control/code.js"
import "../../../../42/ui/control/combobox.js"
import "../../../../42/ui/control/pathpicker.js"
import "../../../../42/ui/control/colorpicker.js"
import { fileIndex } from "../../../../42/api/fileIndex.js"
import { render } from "../../../../42/api/gui/render.js"
import { themesManager } from "../../../../42/api/os/managers/themesManager.js"
import { getStemname } from "../../../../42/lib/syntax/path/getStemname.js"
import { untilNextRepaint } from "../../../../42/lib/timing/untilNextRepaint.js"
import { toast } from "../../../../42/ui/layout/toast.js"
import { cssVar } from "../../../../42/lib/cssom/cssVar.js"
import { repaintThrottle } from "../../../../42/lib/timing/repaintThrottle.js"
import { CURSORS } from "../../../../42/api/gui/applyCursorPolyfill.js"
import { renderWallpaperEditor } from "./renderWallpaperEditor.js"
import { getExtname } from "../../../../42/lib/syntax/path/getExtname.js"

export async function renderApp(app) {
  const themesPaths = fileIndex.glob("**/*.theme.css")
  const themes = {}
  let current

  const content = []
  for (const path of themesPaths) {
    const name = getStemname(path).replace(".theme", "")
    content.push(name)
    if (themesManager.value.current === path) current = name
    themes[name] = { path }
  }

  let settingsEl
  let selectEl
  let colorsEl
  let wallpaperEl
  let overridesEl

  app.on("decode", (fileAgent) => {
    const extname = getExtname(fileAgent.path)
    if (extname === ".theme") {
      selectEl.value = "windows9x"
      preview({ scheme: fileAgent.path })
    }
  })

  function updateColors() {
    for (const item of /** @type {NodeListOf<HTMLInputElement>} */ (
      app.dialogEl.querySelectorAll("ui-colorpicker")
    )) {
      const { property } = item.dataset
      if (!property) continue
      item.value = cssVar.get(property)
    }
  }

  function getOverrides() {
    const out = {}
    for (const item of overridesEl.elements) out[item.name] = item.checked
    return out
  }

  async function preview(options) {
    const name = selectEl.value
    if (themes[name]) {
      const theme = await themesManager.preview(themes[name].path, options)
      if (!theme) return

      theme.on("change", () => {
        requestAnimationFrame(() => {
          updateColors()
          renderWallpaperEditor(wallpaperEl)
        })
      })

      settingsEl.replaceChildren()
      colorsEl.replaceChildren()

      try {
        const plans = await theme.getThemePlans()
        if (plans) {
          if (plans.settings) render(plans.settings, settingsEl)
          if (plans.colors) render(plans.colors, colorsEl)
        }
      } catch (err) {
        toast(err)
      }

      await untilNextRepaint()
      renderWallpaperEditor(wallpaperEl)
    }

    // await untilNextRepaint()
    // app.dialogEl?.resize()
  }

  app.ready.then(() => {
    themesManager.beginAppearanceSession()
    preview()

    app.dialogEl.addEventListener(
      "ui:dialog.close",
      async (e) => {
        await (e.detail.ok //
          ? themesManager.applyAppearanceSession()
          : themesManager.cancelAppearanceSession())
      },
      { signal: app.signal },
    )
  })

  let idleId

  return {
    dialog: {
      // decline: true,
      // agree: true,
      footer: [
        {
          tag: "button.ui-dialog__agree",
          content: "Save",
          action: () => app.dialogEl.close(true),
        },
        {
          tag: "button.ui-dialog__decline",
          content: "Cancel",
          action: () => app.dialogEl.close(),
        },
        // {
        //   tag: "button",
        //   content: "Apply",
        //   action: () => themesManager.apply(),
        // },
      ],
    },

    tag: "ui-tabs",
    content: [
      {
        // selected: true,
        label: "Wallpaper",
        content: {
          fragment: true,
          created(el) {
            wallpaperEl = el
          },
        },
      },

      {
        selected: true,
        label: "Theme",
        content: [
          {
            tag: ".rows.grow.ma-xxs.gap-xs",
            content: [
              {
                tag: ".cols.shrink",
                content: [
                  {
                    tag: "select",
                    content,
                    value: current,
                    oninput: () => preview(),
                    created(el) {
                      selectEl = el
                    },
                  },
                  // {
                  //   tag: "button",
                  //   content: "Reset",
                  //   onclick: () => {
                  //     toast("Not ready yet...")
                  //   },
                  // },
                ],
              },
              {
                tag: ".rows.shrink.gap-xs",
                created(el) {
                  settingsEl = el
                },
              },
              {
                tag: "fieldset.grow._piled",
                label: "Overrides",
                content: {
                  tag: ".split-2",
                  content: [
                    {
                      tag: "checkbox",
                      name: "wallpaper",
                      checked: themesManager.value.overrides?.wallpaper,
                    },
                    {
                      tag: "checkbox",
                      name: "colors",
                      disabled: true,
                      checked: themesManager.value.overrides?.colors,
                    },
                    {
                      tag: "checkbox",
                      name: "cursors",
                      disabled: true,
                      checked: themesManager.value.overrides?.cursors,
                    },
                    {
                      tag: "checkbox",
                      name: "sounds",
                      disabled: true,
                      checked: themesManager.value.overrides?.sounds,
                    },
                  ],
                },
                on: {
                  input: () => {
                    themesManager.setOverrides(getOverrides())
                    // preview()
                  },
                },
                created(el) {
                  overridesEl = el
                },
              },
              {
                tag: ".message.info",
                content: [
                  "The Appearance app is not fully implemented yet.",
                  document.createElement("br"),
                  "It's a preview of the features to come.",
                ],
              },
            ],
          },
        ],
      },

      {
        // selected: true,
        label: "Colors",
        content: {
          // fragment: true,
          style: { minHeight: 200 },
          created(el) {
            colorsEl = el
          },
          on: {
            selector: "ui-colorpicker",
            input: repaintThrottle((e, target) => {
              let { property } = target.dataset
              const { rgb } = target.color
              property = cssVar.set(property, rgb)
              cancelIdleCallback(idleId)
              idleId = requestIdleCallback(
                () => {
                  const theme = themesManager.updateCurrentProperty(
                    property,
                    rgb,
                  )
                  theme?.refreshTheme()
                },
                { timeout: 500 },
              )
            }),
          },
        },
      },

      {
        label: "Cursors",
        content: {
          tag: ".split-3.inset.ma-xxs",
          content: CURSORS.map((x) => ({
            tag: `button.cursor-${x}`,
            content: x,
          })),
          on: {
            selector: "button",
            pointerdown: () => {
              toast("Cursor editor not ready yet")
            },
          },
        },
      },
    ],
  }
}
