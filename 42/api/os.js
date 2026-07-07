import "../core.js"
import "../ui/media/picto.js"
import { commandPalette } from "../ui/interface/commandPalette.js"
import { system as osSystem } from "./system.js"
import { appsManager } from "./os/managers/appsManager.js"
import { mimetypesManager } from "./os/managers/mimetypesManager.js"
import { iconsManager } from "./os/managers/iconsManager.js"
import { themesManager } from "./os/managers/themesManager.js"
import { trashManager } from "./os/managers/trashManager.js"
import { usersManager } from "./os/managers/usersManager.js"
import { fs } from "./fs.js"
import { fileIndex } from "./fileIndex.js"
import { http } from "./http.js"
import { render } from "./gui/render.js"
import { actions } from "./os/actions.js"
import { toast } from "../ui/layout/toast.js"
import { notif } from "../ui/layout/notif.js"
import { menu } from "../ui/layout/menu.js"
import { uid } from "./uid.js"
import { exec } from "./os/exec.js"
import { sleep } from "../lib/timing/sleep.js"
import { logger } from "./logger.js"
import { activity } from "../lib/timing/activity.js"
import { mixer } from "../lib/audio/mixer.js"
import { env } from "./env.js"
import { io } from "./io.js"
import { load } from "./load.js"
import { cursor } from "../lib/dom/cursor.js"
import { clipboard } from "./io/clipboard.js"
import { fileClipboard } from "./os/fileClipboard.js"
import { inDesktopRealm } from "./env/realm/inDesktopRealm.js"
import { getDesktopRealm } from "./env/realm/getDesktopRealm.js"
import { trap } from "./trap.js"
import { client } from "./os/network/client.js"
import { keep } from "./keep.js"
import { dialog, alert, confirm, prompt, form } from "../ui/layout/dialog.js"
import { chooseOtherApp, plans } from "./os/plans.js"
import {
  explorer,
  filePickerOpen,
  filePickerSave,
  folderPicker,
} from "../ui/desktop/explorer.js"
import { suspendIntensiveTasks } from "./os/suspendIntensiveTasks.js"

/**
 * @import { System } from "./system.js"
 * @import { AudioMixer } from "../lib/audio/mixer.js"
 * @import { WorkspacesComponent } from "../ui/desktop/workspaces.js"
 * @import { PlanObject } from "./gui/render.js"
 * @typedef {(PlanObject | "---")[]} MenuPlan
 *
 * @typedef {{
 *   uid: uid
 *   exec: exec
 *   sleep: sleep
 *   logger: logger
 *   activity: activity
 *   io: io
 *   http: http
 *   load: load
 *   fs: fs
 *   fileIndex: fileIndex
 *   fileClipboard: fileClipboard
 *   apps: appsManager
 *   icons: iconsManager
 *   themes: themesManager
 *   mimetypes: mimetypesManager
 *   trash: trashManager
 *   users: usersManager
 *   render: render
 *   dialog: dialog
 *   alert: alert
 *   confirm: confirm
 *   prompt: prompt
 *   form: form
 *   toast: toast
 *   notif: notif
 *   menu: menu
 *   explorer: explorer
 *   filePickerOpen: filePickerOpen
 *   filePickerSave: filePickerSave
 *   folderPicker: folderPicker
 *   cursor: cursor
 *   clipboard: clipboard
 *   mixer: AudioMixer
 *   network: {client: client}
 *   plans: plans
 *   actions: actions
 *   dialogs: dialogs
 *   showCommandPalette: Function
 *   workspaces?: WorkspacesComponent
 *   env: env
 *   bios: any
 *   kernel: any
 *   desktop: any
 *   transfer: any
 * }} OsAugment
 *
 * @typedef {System & OsAugment} Os
 */

/** @type {Os} */
export const os = /** @type {Os} */ (osSystem)

globalThis.os = os

