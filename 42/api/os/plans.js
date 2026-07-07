/* eslint-disable max-depth */
/* eslint-disable complexity */
import { getDirname } from "../../lib/syntax/path/getDirname.js"
import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { allocate } from "../../lib/type/object/allocate.js"
import { locate } from "../../lib/type/object/locate.js"
import { dialog } from "../../ui/layout/dialog.js"
import { fileIndex } from "../fileIndex.js"
import { logger } from "../logger.js"
import { appsManager } from "./managers/appsManager.js"
import { iconsManager } from "./managers/iconsManager.js"
import { getIconFromPath } from "./managers/iconsManager/getIconFromPath.js"
import { mimetypesManager } from "./managers/mimetypesManager.js"
import { toTitleCase } from "../../lib/type/string/transform.js"
import { actions } from "./actions.js"

/**
 * @import { PlanObject } from "./../gui/render.js"
 * @typedef {(PlanObject | "---")[]} MenuPlan
 */

// MARK: recursiveMenuItems
// ------------------------

export function recursiveMenuItems(parent, obj) {
  const cats = Object.entries(obj)
  cats.sort((a, b) => a[0].localeCompare(b[0]))
  for (let [label, content] of cats) {
    label = toTitleCase(label)
    if (Array.isArray(content)) {
      parent.push({
        label,
        picto: "places/folder",
        content,
      })
    } else {
      const arr = []
      parent.push({
        label,
        picto: "places/folder",
        content: arr,
      })
      recursiveMenuItems(arr, content)
    }
  }
}

// MARK: chooseOtherApp
// --------------------

export async function chooseOtherApp(val, cb) {
  const menuItems = await makeAppsMenuItems(val, {
    action(e, target) {
      cb(target.textContent)
      if (!e.ctrlKey) dialogEl?.close()
    },
  })
  const dialogEl = await dialog({
    label: "Choose Application",
    maximizable: false,
    minimizable: false,
    pivot: "center",
    geometryKind: "choose-app",
    width: 300,
    height: 400,
    content: {
      tag: "ui-menu.inset.w-full",
      content: menuItems,
    },
  })
}

// MARK: makeOpenedFileContextMenu
// -------------------------------

/**
 *
 * @param {{selection: string[]}} param0
 * @returns {Promise<MenuPlan>}
 */
export async function makeOpenedFileContextMenu({ selection }) {
  return [
    {
      label: "Open With",
      // picto: "window",
      async content() {
        const items = await makeAppsMenuItems(selection)
        if (items.length > 0) items.push("---")
        items.push({
          label: "Other Application…",
          action: () =>
            chooseOtherApp({ mimetype: "*" }, async (appName) => {
              import("./managers/appsManager.js").then(({ appsManager }) => {
                appsManager.launch(appName, selection)
              })
            }),
        })
        return items
      },
    },
    {
      ...actions.openContainingFolder.meta,
      action: () => actions.openContainingFolder(selection),
    },
    "---",
    { ...actions.cutFile.meta, action: () => actions.cutFile(selection) },
    { ...actions.copyFile.meta, action: () => actions.copyFile(selection) },
    {
      ...actions.copyLocation.meta,
      action: () => actions.copyLocation(selection),
    },
  ]
}

// MARK: makeFileContextMenu
// -------------------------

/**
 *
 * @param {{selection: string[]}} param0
 * @returns {Promise<MenuPlan>}
 */
export async function makeFileContextMenu({ selection }) {
  if (selection.length === 1 && selection[0] === "") return []
  const isInTrash = selection[0].startsWith("/trash/")
  return [
    { ...actions.launchFile.meta, action: () => actions.launchFile(selection) },
    ...(await makeOpenedFileContextMenu({ selection })),
    "---",
    { ...actions.exportFile.meta, action: () => actions.exportFile(selection) },
    "---",
    isInTrash
      ? {
          ...actions.deleteFile.meta,
          action: () => actions.deleteFile(selection),
        }
      : {
          ...actions.moveFileToTrash.meta,
          action: () => actions.moveFileToTrash(selection),
        },
    "---",
    { ...actions.renameFile.meta, action: () => actions.renameFile(selection) },
  ]
}

// MARK: makeFolderContextMenu
// ---------------------------

/**
 *
 * @param {{selection: string[]}} param0
 * @returns {Promise<MenuPlan>}
 */
