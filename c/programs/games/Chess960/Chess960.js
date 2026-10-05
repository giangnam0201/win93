/**
 * @param {import("42/api/os/App.js").App} app
 */
export function renderApp(app) {
  let iframe
  let win

  app.on("ready", () => {
    iframe = app.el.querySelector("iframe")
    win = iframe.contentWindow
  })

  function isDifficulty(difficulty) {
    return difficulty === win.state.difficulty
  }

  function changeDifficulty(difficulty) {
    win.state.difficulty = difficulty
  }

  app.menubar = [
    {
      label: "Game",
      content: [
        app.registerAction({
          label: "New Game",
          shortcut: "F2",
          action: () => win.newGame(),
        }),
        "---",
        {
          label: "Mode",
          content: [
            {
              tag: "radio",
              name: "mode",
              value: "classic",
              checked: () => win.state.mode === "classic",
              onchange: () => {
                if (win.state.mode === "classic") return
                win.state.mode = "classic"
                win.newGame()
              },
            },
            {
              tag: "radio",
              name: "mode",
              value: "960",
              checked: () => win.state.mode === "960",
              onchange: () => {
                if (win.state.mode === "960") return
                win.state.mode = "960"
                win.newGame()
              },
            },
          ],
        },
        {
          label: "Difficulty",
          content: [
            {
              tag: "radio",
              name: "level",
              value: "1",
              checked: () => isDifficulty(1),
              onchange: () => changeDifficulty(1),
            },
            {
              tag: "radio",
              name: "level",
              value: "2",
              checked: () => isDifficulty(2),
              onchange: () => changeDifficulty(2),
            },
            {
              tag: "radio",
              name: "level",
              value: "3",
              checked: () => isDifficulty(3),
              onchange: () => changeDifficulty(3),
            },
            {
              tag: "radio",
              name: "level",
              value: "4",
              checked: () => isDifficulty(4),
              onchange: () => changeDifficulty(4),
            },
            {
              tag: "radio",
              name: "level",
              value: "5",
              checked: () => isDifficulty(5),
              onchange: () => changeDifficulty(5),
            },
          ],
        },
        "---",
        app.menus.exit(),
      ],
    },
    {
      label: "View",
      content: [
        {
          label: "Zoom 100%",
          action: () => {
            app.dialogEl.resize(
              app.manifest.dialog.width,
              app.manifest.dialog.height,
            )
          },
        },
        {
          label: "Zoom 200%",
          action: () => {
            app.dialogEl.resize(
              app.manifest.dialog.width * 2,
              app.manifest.dialog.height * 2,
            )
          },
        },
        "---",
        app.menus.fullscreen(),
      ],
    },
    app.menus.HelpMenu(),
  ]
}
