import { sleep } from "../../lib/timing/sleep.js"
import { MediaNode } from "../../lib/audio/generator/MediaNode.js"
import { mixer } from "../../lib/audio/mixer.js"
import { RecyclePool } from "../../lib/structure/Pool.js"
import { cssVar } from "../../lib/cssom/cssVar.js"

const pool = new RecyclePool(
  () => {
    const node = new MediaNode(mixer.context, { type: "audio" })
    node.mediaElement.volume = 0.2
    node.connect(mixer.mainTrack)
    node.mediaElement.addEventListener("ended", () => {
      pool.recycle(node)
    })
    return node
  },
  { max: 5 },
)

export function playSound(src) {
  const node = pool.get()
  node.src = src
  node.play().catch((err) => {
    if (err.name === "AbortError") return
    console.log("system sound", err)
  })
  return node
}

export async function playSystemSound(registryName) {
  const val = cssVar.get(`--Sound-${registryName}`)
  if (!val) return

  // Extract path from 'url("path")' or '"path"'
  const match = val.match(/url\(["']?(.*?)["']?\)|["'](.*?)["']/)
  let src = match ? match[1] || match[2] : val
  try {
    src = decodeURIComponent(src)
  } catch {}

  return playSound(src)
}

export function systemSounds(options) {
  if (options?.skipStartupSound !== true) {
    if (mixer.context.state === "running") {
      playSystemSound("SystemStart")
    }
  }

  window.addEventListener("ui:trash.empty", () => {
    playSystemSound("EmptyRecycleBin")
  })

  window.addEventListener("ui:desktop.reboot", async () => {
    playSystemSound("SystemExit")

    await sleep(500)
    document.querySelector("#desktop ui-folder")?.classList.add("invisible")
    await sleep(500)
    document.querySelector("#taskbar")?.classList.add("hide")
    // TODO: wait for sound to finish
    await sleep(1000) // temp workaround
    location.href = location.pathname
  })

  window.addEventListener("ui:explorer.navigate", () => {
    playSystemSound("Navigating")
  })

  // MARK: Toasts
  // ------

  window.addEventListener("ui:toast.open", (e) => {
    if (e.target.classList.contains("ui-toast--error")) {
      playSystemSound("SystemNotification")
    } else {
      playSystemSound("Default")
    }
  })

  // MARK: Menus
  // -----------

  window.addEventListener("ui:menu.open", (e) => {
    if (e.target.openerEl?.id === "start") {
      playSystemSound("SystemStartMenu")
    } else {
      playSystemSound("MenuPopup")
    }
  })

  window.addEventListener("ui:menuitem.activate", () => {
    playSystemSound("MenuCommand")
  })

  // MARK: Dialogs
  // -------------

  window.addEventListener("ui:dialog.maximize", () => {
    playSystemSound("Maximize")
  })

  window.addEventListener("ui:dialog.restore", () => {
    playSystemSound("RestoreDown")
  })

  window.addEventListener("ui:dialog.minimize", () => {
    playSystemSound("Minimize")
  })

  window.addEventListener("ui:dialog.unminimize", () => {
    playSystemSound("RestoreUp")
  })

  window.addEventListener("ui:dialog.close", (e) => {
    if (e.target.app) {
      playSystemSound("Close")
    }
  })

  window.addEventListener("ui:dialog.open", async (e) => {
    if (e.target.sound === false) return

    await sleep(100)

    if (e.target.sound) {
      const node = pool.get()
      node.src = e.target.sound
      node.play()
    } else if (
      e.target.icon === "error" ||
      e.target.classList.contains("ui-dialog-alert--error")
    ) {
      playSystemSound("SystemHand")
    } else if (
      e.target.icon === "info" ||
      e.target.classList.contains("ui-dialog-about")
    ) {
      playSystemSound("SystemAsterisk")
    } else if (
      e.target.icon === "question" ||
      e.target.classList.contains("ui-dialog-confirm")
    ) {
      playSystemSound("SystemQuestion")
    } else if (
      e.target.icon === "warning" ||
      e.target.classList.contains("ui-dialog-alert")
    ) {
      playSystemSound("SystemExclamation")
    } else if (e.target.app) {
      playSystemSound("Open")
    }
  })
}
