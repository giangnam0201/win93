import { loadScript } from "../../../../42/api/load/loadScript.js"
import { App } from "../../../../42/api/os/App.js"
import { defer } from "../../../../42/lib/type/promise/defer.js"

const app = new App()

const ready = defer()

app.on("decode", async (fileAgent) => {
  await ready
  player.load(await fileAgent.getURL())
})

if (!app.file) app.openFile()

await loadScript("/c/libs/ruffle/0.1/ruffle.js")

// @ts-ignore
const { RufflePlayer } = window

RufflePlayer.config = {
  polyfills: false,
  showSwfDownload: true,
  contextMenu: "off",
  openUrlMode: "deny",
  allowNetworking: "internal",
  upgradeToHttps: false,
  favorFlash: false,
  compatibilityRules: false,
  LogLevel: "error",
}

const ruffle = RufflePlayer.newest()
const player = ruffle.createPlayer()

const style = document.createElement("style")
style.textContent = /* css */ `
  :host {
    --preloader-background: #000;
    --ruffle-orange: #fff;
  }
  .loading-animation,
  .logo { display: none !important; }
  .loadbar { background: #333; }
  #panic { background: #000; }
`
player.shadowRoot.append(style)

player.className = "fit"
document.body.className = "screen scroll-false"
document.body.append(player)

player.addEventListener("loadedmetadata", () => {
  const { metadata } = player.ruffle()
  if (metadata?.width && metadata?.height) {
    app.resize(metadata.width, metadata.height)
  }
})

ready.resolve()
