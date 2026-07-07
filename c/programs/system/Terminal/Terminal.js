import { os } from "../../../../42/api/os.js"
import { normalizeFilename } from "../../../../42/api/fs/normalizeFilename.js"
import { terminal } from "../../../../42/ui/interface/terminal.js"
import { untilAnimationEnd } from "../../../../42/lib/type/element/untilAnimationEnd.js"
import { sleep } from "../../../../42/lib/timing/sleep.js"

const GREET_PATH = "~/config/terminal/greet.txt"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  if (
    !app.config.exec &&
    !app.config.greet &&
    os.fileIndex.has(normalizeFilename(GREET_PATH))
  ) {
    const greet = await os.fs.readText(GREET_PATH)
    app.config.greet = greet
  }

  app.on("ready", async () => {
    await sleep(0)
    terminalEl.fit()
    await untilAnimationEnd(app.dialogEl)
    terminalEl.fit()
  })

  const terminalEl = terminal(app.config)
  return terminalEl
}
