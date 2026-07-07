import { untilIframeEditable } from "../../../../42/lib/timing/untilIframeEditable.js"
import { form } from "../../../../42/ui/layout/dialog.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export function renderApp(app) {
  let iframe

  app.on("ready", async () => {
    iframe = app.el.querySelector("iframe")
    await untilIframeEditable(iframe)

    iframe.contentWindow.resizeTo = (w, h) => app.resize(w, h)

    let n = 0
    while (!iframe.contentWindow.init) {
      await new Promise((r) => setTimeout(r, 100))
      if (n++ > 20) break
    }

    if (app.config.troll === false) {
      iframe.contentWindow.troll = false
    }
    let { rows, cols, mines } = app.config
    let mode = app.config.mode ?? "Beginner"
    if (rows || cols || mines) {
      mode = "Custom"
      rows ??= 9
      cols ??= 9
      mines ??= 10
    }
    iframe.contentWindow.init(mode, rows, cols, mines)
  })

  app.menubar = [
    {
      label: "Game",
      content: [
        {
          label: "Beginner",
          action: () => iframe.contentWindow.init("Beginner"),
        },
        {
          label: "Intermediate",
          action: () => iframe.contentWindow.init("Intermediate"),
        },
        {
          label: "Expert",
          action: () => iframe.contentWindow.init("Expert"),
        },
        {
          label: "Custom…",
          action: async () => {
            const res = await form(
              [
                { tag: "number", name: "rows", value: 9, min: 8, max: 24 },
                { tag: "number", name: "cols", value: 9, min: 8, max: 32 },
                { tag: "number", name: "mines", value: 10 },
              ],
              { label: "Custom" },
            )

            if (!res) return

            iframe.contentWindow.init("Custom", res.rows, res.cols, res.mines)
          },
        },
        "---",
        {
          label: "Options",
          content: [
            {
              label: "Troll mode",
              tag: "checkbox",
              value: () => iframe.contentWindow.troll,
              on: {
                change(e, target) {
                  iframe.contentWindow.troll = target.checked
                },
              },
            },
          ],
        },
        "---",
        app.menus.exit(),
      ],
    },
    app.menus.HelpMenu(),
  ]
}
