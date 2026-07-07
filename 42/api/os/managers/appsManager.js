// @see https://github.com/w3c/manifest/wiki/Categories
// @see https://specifications.freedesktop.org/menu-spec/latest/category-registry.html

import { ConfigFile } from "../ConfigFile.js"
import { arrify } from "../../../lib/type/any/arrify.js"
import { fileIndex } from "../../fileIndex.js"
import { mimetypesManager } from "./mimetypesManager.js"
import { iconsManager } from "./iconsManager.js"
import { normalizeManifest } from "./appsManager/normalizeManifest.js"
import { fs } from "../../fs.js"
import { explorer } from "../../../ui/desktop/explorer.js"
import { App } from "../App.js"
import { WatchMap } from "../../../lib/structure/WatchMap.js"
import { Emittable } from "../../../lib/class/mixin/Emittable.js"
import { isPlainObject } from "../../../lib/type/any/isPlainObject.js"
import { joinPath } from "../../../lib/syntax/path/joinPath.js"
import { toast } from "../../../ui/layout/toast.js"
import { CBOR } from "../../../formats/data/CBOR.js"
import { updateCache } from "../../../lib/browser/updateCache.js"
import { noop } from "../../../lib/type/function/noop.js"
import { d } from "../../../lib/date/getSortableDateTime.js"
import { encodePath } from "../../encodePath.js"
import { getActiveVJController } from "./appsManager/vjSession.js"

let AudioApp

const globalOptions = globalThis.sys42?.options?.apps ?? {}
globalOptions.manifestGlob ??= "**/*app.manifest.json5"

const base = location.pathname.endsWith('/') ? location.pathname : location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
const APPS_FILE = base + "apps.cbor"

class AppsManager extends Emittable(ConfigFile) {
  /** @type {WatchMap<string, App>} */
  launched = new WatchMap()

  async setup() {
    fileIndex.watch(globalOptions.manifestGlob, async (path, mode) => {
      // console.log(1, mode, path)
      if (mode === "set") await this.add(path, { update: true })
      else if (mode === "delete") await this.delete(path)
    })

    if (navigator.onLine) {
      await updateCache(APPS_FILE)
      const res = await fetch(APPS_FILE, { method: "HEAD" })
      if (res.status === 200) {
        const version = new Date(res.headers.get("Last-Modified")).getTime()
        if (version > this.version) {
          console.debug(
            `--- appsManager update needed (${d(version)} > ${d(this.version)}) ---`,
          )
          await this.updateAll({ clearCache: false })
        }
      }
    }
  }

  async fetchManifests() {
    const res = await fetch(APPS_FILE)
    if (res.status === 200) {
      const version = new Date(res.headers.get("Last-Modified")).getTime()
      this.version = version
      return CBOR.decode(await res.arrayBuffer())
    }
    return fileIndex.glob(globalOptions.manifestGlob)
  }

  async updateAll(options) {
    if (!navigator.onLine) return
    if (options?.clearCache !== false) await updateCache(APPS_FILE)
    const manifests = await this.fetchManifests()
    await Promise.all(
      manifests.map(async (manifest) => {
        await normalizeManifest(manifest)
        const old = this.value[manifest.command]
        if (old) {
          if (old.modified === manifest.modified) return
          console.debug(`update ${manifest.name} (${d(manifest.modified)})`)
          await fs.deleteDir(manifest.dirPath).catch(noop)
        }
        console.debug(`create ${manifest.name}`)
        await fileIndex.upgrade(manifest.dirPath)
        await this.add(manifest, { update: true })
      }),
    ).catch((err) => {
      console.log(err)
    })

    await this.save() // Force save to update version
  }

  async populate() {
    this.value = {}

    const items = await this.fetchManifests()
    await Promise.all(items.map((item) => this.add(item, { save: false })))

    if (globalOptions.defaultApps) {
      await mimetypesManager.ready
      for (const [mimetype, command] of Object.entries(
        globalOptions.defaultApps,
      )) {
        mimetypesManager.setDefaultApp(mimetype, command)
      }
    }

    return this.value
  }

  // MARK: delete
  // ------------

  async delete(manifestPath) {
    for (const key in this.value) {
      if (Object.hasOwn(this.value, key)) {
        const manifest = this.value[key]
        if (manifest.manifestPath === manifestPath) {
          const res = await this.ask("delete", manifest)
          if (res === false) return
          delete this.value[key]
          return this.save()
        }
      }
    }
  }

  // MARK: add
  // ---------

  addedDesktops = []