export async function makeFolderContextMenu({ selection }) {
  if (selection.length === 1 && selection[0] === "") return []
  const isInTrash = selection[0].startsWith("/trash/")
  return [
    {
      ...actions.launchFolder.meta,
      action: () => actions.launchFolder(selection),
    },
    "---",
    { ...actions.cutFile.meta, action: () => actions.cutFile(selection) },
    { ...actions.copyFile.meta, action: () => actions.copyFile(selection) },
    {
      ...actions.copyLocation.meta,
      action: () => actions.copyLocation(selection),
    },
    "---",
    {
      ...actions.exportFolder.meta,
      action: () => actions.exportFolder(selection),
    },
    "---",
    isInTrash
      ? {
          ...actions.deleteFolder.meta,
          action: () => actions.deleteFolder(selection),
        }
      : {
          ...actions.moveFolderToTrash.meta,
          action: () => actions.moveFolderToTrash(selection),
        },
    "---",
    { ...actions.renameFile.meta, action: () => actions.renameFile(selection) },
  ]
}

// MARK: makeMenuItemsFromDir
// --------------------------

export async function makeMenuItemsFromDir(dirname, options) {
  const items = []

  const onEach = options?.onEach ?? ((item) => item)

  for (const path of fileIndex.readDir(dirname, { absolute: true })) {
    if (
      options?.hideEmpty &&
      path.endsWith("/") &&
      fileIndex.readDir(path).length === 0
    ) {
      continue
    }

    items.push(
      getIconFromPath(path, "16x16").then((infos) =>
        onEach(
          {
            label: infos.name + infos.ext,
            picto: infos.image,
            action: path.endsWith("/")
              ? undefined
              : () => {
                  logger.log(infos.command, path)
                  import("./exec.js").then(({ exec }) =>
                    infos.command ? exec(infos.command) : exec(path),
                  )
                },
            content: path.endsWith("/")
              ? () => makeMenuItemsFromDir(path, options)
              : undefined,
          },
          infos,
        ),
      ),
    )
  }

  return Promise.all(items)
}

// MARK: makeAppsMenuItems
// --------------------------

/**
 * @param {any} val
 * @param {{
 *   action?: Function,
 *   catalogue?: boolean
 *   groupBy?: string | RegExp
 * }} [options]
 * @returns {Promise<MenuPlan>}
 */
export async function makeAppsMenuItems(val, options) {
  await appsManager.ready

  const paths = []
  let sort

  if (typeof val === "string") {
    val =
      val in appsManager.value
        ? [appsManager.getManifest(val)]
        : await appsManager.lookup(val)
  } else if (Array.isArray(val)) {
    await mimetypesManager.ready

    const counts = {}

    const appNames = new Set()
    for (const item of val) {
      if (item in appsManager.value) appNames.add(item)
      else {
        paths.push(item)
        const { apps } = mimetypesManager.lookup(item)
        for (const app of apps) {
          appNames.add(app)
          counts[app] = (counts[app] ?? 0) + 1
        }
      }
    }

    val = []
    for (const appName of appNames) {
      if (appName in appsManager.value) {
        val.push(appsManager.getManifest(appName))
      }
    }

    val.sort((a, b) => counts[b.name] - counts[a.name])
  } else if (isHashmapLike(val)) {
    if ("mimetype" in val) {
      sort = true
      const { mimetype } = val
      const appNames = new Set()
      for (const { apps } of mimetypesManager.list(mimetype, {
        withApps: true,
      })) {
        for (const appName of apps) {
          if (appName in appsManager.value) appNames.add(appName)
        }
      }

      val = []
      for (const appName of appNames) {
        if (appName in appsManager.value) {
          val.push(appsManager.getManifest(appName))
        }
      }
    } else if ("category" in val) {
      const includes = []
      const excludes = []

      for (const item of typeof val.category === "string"
        ? val.category.split(/\s*,\s*/)
        : val.category) {
        if (item.startsWith("!")) excludes.push(item.slice(1).toLowerCase())
        else includes.push(item.toLowerCase())
      }

      val = []

      main: for (const manifest of Object.values(appsManager.value)) {
        if (!manifest.categories) continue

        for (let cat of manifest.categories) {
          cat = cat.toLowerCase()
          for (const item of excludes) {
            if (cat === item) continue main
          }

          if (includes.includes(cat)) val.push(manifest)
        }

        if (includes.length === 0) val.push(manifest)
      }
    }
  } else if (!val) {
    sort = true
    val = Object.values(appsManager.value) //
  }

  if (sort) val.sort((a, b) => a.name.localeCompare(b.name))

  const menuItems = []
  let genericAppIcon

  let grouped
  let groupByCategory
  let groupByPath

  if (options?.groupBy) {
    grouped = {}
    if (options.groupBy === "category") {
      groupByCategory = true
    } else {
      groupByPath = options.groupBy
    }
  }

  for (const manifestItem of val) {
    const { name, icons, catalogable } = manifestItem
    if (options?.catalogue === true && catalogable === false) continue

    const menuItem = {
      label: name,
      action: options?.action ?? (() => appsManager.launch(name, paths)),
    }

    for (const { sizes, src } of icons) {
      if (sizes === "16x16") {
        menuItem.picto = src
        break
      }

      menuItem.picto = src
    }

    if (!menuItem.picto) {
      genericAppIcon ??= await iconsManager.getIconPath("apps/generic", "16x16")
      menuItem.picto = genericAppIcon
    }

    if (grouped) {
      if (groupByPath) {
        const segments = locate.segmentize(
          getDirname(manifestItem.manifestPath.replace(groupByPath, "")),
          "/",
        )

        if (segments.length !== 1) segments.pop()
        if (segments.length === 0) continue

        let arr = locate.run(grouped, segments)

        if (!arr) {
          arr = []
          allocate.run(grouped, segments, arr)
        }

        arr.push(menuItem)
      } else if (groupByCategory) {
        const category = manifestItem.categories?.[0] ?? "Unknown"
        grouped[category] ??= []
        grouped[category].push(menuItem)
      }
    } else {
      menuItems.push(menuItem)
    }
  }

  if (grouped) {
    recursiveMenuItems(menuItems, grouped)
  }

  return menuItems
}