Object.defineProperties(os.env, Object.getOwnPropertyDescriptors(env))
os.env.realm.inDesktopRealm = inDesktopRealm
os.env.getDesktopRealm = getDesktopRealm
os.env.desktop = { isFullscreen: false }

os.network = { client }
if (window.name === "desktop") {
  client.connect()
  // .then(() => {
  //   if (client.registration?.active && !client.controller) {
  //     toast({
  //       label: "Oops",
  //       picto: "warning",
  //       message:
  //         "Teh Service Worker has been disabled due to a hard refresh. Some features may not operate as intended.",
  //     })
  //   }
  // })
}

os.uid = uid
os.exec = exec
os.sleep = sleep
os.logger = logger
os.activity = activity
os.io = io

os.http = http
os.load = load

os.fs = fs
os.fileIndex = fileIndex
os.fileClipboard = fileClipboard

os.apps = appsManager
os.icons = iconsManager
os.themes = themesManager
os.mimetypes = mimetypesManager
os.trash = trashManager
os.users = usersManager

os.render = render

os.dialog = dialog
os.alert = alert
os.confirm = confirm
os.prompt = prompt
os.form = form

os.toast = toast
os.notif = notif

os.menu = menu

os.explorer = explorer
os.filePickerOpen = filePickerOpen
os.filePickerSave = filePickerSave
os.folderPicker = folderPicker

os.cursor = cursor
os.clipboard = clipboard
os.mixer = mixer

export { actions }

export const dialogs = {
  chooseOtherApp,
}

os.plans = plans
os.actions = actions
os.dialogs = dialogs

os.kernel = {}
os.kernel.suspendIntensiveTasks = suspendIntensiveTasks

let busy = false
os.bios?.forgetTrap?.()
if (os.bios?.errors?.length > 0) {
  try {
    alert(os.bios.errors.shift(), { label: "BIOS ERROR" })
  } catch {}
  for (const err of os.bios.errors) {
    console.group("BIOS ERROR")
    console.log(err)
    console.groupEnd()
  }
}
os.bios = {}
os.bios.done = true
os.kernel.forgetTrap = trap((err, { label, reports }) => {
  if (reports) {
    logger.group(label)
    logger.log(reports)
    logger.groupEnd()
  }

  if (busy) {
    logger.log(err)
    return false
  }

  busy = true

  void (async () => {
    await alert(err)
    busy = false
  })()

  return false
})

// MARK: Link exec handler
// -----------------------

document.addEventListener(
  "click",
  (e) => {
    if (!e.isTrusted) return
    const el = /** @type {HTMLElement} */ (e.target)
    const link = el.closest("a")
    if (!link || link.hasAttribute("data-skip-exec")) return
    const href = link.getAttribute("href")
    if (
      link &&
      link.origin === location.origin &&
      link.protocol === location.protocol &&
      !href.startsWith("#")
    ) {
      e.preventDefault()
      os.exec(`"${decodeURI(link.pathname)}"`)
    }
  },
  { capture: true },
)

// MARK: Fullscreen
// ----------------

if (inDesktopRealm) {
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === null) {
      os.env.desktop.isFullscreen = false
    } else if (
      document.fullscreenElement === document.documentElement &&
      !document.documentElement.classList.contains("has-dialog-fullscreen")
    ) {
      os.env.desktop.isFullscreen = true
    }
  })
}

// MARK: Command Palette
// ---------------------

/**
 * @import {CommandPaletteComponent} from "../ui/interface/commandPalette.js"
 */

let history
async function showCommandPalette(options) {
  let palette = /** @type {CommandPaletteComponent} */ (
    document.querySelector("ui-command-palette")
  )

  history ??= await keep("~/config/palette.json5", {})

  if (!palette) {
    palette = commandPalette(options)
    palette.history = history
    document.documentElement.append(palette)
  } else if (options) {
    Object.assign(palette, options)
    palette.history = history
  }
}

os.showCommandPalette = showCommandPalette