  async add(manifestPath, options) {
    let manifest

    if (typeof manifestPath === "string") {
      try {
        manifest = await fs.readJSON5(manifestPath)
      } catch {
        return
      }

      if (isPlainObject(manifest)) {
        if (!manifest.name) return
        manifest.manifestPath = manifestPath
      } else if (Array.isArray(manifest)) {
        for (const item of manifest) {
          item.manifestPath = manifestPath
        }
      } else return
    } else {
      manifest = manifestPath
    }

    if (Array.isArray(manifest)) {
      for (const item of manifest) {
        if (item.name) this.add(item, options)
      }
      return
    }

    // if (!manifest.command) return

    await normalizeManifest(manifest)

    if (options?.update !== true && manifest.command in this.value) {
      toast(
        `Impossible to install ${manifest.name}, the command "${manifest.command}" is already used.`,
        {
          label: "App Manager Error",
          picto: "error",
        },
      )
      return
    }

    if (manifest.decode?.types) {
      await Promise.all([mimetypesManager.ready, iconsManager.ready])

      const undones = []
      for (const { accept, icons } of manifest.decode.types) {
        if (icons) {
          for (const icon of icons) {
            const sizes = icon.sizes.split(" ")[0]

            const defaultIconsDir = iconsManager.getDefaultIconsDir()

            const src = joinPath(manifest.dirPath, icon.src)

            const dest = `${defaultIconsDir}${sizes}${src.slice(
              src.indexOf(sizes) + sizes.length,
            )}`

            fs.link(src, dest).catch((cause) => {
              const err = new Error(
                `This icon for ${manifest.name} cannot be found '${src}'`,
                { cause },
              )
              toast(err, {
                label: "App Manager Error",
                picto: "error",
              })
            })
          }
        }

        undones.push(
          mimetypesManager.add(accept, manifest.command, {
            defaultApp: options?.defaultApp,
          }),
        )
      }

      await Promise.all(undones)
    }

    this.value[manifest.command] = manifest
    this.emit("add", manifest)

    if (manifest.tray) App.tray(manifest)

    const displayName = manifest.displayName ?? manifest.name

    const content = `[Desktop Entry]\nName="${displayName}"\nExec="${manifest.command}"`

    fs.writeText(`${manifest.dirPath + manifest.command}.desktop`, content)

    // let prefix = "~/desktop"
    // if (
    //   manifest.categories?.includes("Emulator") &&
    //   manifest.name !== "Flash Player"
    // ) {
    //   prefix += "/Emulators"
    // }
    // if (manifest.categories?.includes("Audio")) {
    //   prefix += "/Audio"
    // }
    // this.addedDesktops.push(
    //   fs.writeText(`${prefix}/${manifest.command}.desktop`, content),
    // )

    // if (
    //   (manifest.terminal !== true || manifest.desktop === true) &&
    //   manifest.desktop !== false
    // ) {
    //   let prefix = "~/desktop"
    //   if (
    //     manifest.categories?.includes("Emulator") &&
    //     manifest.name !== "Flash Player"
    //   ) {
    //     prefix += "/Emulators"
    //   }
    //   this.addedDesktops.push(
    //     fs.writeText(`${prefix}/${manifest.command}.desktop`, content),
    //   )
    // }

    if (options?.save !== false) return this.save()
  }

  // MARK: getManifest
  // -----------------

  getManifest(appName) {
    if (appName in this.value) return this.value[appName]
    for (const key in this.value) {
      if (Object.hasOwn(this.value, key)) {
        if (this.value[key].name === appName) return this.value[key]
      }
    }
  }

  // MARK: launch
  // ------------

  async launch(appName, options) {
    await this.ready

    const manifest = this.getManifest(appName)

    if (!manifest) {
      throw new Error(`Unknown app: ${appName}`)
    }

    if (manifest.hasAudioInput) {
      AudioApp ??= (await import("../AudioApp.js")).AudioApp
      return AudioApp.launch(manifest, options)
    }

    if (manifest.multiple !== true) {
      if (Array.isArray(options)) options = { _: options }
      if (options?._?.length > 1) {
        return Promise.all(
          options._.map((path) =>
            App.launch(manifest, { ...options, _: [path] }),
          ),
        )
      }
    }

    return App.launch(manifest, options)
  }

  // MARK: open
  // ----------

