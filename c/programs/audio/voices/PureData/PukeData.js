/**
 * @param {import("42/api/os/App.js").App} app
 */
export function renderApp(app) {
  const state = {
    viewCode: false,
  }

  app.menubar = [
    app.menus.FileMenu(), //
    {
      label: "View",
      content: [
        app.menus.fullscreen(),
        "---",
        {
          tag: "checkbox",
          label: "View Code",
          value: () => state.viewCode,
          on: {
            change(e, target) {
              state.viewCode = target.checked
              app.emit("state", state)
            },
          },
        },
      ],
    },
    app.menus.HelpMenu(),
  ]
}
