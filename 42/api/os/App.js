/* eslint-disable complexity */
import { FileAgent } from "./FileAgent.js"
import { Canceller } from "../../lib/class/Canceller.js"
import { Emitter } from "../../lib/class/Emitter.js"
import { on } from "../../lib/event/on.js"
import { queueTask } from "../../lib/timing/queueTask.js"
import { defer } from "../../lib/type/promise/defer.js"
import { fs } from "../fs.js"
import { kill } from "../lab/helper/kill.js"
import { uaParser } from "../env/parseUserAgent.js"
import { fileIndex } from "../fileIndex.js"
import { filePickerOpen, filePickerSave } from "../../ui/desktop/explorer.js"
import { fileImport } from "../io/fileImport.js"
import { getDirname } from "../../lib/syntax/path/getDirname.js"
import { joinPath } from "../../lib/syntax/path/joinPath.js"
import { preserveFocus } from "../../lib/dom/focus.js"
import { isPlanObject } from "../gui/render.js"
import { configure } from "../configure.js"
import { toggleFullscreen } from "../../lib/browser/toggleFullscreen.js"
import { reloadIframe } from "../../lib/dom/reloadIframe.js"
import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { isPromiseLike } from "../../lib/type/any/isPromiseLike.js"
import { inTop } from "../env/realm/inTop.js"
import { inDesktopRealm } from "../env/realm/inDesktopRealm.js"
import { transferable } from "../gui/trait/transferable.js"
import { launchAbout } from "./launchAbout.js"
import { untilIframeEditable } from "../../lib/timing/untilIframeEditable.js"
import { keep } from "../keep.js"
import { ensureURL } from "./ensureURL.js"
import { untilIdle } from "../../lib/timing/untilIdle.js"
import {
  dialog,
  alert,
  DialogComponent,
  extractDialogOptions,
} from "../../ui/layout/dialog.js"
import {
  normalizeDecode,
  normalizeEncode,
  normalizeManifest,
} from "./managers/appsManager/normalizeManifest.js"
import { pointer } from "../env/device/pointer.js"
import { getDesktopRealm } from "../env/realm/getDesktopRealm.js"
import { appsManager } from "./managers/appsManager.js"
import { normalizeFilename } from "../fs/normalizeFilename.js"

/** @import {AudioApp} from "./AudioApp.js" */

const INSTANCES = new Map()

let desktopRealm
let doc
let osName

/** @type {import("./managers/mimetypesManager.js").mimetypesManager} */
let mimetypesManager

/** @type {import("./managers/iconsManager.js").iconsManager} */
let iconsManager

/** @type {import("../../ui/desktop/explorer.js").explorer} */
let explorer

/** @type {import("./network/client.js").client} */
let client

/** @type {import("../../lib/audio/mixer.js").mixer} */
let mixer

/** @type {import("./trays.js").tray} */
let tray

function lazyTray(manifest, module) {
  if (tray) {
    tray(manifest, module)
  } else {
    import("./trays.js").then((m) => {
      tray = m.tray
      tray(manifest, module)
    })
  }
}

/** @type {import("./suspendIntensiveTasks.js").suspendIntensiveTasks} */
let suspendIntensiveTasks

/** @param {(restore: () => void) => void} fn */
function lazySuspendIntensiveTasks(fn) {
  if (suspendIntensiveTasks) {
    fn(suspendIntensiveTasks())
  } else {
    import("./suspendIntensiveTasks.js").then((m) => {
      suspendIntensiveTasks = m.suspendIntensiveTasks
      fn(suspendIntensiveTasks())
    })
  }
}

/**
 * @returns {app is AudioApp}
 */
function isAudioApp(app) {
  return app.manifest.hasAudioInput
}

/**
 * @param {App} app
 */
