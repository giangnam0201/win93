/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  let iframe
  let win

  app.on("ready", () => {
    iframe = app.el.querySelector("iframe")
    win = iframe.contentWindow
  })

  // function isMode(mode) {
  //   if (!win.state) return false
  //   return mode === win.state.mode
  // }

  // function changeMode(mode) {
  //   if (!win.setMode) return
  //   win.setMode(mode)
  // }

  function isDifficulty(difficulty) {
    if (!win.state) return false
    return difficulty === win.state.difficulty
  }

  function changeDifficulty(difficulty) {
    if (!win.setDifficulty) return
    win.setDifficulty(difficulty)
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
        // {
        //   label: "Mode",
        //   content: [
        //     {
        //       tag: "radio",
        //       name: "mode",
        //       value: "Normal",
        //       checked: () => isMode("normal"),
        //       onchange: () => changeMode("normal"),
        //     },
        //     {
        //       tag: "radio",
        //       name: "mode",
        //       value: "Reverse",
        //       checked: () => isMode("reverse"),
        //       onchange: () => changeMode("reverse"),
        //     },
        //   ],
        // },
        {
          label: "Difficulty",
          content: [
            {
              tag: "radio",
              name: "level",
              value: "Easy",
              checked: () => isDifficulty("easy"),
              onchange: () => changeDifficulty("easy"),
            },
            {
              tag: "radio",
              name: "level",
              value: "Normal",
              checked: () => isDifficulty("normal"),
              onchange: () => changeDifficulty("normal"),
            },
            {
              tag: "radio",
              name: "level",
              value: "Hard",
              checked: () => isDifficulty("hard"),
              onchange: () => changeDifficulty("hard"),
            },
          ],
        },
        "---",
        app.menus.exit(),
      ],
    },
    {
      label: "Help",
      content: [
        {
          label: "Controls",
          action: () => {
            if (!globalThis.os) return
            globalThis.os.exec(
              new URL("./controls.md", import.meta.url).pathname,
            )
          },
        },
        app.menus.about(),
      ],
    },
  ]
}