// MARK: getFolderShortcutHandlers
// --------------------------------

/**
 * Returns shortcut handlers map for a folder component.
 * Shortcuts are derived automatically from the file/folder context menu builders,
 * so any shortcut added to those menus is automatically registered here.
 *
 * @param {import("../../ui/media/folder.js").FolderComponent} folder
 * @returns {Promise<Record<string, boolean | function(): void>>}
 */
export async function getFolderShortcutHandlers(folder) {
  // Call menus with placeholder paths (no DOM involved) to collect all unique
  // shortcuts — both trash and non-trash variants to get full coverage
  const [fileItems, trashFileItems, folderItems, trashFolderItems] =
    await Promise.all([
      makeFileContextMenu({ selection: ["/.placeholder"] }),
      makeFileContextMenu({ selection: ["/trash/.placeholder"] }),
      makeFolderContextMenu({ selection: ["/.placeholder/"] }),
      makeFolderContextMenu({ selection: ["/trash/.placeholder/"] }),
    ])

  /** @type {any[]} */
  const allItems = [
    ...fileItems,
    ...trashFileItems,
    ...folderItems,
    ...trashFolderItems,
  ]

  const shortcuts = new Set()
  for (const item of allItems) {
    if (item?.shortcut) shortcuts.add(item.shortcut)
  }

  // Background shortcuts not present in file/folder selection menus
  for (const { meta } of [
    actions.createFolder,
    actions.createFile,
    actions.createShortcut,
    actions.pasteTo,
  ]) {
    if (meta.shortcut) shortcuts.add(meta.shortcut)
  }

  const handlers = { prevent: true }

  for (const shortcut of shortcuts) {
    handlers[shortcut] = async () => {
      const { selection } = /** @type {{ selection: string[] }} */ (
        folder.selectable
      )

      if (shortcut === actions.deleteFile.meta.shortcut) {
        actions.deleteFile(selection)
        return
      }

      if (shortcut === actions.pasteTo.meta.shortcut) {
        actions.pasteTo(folder.value, folder)
        return
      }

      if (shortcut === actions.createFile.meta.shortcut) {
        folder.createFile()
      } else if (shortcut === actions.createFolder.meta.shortcut) {
        folder.createFolder()
      } else if (shortcut === actions.createShortcut.meta.shortcut) {
        folder.createShortcut()
      }

      if (selection.length === 0) {
        return
      }

      const hasFolders = selection.some((p) => p.endsWith("/"))
      const hasFiles = selection.some((p) => !p.endsWith("/"))

      /** @type {any[]} */
      const items = await (hasFolders && !hasFiles
        ? makeFolderContextMenu({ selection })
        : makeFileContextMenu({ selection }))

      const item = items.find((i) => i?.shortcut === shortcut)
      item?.action?.()
    }
  }

  return handlers
}

export const plans = {
  makeOpenedFileContextMenu,
  makeFileContextMenu,
  makeFolderContextMenu,
  makeMenuItemsFromDir,
  makeAppsMenuItems,
  getFolderShortcutHandlers,
}
