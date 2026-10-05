/**
 * @param {import("../../../../42/api/os/App.js").App} app
 */
export function renderApp(app) {
  return {
    tag: "iframe",
    name: app.command,
    style: { background: "#fff" },
    src: `/desktop.html?v=${Date.now()}`,
  }
}