function makeAppMenus(app) {
  const menus = {
    // FileMenu
    newFile: () =>
      app.registerAction({
        label: "New",
        picto: "file",
        shortcut: "Alt+N", // Ctrl+N sur mac
        action: () => app.loadFile(),
      }),
    openFile: () =>
      app.registerAction({
        label: "Open…",
        picto: "folder-open",
        shortcut: "Ctrl+O",
        action: () => app.openFile(),
      }),
    saveFile: () =>
      app.registerAction({
        label: "Save",
        picto: "save",
        shortcut: "Ctrl+S",
        action: () => app.saveFile(),
      }),
    saveFileAs: () =>
      app.registerAction({
        label: "Save As…",
        shortcut: "Ctrl+Shift+S",
        action: () => app.saveFileAs(),
      }),
    // saveAll: () =>
    //   app.registerAction({
    //     disabled: true,
    //     label: "Save All",
    //     action: () => alert("saveAll not ready"),
    //   }),
    importFile: () =>
      app.registerAction({
        label: "Import…",
        picto: "import",
        action: () => app.importFile(),
        // action: () => alert("importFile not ready"),
      }),
    exportFile: () =>
      app.registerAction({
        // disabled: app.files.length === 0,
        label: "Export…",
        picto: "export",
        action: () => alert("exportFile not ready"),
      }),
    exit: () =>
      app.registerAction({
        label: "Exit",
        // shortcut: inFirefox ? "Ctrl+K" : "Ctrl+Q",
        shortcut: "Ctrl+K",
        skipShortcutRegister: true,
        action: () => {
          if (app.dialogEl) app.dialogEl.close()
          else window.close()
        },
      }),

    // ViewMenu
    fullscreen: (el, force) =>
      app.registerAction({
        label: "Full Screen",
        disabled: !document.fullscreenEnabled,
        action: () => app.toggleFullscreen(el, force),
      }),
    openInNewTab: () =>
      app.registerAction({
        label: "Open in New Tab",
        action: () => alert("openInNewTab not ready"),
      }),

    // HelpMenu
    install: () => {
      osName ??= uaParser().os.name
      return app.registerAction({
        label: `Install on ${osName} desktop`,
        action: () => alert("install not ready"),
      })
    },
    about: () =>
      app.registerAction({
        label: "About",
        shortcut: "F1",
        action: () => app.about(),
      }),
  }

  menus.FileMenu = () => ({
    label: "File",
    content: [
      menus.newFile(), //
      menus.openFile(),
      menus.saveFile(),
      menus.saveFileAs(),
      // menus.saveAll(),
      "---",
      menus.importFile(),
      menus.exportFile(),
      "---",
      menus.exit(),
    ],
  })

  menus.ViewMenu = () => ({
    label: "View",
    content: [
      menus.fullscreen(), //
      // menus.openInNewTab(),
    ],
  })

  menus.HelpMenu = () => ({
    label: "Help",
    content: [
      // menus.install(), //
      menus.about(),
    ],
  })

  return menus
}

// MARK: launch
// ============

async function addIframeAppId(app) {
  const win = await untilIframeEditable(app.iframeEl)
  const doc = win.document

  const script = doc.createElement("script")
  script.textContent = `
window.APP_INIT = {
  id: "${app.id}",
  manifest: ${JSON.stringify(app.manifest)},
  options: ${JSON.stringify(app.config)},
}`
  doc.head.append(script)

  if (app.actions) {
    requestIdleCallback(() => {
      const script = doc.createElement("script")
      script.type = "module"
      script.textContent = `
import { on } from "${location.origin}/42/lib/event/on.js"
window.parent.sys42?.apps.listenIframeActions("${app.id}", document.body, on)`
      doc.head.append(script)
    })
  }
}

