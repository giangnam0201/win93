/**
 * @param {import("42/api/os/App.js").App} app
 */
export function renderApp(app) {
  let iframe

  app.on("ready", () => {
    iframe = app.el.querySelector("iframe")
  })

  app.menubar = [
    {
      label: "Game",
      content: [
        app.registerAction({
          label: "Deal",
          shortcut: "F2",
          action: () => iframe.contentWindow.newGame(),
        }),
        "---",
        app.registerAction({
          label: "Retry this deck",
          shortcut: "F3",
          action: () => iframe.contentWindow.klondike(),
        }),
        {
          label: "F#*k it!",
          //shortcut: "F4",
          action: () => {
            //iframe.contentWindow.winGame()
            iframe.contentWindow.mrdoob()
          },
        },
        "---",
        app.menus.exit(),
      ],
    },
    app.menus.HelpMenu(),
  ]
}
