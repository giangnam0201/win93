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
        {
          label: "New Character",
          action: () => {
            iframe.src = import.meta.resolve("./newguy.html")
          },
        },
        {
          label: "Roster",
          disabled: () => {
            const roster = localStorage.getItem("roster")
            if (!roster || Object.keys(JSON.parse(roster)).length === 0) {
              return true
            }
          },
          action: () => {
            iframe.src = import.meta.resolve("./index.html")
          },
        },
        "---",
        app.menus.exit(),
      ],
    },
    app.menus.HelpMenu(),
  ]
}