export async function launch(manifest, options, AppClass = App) {
  await untilIdle({ timeout: 2000 })

  if (manifest.solo === true) {
    for (const item of appsManager.launched.values()) {
      if (item.command === manifest.command) return item
    }
  }

  const app = new AppClass(manifest, options)

  if (app.command === "explorer") {
    explorer ??= await import("../../ui/desktop/explorer.js") //
      .then((m) => m.explorer)

    const explorerEl = await explorer(app.config._[0], app.config.dialog)
    app.el = explorerEl
    app.dialogEl = explorerEl.dialogEl
    app.destroy = () => queueMicrotask(() => app.dialogEl.close())
    app.dialogEl.signal.addEventListener("abort", () => app.destroy())
    app.ready.resolve()
    return app
  }

  app.pending = true

  let module
  let content

  if (manifest.module) {
    module = await import(await ensureURL(app.resolveURL(manifest.module)))

    // MARK: launchApp
    if (module.launchApp) {
      let el
      try {
        el = await module.launchApp(app)
      } catch (err) {
        alert(err)
        console.log(err)
        app.destroy()
        return app
      }

      if (el instanceof DialogComponent) app.dialogEl = el
      else if (el) app.el = el

      if (module.destroyApp) {
        app.destroy = () => {
          module.destroyApp(app)
          queueMicrotask(() => app.dialogEl?.close())
        }
      } else {
        app.destroy = app.dialogEl
          ? () => queueMicrotask(() => app.dialogEl?.close())
          : () => queueMicrotask(() => kill(app.el))
      }

      app.ready.resolve()
      return app
    }

    // MARK: renderApp
    let isRendering = false
    if (module.renderApp) {
      try {
        content = await module.renderApp(app)
        isRendering = true
      } catch (err) {
        alert(err)
        app.destroy()
        return app
      }
    }

    if (module.execApp) {
      module.execApp(app)
    }

    if (!isRendering) return
  }

  if (manifest.document || !content) {
    const path = manifest.document
      ? app.resolveURL(manifest.document)
      : app.paths[0]
        ? normalizeFilename(app.paths[0])
        : undefined

    const src = path ? await ensureURL(path).catch(() => path) : undefined

    // Make sure the service worker is awake
    client ??= await import("./network/client.js") //
      .then((m) => m.client)

    await client.wake()

    const isIframeViewer = app.command === "iframe"
    const isSameOrigin =
      new URL(path, location.origin).origin === location.origin

    const iframePlan = {
      tag: "iframe",
      name: app.command,
      credentialless: !isSameOrigin,
      style: isIframeViewer ? { background: "#fff" } : undefined,
      src,
      created: path
        ? async (iframeEl) => {
            const { signal } = app
            fileIndex.watch(path, { signal }, async () => {
              iframeEl.src = await ensureURL(path).catch(() => path)
            })
          }
        : undefined,
      onload:
        isIframeViewer && isSameOrigin
          ? async ({ target }) => {
              const doc = target.contentWindow.document
              const script = doc.createElement("script")
              script.type = "module"
              script.textContent = `
import { liveReload } from "${location.origin}/42/lib/dom/liveReload.js"
window.parent.sys42?.apps.addIframeLiveReload("${app.id}", liveReload)`
              doc.head.append(script)
            }
          : undefined,
    }

    content = content ? [content, iframePlan] : iframePlan
  }

  // MARK: dialog
  // ------------

  const buttons = { before: [], after: [] }

  if (isAudioApp(app)) {
    // buttons.after.push(
    //   {
    //     tag: "button.ui-dialog__button.ui-dialog__button--bypass",
    //     aria: { pressed: true },
    //     picto: "bypass",
    //     on: {
    //       click: (e, target) => {
    //         app.toggleBypass()
    //         target.ariaPressed = String(!app.bypassed)
    //       },
    //     },
    //   },
    //   {
    //     tag: "button.ui-dialog__button.ui-dialog__button--source",
    //     picto: "jack-socket",
    //     aria: { label: "Audio Source" },
    //     onclick: () => {
    //       app.selectAudioIO()
    //     },
    //   },
    // )

    if (app.manifest.hideBypassButton !== true) {
      buttons.before.push({
        tag: "button.ui-dialog__button.ui-dialog__button--bypass",
        aria: { pressed: true },
        picto: "bypass",
        title: "Bypass",
        onclick: () => app.toggleBypass(),
      })
    }
    if (app.manifest.hideAudioIOButton !== true) {
      buttons.after.push({
        tag: "button.ui-dialog__button.ui-dialog__button--source",
        picto: "jack-socket",
        title: "Audio I/O",
        // aria: { label: "Audio I/O" },
        onclick: () => app.selectAudioIO(),
      })
    }
  }

  if (app.hasAbout()) {
    buttons.after.push({
      tag: "button.ui-dialog__button.ui-dialog__button--about",
      picto: "help",
      aria: { label: "About" },
      onclick: () => app.about(),
    })
  }

  let planDialogOptions
  if (isPlanObject(content)) {
    planDialogOptions = content.dialog
    delete content.dialog
  }

  const dialogConfig = configure(
    {
      app,
      id: app.id,
      geometryKind: manifest.command,
      label: options?.name ?? manifest.name,
      class: { [`app__${manifest.command}`]: true },
      aria: { busy: true },

      buttons,

      picto: options?.picto ?? manifest.picto ?? app.getIcon("16x16"),

      on: { "ui:dialog.close": () => queueMicrotask(() => app.destroy()) },

      beforeContent: app.menubar
        ? { tag: "ui-menubar", content: app.menubar }
        : undefined,

      content,
    },
    app.config.dialog,
    planDialogOptions,
  )

  if (app.config.zoom > 1) {
    if (Number.isFinite(dialogConfig.width)) {
      dialogConfig.width *= app.config.zoom
    }
    if (Number.isFinite(dialogConfig.height)) {
      dialogConfig.height *= app.config.zoom
    }
  }

  if (dialogConfig.maximized === "{{pointer.isTouch}}") {
    if (pointer.isTouch) dialogConfig.maximized = true
    else delete dialogConfig.maximized
  }

  if (isAudioApp(app)) {
    dialogConfig.pivotKind = "audio-app"
    // dialogConfig.pivot = "top-left"
  }

  const dialogEl = await dialog(dialogConfig)

  app.dialogEl = dialogEl
  app.el = dialogEl.bodyEl
  app.iframeEl = dialogEl.iframeEl

  if (app.iframeEl) {
    try {
      addIframeAppId(app)
    } catch (err) {
      console.log(err)
    }
  }

  app.destroy = () => {
    if (module?.destroyApp) {
      module.destroyApp(app)
      module = undefined
      queueMicrotask(() => app.dialogEl.close())
    } else {
      app.dialogEl.close()
    }
  }

  app.ready.resolve()
  module?.startApp?.(app)

  // MARK: renderTray
  if (module?.renderTray) lazyTray(manifest, module)

  return app
}

