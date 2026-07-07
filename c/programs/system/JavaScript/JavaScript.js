import { uid } from "../../../../42/api/uid.js"

const instances = new Map()

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  const type =
    app.config?.type === "script"
      ? "text/javascript"
      : (app.config?.type ?? "module")

  let script

  app
    .on("decode", async (fileAgent) => {
      if (instances.has(fileAgent.path)) {
        const prevApp = instances.get(fileAgent.path)
        if (prevApp !== app) prevApp.destroy() // ensure liveReload once per script file
      }
      instances.set(fileAgent.path, app)

      const text = await fileAgent.getText()
      if (script?.textContent === text) return

      script?.remove()
      script = document.createElement("script")
      script.id = uid()
      script.className = "app-javascript"
      script.type = type
      script.textContent = text
      document.head.append(script)
    })
    .on("destroy", () => {
      if (app.file?.path) instances.delete(app.file.path)
      script?.remove()
    })
}
