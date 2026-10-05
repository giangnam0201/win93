/**
 * @param {import("42/api/os/App.js").App} app
 */
export function renderApp(app) {
  app.menubar = [
    {
      label: "File",
      content: [
        app.menus.openFile(), //
        "---",
        app.menus.exit(),
      ],
    },
    {
      label: "View",
      content: () => [
        app.menus.fullscreen(), //
      ],
    },
    app.menus.HelpMenu(),
  ]
}