// MARK: App
// =========

/**
 * @template {App} Self
 */
export class App extends Emitter {
  /** @type {HTMLElement} */
  el
  /** @type {DialogComponent} */
  dialogEl
  /** @type {HTMLIFrameElement} */
  iframeEl
  /** @type {import("../gui/render.js").Plan} */
  menubar

  /** @type {boolean | PromiseLike} */
  pending

  currentFileIndex = 0

  /** @type {Self} */
  parentApp
  /** @type {Self} */
  childApp

  /** @type {FileAgent[]} */
  files = []

  config = {}

  static async launch(manifest, options) {
    return launch(manifest, options, this)
  }

  static async tray(manifest) {
    return lazyTray(manifest)
  }

  constructor(manifest, options) {
    super()
    this.ready = defer()

    let id

    desktopRealm ??= getDesktopRealm()
    doc ??= desktopRealm.document
    this.desktopRealm = desktopRealm

    // @ts-ignore
    const { APP_INIT } = window

    if (APP_INIT) {
      id = APP_INIT.id
      manifest = APP_INIT.manifest
      options = APP_INIT.options

      // @ts-ignore
      delete window.APP_INIT

      this.el ??= document.body

      if (window.frameElement) {
        this.dialogEl = window.frameElement.closest("ui-dialog")
      }

      // @ts-ignore
      window.$app = this

      let launched
      try {
        launched = desktopRealm.sys42?.apps?.launched
      } catch {}

      if (launched) {
        const parentApp = launched.get(id)
        if (parentApp) {
          Object.assign(this, parentApp)
          this.parentApp = parentApp
          parentApp.childApp = this
          this.index = parentApp.index
        }
      }
    }

    if (manifest) {
      this.#init(id, manifest, options)
    } else {
      let base = document.URL.replace(/[#?].*$/, "")
      if (base.endsWith("/")) base += "index.html"
      const pathname = decodeURI(new URL(base).pathname)
      const manifestPath = joinPath(getDirname(pathname), "app.manifest.json5")

      fs.readJSON5(manifestPath).then(async (manifest) => {
        manifest.manifestPath = manifestPath
        this.el ??= document.body
        await normalizeManifest(manifest)
        this.#init(id, manifest, options)

        if (inTop) {
          /** @type {HTMLLinkElement} */
          let link = document.querySelector("link[rel~='icon']")
          if (!link) {
            link = document.createElement("link")
            link.rel = "icon"
            link.href = this.getIcon("16x16")
            document.head.append(link)
          }
        }
      })
    }
  }

  #init(id, manifest, options) {
    const currentIndex = INSTANCES.get(manifest.command) ?? 0
    this.index = currentIndex
    INSTANCES.set(manifest.command, currentIndex + 1)

    id ??= `app__${manifest.command}__${this.index}`

    if (this.desktopRealm === window) {
      appsManager.launched.set(id, this)
      if (manifest.suspendIntensiveTasks) {
        lazySuspendIntensiveTasks((restore) => {
          this.restoreIntensiveTasks = restore
        })
      }
    }

    this.id = id
    this.name = manifest.name
    this.command = manifest.command

    this.multifile = manifest.multifile
    this.manifest = manifest

    if (this.signal === undefined) {
      const { signal, cancel } = new Canceller()
      this.signal = signal
      this.cancel = cancel
    }

    if (manifest.options) Object.assign(this.config, manifest.options)

    if (options) {
      if (Array.isArray(options)) options = { _: options }
      else if (typeof options === "string") options = { _: [options] }

      if (options.shell) {
        this.shell = options.shell
        delete options.shell
      }

      Object.assign(this.config, options)
    }

    const runtimeDialogOpts = extractDialogOptions(this.config)
    this.config.dialog = configure(manifest.dialog, runtimeDialogOpts)

    this.config.zoom ??= manifest.zoom ?? 1
    this.config._ = options?._ ? [options?._].flat() : []
    if (this.config.file) this.config._.push(this.config.file)
    if (this.config.files) this.config._.push(...this.config.files)

    if (manifest.decode) {
      this.files.length = 0
      for (const path of this.config._) {
        this.files.push(new FileAgent(this, path))
      }
    }

    this.setTitleListener = () => {
      if (!this.dialogEl) return
      const title = this.file.getName()
      if (title) this.setTitle(title)
    }

    this.on("decode", this.setTitleListener)

    this.ready.then(async () => {
      this.setTitle()

      if (this.actions) on(this.el, this.actions)

      if (this.stateReady) await this.stateReady

      this.emit("ready")
      this.#setTransferable()

      queueTask(() => {
        if (this.dialogEl) this.dialogEl.removeAttribute("aria-busy")
        for (const fileAgent of this.files) fileAgent.emitDecode()
      })
    })

    this.menus = makeAppMenus(this)

    doc.addEventListener(
      "fullscreenchange",
      () => {
        if (!doc.fullscreenElement) {
          this.dialogEl?.classList.remove("dialog-fullscreen")
          doc.documentElement.classList.remove("has-dialog-fullscreen")
          this.emit("fullscreenChange", false)
        }
      },
      { signal: this.signal },
    )

    queueMicrotask(() => {
      if (this.pending) {
        if (isPromiseLike(this.pending)) {
          this.pending.then(() => this.ready.resolve())
        }
      } else {
        this.ready.resolve()
      }
    })
  }

  #setTransferable() {
    if (!this.manifest.decode || this.parentApp) return

    let dropzone = this.el
    if (!inDesktopRealm || (inTop && window.name !== "desktop")) {
      dropzone = document.body
    }

    if (!dropzone) return

    transferable(dropzone, {
      signal: this.signal,
      items: false,
      accept: { mimetype: "*" },
      effects: ["move"],
      import: ({ paths, files }) => {
        if (paths?.length > 0) {
          for (const path of paths) this.loadFile(path)
        } else if (files && Object.keys(files).length > 0) {
          for (const file of Object.values(files)) this.loadFile(file)
        } else {
          return "revert"
        }
        return "restore"
      },
    })
  }