  async open(paths, options) {
    await this.ready
    await mimetypesManager.ready

    const openers = {}
    const vjController = getActiveVJController()
    const vjPaths = []

    for (const path of arrify(paths)) {
      let { pathname } = new URL(encodePath(path), "file:")
      pathname = decodeURI(pathname)

      if (fileIndex.isDir(pathname)) {
        explorer(pathname, options)
        continue
      }

      const { apps: appNames } = mimetypesManager.lookup(pathname)
      const appName = appNames[0] ?? "iframe"

      if (vjController?.canRouteApp?.(appName, pathname)) {
        vjPaths.push(pathname)
        continue
      }

      openers[appName] ??= {}
      const opener = openers[appName]
      opener._ ??= []
      opener._.push(pathname)
    }

    if (vjPaths.length > 0) {
      await vjController.addMedia(vjPaths)
    }

    const apps = []

    for (const [appName, { _ }] of Object.entries(openers)) {
      apps.push(this.launch(appName, { ...options, _ }))
    }

    if (typeof paths === "string") {
      if (vjPaths.length > 0) return vjController.app
      const app = await apps[0]
      if (Array.isArray(app)) return app[0]
      return app
    }

    if (vjPaths.length > 0) apps.unshift(Promise.resolve(vjController.app))

    return apps
  }

  // MARK: lookup
  // ------------

  async lookup(path) {
    await this.ready
    await mimetypesManager.ready
    const { apps: appNames } = mimetypesManager.lookup(path)

    const out = []

    for (const appName of appNames) {
      const manifest = this.getManifest(appName)
      if (manifest) out.push(manifest)
    }

    return out
  }

  // MARK: getAppIcon
  // -----------------

  getAppIcon(appName, size = "32x32") {
    const manifest =
      typeof appName === "string" //
        ? this.getManifest(appName)
        : appName

    let appIcon

    if (manifest?.icons) {
      for (const { sizes, src } of manifest.icons) {
        if (sizes === size) {
          appIcon = src
          break
        }

        appIcon = src
      }
    }

    return appIcon ?? iconsManager.fallbackAppIcon[size]
  }

  // MARK: createDesktopIcon
  // -----------------------

  createDesktopIcon(appName) {
    const manifest =
      typeof appName === "string" //
        ? this.getManifest(appName)
        : appName

    if (!manifest) return

    const displayName = manifest.displayName ?? manifest.name
    return `[Desktop Entry]\nName="${displayName}"\nExec="${manifest.command}"`
  }

  // MARK: writeDesktopIcon
  // ----------------------

  writeDesktopIcon(dirPath, appName) {
    const manifest =
      typeof appName === "string" //
        ? this.getManifest(appName)
        : appName

    if (!manifest) return

    const content = this.createDesktopIcon(manifest)
    const path = joinPath(dirPath, `${manifest.command}.desktop`)
    fs.writeText(path, content)
    return path
  }

  // MARK: initTrays
  // ---------------

  initTrays() {
    for (const key in this.value) {
      if (!Object.hasOwn(this.value, key)) continue
      if (this.value[key].tray) App.tray(this.value[key])
    }
  }

  // MARK: listenIframeActions
  // -------------------------

  listenIframeActions(id, el, on) {
    const app = this.launched.get(id)
    if (!app) return
    on(el, app.actions)
  }

  // MARK: addIframeLiveReload
  // -------------------------

  addIframeLiveReload(id, liveReload) {
    const app = this.launched.get(id)
    if (!app) return
    app.liveReload = liveReload
  }
}

export const appsManager = new AppsManager("config/apps.json5")

// TODO: improve circular reference (App > os > appsManager)
function checkIfAppInitilized() {
  try {
    if (App !== undefined) return true
  } catch {
    return false
  }
}

if (checkIfAppInitilized()) appsManager.init()
else {
  const intervalId = setInterval(() => {
    if (checkIfAppInitilized()) {
      appsManager.init()
      clearInterval(intervalId)
    }
  }, 100)
}

if (globalThis.document) {
  let parseExec
  let transferable
  document.addEventListener("ui.check-icon-app", async ({ target: icon }) => {
    if (!transferable) {
      const res = await Promise.all([
        import("../../os/exec.js").then(({ parseExec }) => parseExec),
        import("../../gui/trait/transferable.js").then(
          ({ transferable }) => transferable,
        ),
      ])
      parseExec = res[0]
      transferable = res[1]
    }

    let res
    try {
      res = await parseExec(icon.command)
    } catch {
      return
    }

    if (icon.signal.aborted || icon.isFolder || !icon.command) return
    if (res.type === "app" && res.manifest.decode) {
      icon.toggleAttribute("app", true)
      icon.transferable?.destroy()
      icon.transferable = transferable(icon, {
        kind: "42_TR_ICON",
        accept: { mimetype: "*" },
        effects: ["move", "copy"],
        dragoverOutline: false,
        items: false,
        import({ paths }) {
          res.run({ _: paths })
          return "restore"
        },
      })
    }
  })
}
