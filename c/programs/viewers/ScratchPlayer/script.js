/* global P */

import { fs } from "../../../../42/api/fs.js"
import { App } from "../../../../42/api/os/App.js"

const player = new P.player.Player()
player.addControls()
document.querySelector("#player")?.append(player.root)

const app = new App()

app.on("decode", async (fileAgent) => {
  player.loadProjectFromFile(await fileAgent.getBlob())
})

document.querySelector("#folder-open")?.addEventListener("click", () => {
  app.openFile()
})

if (!app.file) {
  const blob = await fs.open(
    decodeURIComponent(
      new URL("./js/Projet Scratch.sb3", import.meta.url).pathname,
    ),
  )
  player.loadProjectFromFile(blob)
}