  setTitle(title, suffix = this.name) {
    if (!this.dialogEl) return
    const indexSuffix = !title && this.index > 0 ? ` (${this.index + 1})` : ""
    this.dialogEl.title = `${title ?? ""}${title ? " - " : ""}${suffix}${indexSuffix}`
  }

  get title() {
    return this.dialogEl?.title ?? this.name
  }

  get paths() {
    return this.config._
  }

  async restart(options) {
    console.log(this.name + " restart")

    if (this.parentApp) {
      return this.parentApp.restart(options)
    }

    if (this.iframeEl) {
      for (const fileAgent of this.files) fileAgent.destroy()
      this.files.length = 0
      this.config._.length = 0
      try {
        await reloadIframe(this.iframeEl)
        this.setTitle()
        await this.resize()
        if (options) Object.assign(this.config, options)
        this.config.restarted = true
        addIframeAppId(this)
      } catch {}
    } else {
      location.reload()
    }
  }

  #destroyed = false
  #destroy
  get destroy() {
    return () => {
      if (this.#destroyed) return
      this.restoreIntensiveTasks?.()
      this.emit("destroy")
      this.#destroyed = true
      this.ready.resolve()
      this.off("*")
      this.cancel()
      this.#destroy?.()
      appsManager.launched.delete(this.id)

      if (this.parentApp) return
      const currentCount = INSTANCES.get(this.command) ?? 1
      if (currentCount <= 1) INSTANCES.delete(this.command)
      else INSTANCES.set(this.command, currentCount - 1)
    }
  }
  set destroy(value) {
    this.#destroy = value
  }

  /** @type {FileAgent} */
  get file() {
    return this.files[this.currentFileIndex]
  }

  /** @param {FileAgent | string} path */
  set file(path) {
    const fileAgent =
      path instanceof FileAgent ? path : new FileAgent(this, path)
    this.files[this.currentFileIndex]?.destroy()
    this.files[this.currentFileIndex] = fileAgent
    fileAgent.emitDecode()
  }

  #encode
  get encode() {
    if (this.parentApp) return this.parentApp.encode
    if (this.#encode) return this.#encode

    if (this.manifest.encode) {
      this.#encode = normalizeEncode(this.manifest, { combine: true })
    } else if (this.manifest.decode) {
      this.#encode = { ...this.decode }
      this.#encode.excludeAcceptAllOption ??= true
    }

    return this.#encode
  }

  #decode
  get decode() {
    if (this.parentApp) return this.parentApp.decode
    this.#decode ??= normalizeDecode(this.manifest, { combine: true })
    return this.#decode
  }

  getActions() {
    return {
      prevent: true,
      ...this.actions,
    }
  }

  #aboutInMenu
  actions
  registerAction(menuItemPlan) {
    if (menuItemPlan.action) {
      const { action } = menuItemPlan

      if (String(action).includes("app.about")) {
        this.#aboutInMenu = true
      }

      menuItemPlan.action = async (...args) => {
        preserveFocus(() => action(...args))
      }

      if (menuItemPlan.shortcut && menuItemPlan.skipShortcutRegister !== true) {
        this.actions ??= { prevent: true, signal: this.signal }
        this.actions[menuItemPlan.shortcut] = menuItemPlan.action
      }
    }

    return menuItemPlan
  }

  getIcon(size) {
    return appsManager.getAppIcon(this.manifest, size)
  }

  get picto() {
    return this.getIcon("16x16")
  }

  async resize(width, height, options) {
    if (this.dialogEl) {
      // TODO: check if possible to resize dialog when in fullscreen
      if (this.isFullscreen()) return

      if (isHashmapLike(width)) {
        options = width
      } else {
        options ??= {}
        options.width = width
        options.height = height
      }

      options.width ??= this.manifest.dialog.width
      options.height ??= this.manifest.dialog.height

      if (this.config.zoom !== 1) {
        if (Number.isFinite(options.width)) {
          options.width *= this.config.zoom
        }

        if (Number.isFinite(options.height)) {
          options.height *= this.config.zoom
        }
      }

      await this.dialogEl.resize(options)
    }
  }

  isFullscreen() {
    return (
      this.dialogEl?.classList.contains("dialog-fullscreen") ??
      document.fullscreenElement
    )
  }

  async toggleFullscreen(el, force) {
    if (el) {
      toggleFullscreen(el, force)
    } else if (this.dialogEl) {
      this.dialogEl.classList.toggle("dialog-fullscreen", force)

      const isFullscreen = doc.documentElement.classList.toggle(
        "has-dialog-fullscreen",
        force,
      )

      // Enter/Exit fullscreen if desktop isn't in fullscreen mode
      if (!desktopRealm.sys42.env.desktop.isFullscreen) {
        toggleFullscreen(doc.documentElement, isFullscreen)
      }
    } else {
      toggleFullscreen(doc.documentElement, force)
    }

    this.emit("fullscreenChange", this.isFullscreen())
  }

  preventMultiple() {
    if (!this.multifile) {
      this.currentFileIndex = 0
      for (const fileAgent of this.files) fileAgent.destroy()
      this.files.length = 0
    }
  }

  resolveURL(url) {
    return new URL(url, this.manifest.manifestURL).href
  }

  /* MARK: LiveReload
  ------------------- */
  #liveReload
  #forgetOnChange
  get liveReload() {
    return this.#liveReload
  }
  set liveReload(liveReload) {
    this.#liveReload = liveReload
    const { signal } = this
    this.#forgetOnChange?.()
    if (!this.iframeEl) return
    let dirname
    try {
      const url = new URL(this.iframeEl.src)
      if (url.origin !== location.origin) return
      dirname = getDirname(url.pathname)
    } catch {
      return
    }
    if (dirname === "/") return
    this.#forgetOnChange = fileIndex.on(
      "change",
      { signal, off: true },
      (path) => {
        if (path.startsWith("/c/users/") && path.endsWith(".json5")) return
        if (path.startsWith(dirname)) this.#liveReload(path)
      },
    )
  }

  /* MARK: Audio Track
  -------------------- */
  async getAudioTrack() {
    mixer ??= await import("../../lib/audio/mixer.js") //
      .then((m) => m.mixer)

    if (mixer.tracks.has(this.id)) {
      return mixer.tracks.get(this.id)
    }

    const { signal } = this
    return new Promise((resolve) => {
      const forget = mixer.tracks.on("add", { signal, off: true }, (track) => {
        if (track.id === this.id) {
          resolve(track)
          forget()
        }
      })
    })
  }

  /* MARK: about
  -------------- */
  hasAbout() {
    return Boolean(
      !this.#aboutInMenu &&
        (this.manifest.about ||
          this.manifest.description ||
          this.manifest.license ||
          this.manifest.authors),
    )
  }

  async about() {
    return launchAbout(this)
  }

  /* MARK: getSavePath
  ------------------- */
  busyDialogs = {}
  async getSavePath(options) {
    if (this.busyDialogs.getSavePath) {
      if (this.busyDialogs.getSavePath === true) return
      return void queueTask(() => this.busyDialogs.getSavePath.activate?.())
    }
    this.busyDialogs.getSavePath = true

    mimetypesManager ??= await import("./managers/mimetypesManager.js") //
      .then((m) => m.mimetypesManager)

    await Promise.all([this.ready, mimetypesManager.ready])

    const res = await filePickerSave(
      configure(
        {
          path: this.file?.path,
          suggestedName: this.file?.getName(),
          id: this.manifest.command,
          title: `Save File — ${this.name}`,
          picto: this.getIcon("16x16"),
          signal: this.signal,
          dialog: {
            created: (el) => {
              this.busyDialogs.getSavePath = el
            },
          },
        },
        this.encode,
        options,
      ),
    )

    this.busyDialogs.getSavePath = false

    if (!res.ok) return false
    return res.selection[0]
  }

  /* MARK: loadFile
  ----------------- */
  /**
   * @param {string | Blob} [pathOrFile]
   * @param {{silent?: boolean}} [options]
   */
  loadFile(pathOrFile, options) {
    this.preventMultiple()
    const fileAgent = new FileAgent(this, pathOrFile)
    this.currentFileIndex = this.files.push(fileAgent) - 1
    if (options?.silent !== true) fileAgent.emitDecode()
    return fileAgent
  }

  /* MARK: saveFile
  ----------------- */
  async saveFile(options) {
    if (!this.file?.path) return this.saveFileAs(options)
    const data = await this.ask("encode", this.file.path)
    if (data === false) return false
    return this.file.setData(data)
  }

  /* MARK: saveFileAs
  ------------------- */
  async saveFileAs(options) {
    const res = await this.getSavePath(options)
    if (res === false) return false
    this.preventMultiple()
    const fileAgent = new FileAgent(this, res)
    this.currentFileIndex = this.files.push(fileAgent) - 1
    return this.saveFile()
  }

  /* MARK: importFile
  ------------------- */
  async importFile() {
    const res = await fileImport({
      startIn: this.decode?.startIn,
      id: this.manifest.command,
      multiple: this.multifile,
      ...this.decode,
    })

    if (!res) return false

    this.preventMultiple()

    for (const file of res) {
      const fileAgent = new FileAgent(this, file)
      this.files.push(fileAgent)
      fileAgent.emitDecode()
    }
  }

  /* MARK: openFile
  ----------------- */
  async openFile(dirname) {
    if (this.busyDialogs.openFile) {
      if (this.busyDialogs.openFile === true) return
      return void queueTask(() => this.busyDialogs.openFile.activate?.())
    }
    this.busyDialogs.openFile = true

    iconsManager ??= await import("./managers/iconsManager.js") //
      .then((m) => m.iconsManager)

    mimetypesManager ??= await import("./managers/mimetypesManager.js") //
      .then((m) => m.mimetypesManager)

    await Promise.all([this.ready, mimetypesManager.ready, iconsManager.ready])

    const examples = this.manifest.dirPath + "examples/"

    const res = await filePickerOpen(
      configure(
        {
          path: dirname,
          startIn:
            this.decode?.startIn ??
            (fileIndex.has(examples) ? examples : undefined),
          id: this.manifest.command,
          multiple: this.multifile,
          title: `Open File — ${this.name}`,
          picto: this.getIcon("16x16"),
          signal: this.signal,
          dialog: {
            created: (el) => {
              this.busyDialogs.openFile = el
            },
          },
        },
        this.decode,
      ),
    )

    this.busyDialogs.openFile = false

    if (!res.ok) return false

    this.preventMultiple()

    for (const path of res.selection) {
      const fileAgent = new FileAgent(this, path)
      this.files.push(fileAgent)
      fileAgent.emitDecode()
    }
  }

  /* MARK: State
  -------------- */

  #state
  statePath
  statePathDir = "apps"
  stateReady
  get state() {
    return this.#state
  }
  async initState(path, state) {
    if (!this.manifest) await this.ready
    this.stateReady = defer()
    if (typeof path === "string") {
      this.statePath = path
    } else {
      state = path
    }
    this.statePath ??= `~/config/${this.statePathDir}/${this.manifest.command}.json5`
    this.#state = await keep(this.statePath, state)
    this.stateReady.resolve()
    return this.#state
  }
  async updateState(state) {
    if (!this.manifest) await this.ready
    if (!this.#state) await this.initState()
    for (const [key, val] of Object.entries(state)) {
      this.#state[key] ??= val
    }
    return this.#state
  }
  async deleteState() {
    if (!this.manifest) await this.ready
    if (!this.statePath) return
    return keep.delete(this.statePath)
  }

  /* MARK: toString
  ----------------- */

  [Symbol.toPrimitive]() {
    return this.id
  }

  toString() {
    return this[Symbol.toPrimitive]()
  }

  toJSON() {
    return this.config
  }
}
