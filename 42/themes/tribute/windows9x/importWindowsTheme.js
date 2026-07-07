import { fs } from "../../../api/fs.js"
import { fileIndex } from "../../../api/fileIndex.js"
import { INI } from "../../../formats/data/INI.js"
import { ICO } from "../../../formats/container/ICO.js"
import { getDirname } from "../../../lib/syntax/path/getDirname.js"
import { joinPath } from "../../../lib/syntax/path/joinPath.js"
import { locate } from "../../../lib/type/object/locate.js"
import { toast } from "../../../ui/layout/toast.js"
import { encodePath } from "../../../api/encodePath.js"
import { ensureURL } from "../../../api/os/ensureURL.js"
import { WALLPAPER_STYLES } from "../../../api/os/managers/themesManager.js"
import { getExtname } from "../../../lib/syntax/path/getExtname.js"

/** @import { FolderComponent } from "../../../ui/media/folder.js" */

const WALLPAPER_STYLES_VALUES = Object.values(WALLPAPER_STYLES)

// https://learn.microsoft.com/en-us/dotnet/api/system.drawing.stockiconid?view=windowsdesktop-10.0&viewFallbackFrom=windowsdesktop-5.0
const ADDITIONAL_ICONS = {
  // ActiveXCache: "",
  // Briefcase: "",
  // CommonProgramGroup: "",
  ControlPanel: "places/folder-development",
  Desktop: "places/folder-desktop",
  // DialUpNetworking: "",
  Drive35: "devices/drive-storage",
  // Drive525: "",
  // DriveCD: "",
  DriveHard: "devices/drive-harddisk",
  // DriveNetwork: "",
  // DriveNetworkOff: "",
  // DriveRAM: "",
  // DriveRemove: "",
  // EntireNetwork: "",
  Favorites: "places/folder-bookmark",
  // FileApplication: "",
  // FileAudioCD: "",
  // FileBatch: "",
  // FileDefaultDoc: "",
  // FileDefaultIcon: "",
  // FileGroupCompression: "",
  // FileGroupDocument: "",
  // FileGroupImage: "",
  // FileGroupInternet: "",
  // FileGroupMovie: "",
  // FileGroupSound: "",
  // FileGroupText: "",
  // FileShare: "",
  // FileShortcut: "",
  // FileSystem: "",
  // FileSystemSettings: "",
  // Find: "",
  FolderClosed: "places/folder",
  FolderOpened: "places/folder-open",
  // Help: "",
  // History: "",
  // InternetExplorer: "",
  // Logoff: "",
  // NetworkComputer: "",
  // NetworkTree: "",
  // Printer: "",
  // Printers: "",
  // ProgramGroup: "",
  // Programs: "",
  // Run: "",
  // ScheduledTasks: "",
  // Settings: "",
  // Shutdown: "",
  // StartDocuments: "",
  // Subscriptions: "",
  // Suspend: "",
  // Taskbar: "",
  // UnDock: "",
  // WebFolders: "",
  // Workgroup: "",
}

const CURSORS = {
  AppStarting: "progress",
  Arrow: "default",
  Crosshair: "crosshair",
  // DefaultValue: "",
  Help: "help",
  IBeam: "text",
  Link: "pointer",
  // NWPen: "",
  No: "not-allowed",
  SizeAll: "move", // all-scroll ?
  SizeNESW: "nesw-resize",
  SizeNS: "ns-resize",
  SizeNWSE: "nwse-resize",
  SizeWE: "ew-resize",
  // UpArrow: "",
  Wait: "wait",
}

async function resolveThemeAsset(path, dirname) {
  path = path
    .replace(/c:\\windows\\/i, "")
    .replace(/%windir%/i, "")
    .replace(/%systemroot%/i, "")
    .replace(/%themedir%/i, "")
    .replace(/resources\\themes\\/i, "")
    .replace(/web\\wallpaper\\/i, "")
    .replaceAll("\\", "/")
    .replace(/,\d+$/, "")

  let realPath = locate(fileIndex.value, joinPath(dirname, path), {
    delimiters: "/",
    ignoreCase: true,
    returnPath: true,
  })

  if (!realPath) {
    const res = fileIndex.glob(`**/${path}`)
    // console.group(path)
    // console.log(res)
    // console.groupEnd()
    if (res.length === 0) return
    realPath = res[0]
  }

  try {
    return encodePath(await ensureURL(realPath))
  } catch (err) {
    toast(err.message, { picto: "error" })
  }
}

async function getIcon(path, dirname, name) {
  try {
    path = await resolveThemeAsset(path, dirname)
    if (!path) return

    let dataURL

    if (getExtname(path) === ".ico") {
      for (const layer of await ICO.decode(await fs.read(path))) {
        if (layer.bpp >= 8 && layer.width === 32 && layer.height === 32) {
          dataURL = await layer.getDataURL()
          break
        }
      }
    } else {
      dataURL = path
    }

    if (!dataURL) return

    return { name, dataURL }
  } catch (err) {
    toast(err)
  }
}

async function applySounds(data, dirname) {
  const undones = []
  const out = {}

  const defaultSounds = data.AppEvents?.Schemes?.Apps?.Default
  const explorerSounds = data.AppEvents?.Schemes?.Apps?.Explorer
  const sounds = { ...defaultSounds, ...explorerSounds }

  for (const [key, section] of Object.entries(sounds)) {
    const pathx = section.Current?.DefaultValue
    if (!pathx) continue
    undones.push(
      resolveThemeAsset(pathx, dirname).then((path) => {
        if (path) out[`--Sound-${key}`] = `"${path}"`
      }),
    )
  }

  await Promise.all(undones)
  return out
}

async function applyIcons(data, dirname) {
  const undones = []

  if (data["Additional Icons"]) {
    const additionalIcons = data["Additional Icons"]
    for (const key in additionalIcons) {
      if (
        Object.hasOwn(additionalIcons, key) &&
        additionalIcons[key] &&
        ADDITIONAL_ICONS[key]
      ) {
        undones.push(
          getIcon(additionalIcons[key], dirname, ADDITIONAL_ICONS[key]),
        )
      }
    }
  }

  const { CLSID } = data
  if (CLSID) {
    const trashIcons =
      CLSID["{645FF040-5081-101B-9F08-00AA002F954E}"]?.DefaultIcon
    if (trashIcons.full) {
      undones.push(getIcon(trashIcons.full, dirname, "places/user-trash-full"))
    }
    if (trashIcons.empty) {
      undones.push(getIcon(trashIcons.empty, dirname, "places/user-trash"))
    }

    const computerIcon =
      CLSID["{20D04FE0-3AEA-1069-A2D8-08002B30309D}"]?.DefaultIcon?.DefaultValue
    if (computerIcon) {
      undones.push(getIcon(computerIcon, dirname, "devices/computer"))
    }

    const networkIcon =
      CLSID["{208D2C60-3AEA-1069-A2D7-08002B30309D}"]?.DefaultIcon?.DefaultValue
    if (networkIcon) {
      undones.push(getIcon(networkIcon, dirname, "places/network-workgroup"))
    }

    const docsIcon =
      CLSID["{450D8FBA-AD25-11D0-98A8-0800361B1103}"]?.DefaultIcon?.DefaultValue
    if (docsIcon) {
      undones.push(getIcon(docsIcon, dirname, "places/user-home"))
    }
  }

  return Promise.all(undones)
}

function detectEncoding(buffer) {
  const view = new Uint8Array(buffer)
  if (view[0] === 0xff && view[1] === 0xfe) return "utf-16le"
  if (view[0] === 0xfe && view[1] === 0xff) return "utf-16be"
  if (view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) return "utf-8"
  return "windows-1252"
}

export async function importWindowsTheme(path) {
  if (!path) return

  const buffer = await fs.read(path)
  const encoding = detectEncoding(buffer)
  const string = new TextDecoder(encoding).decode(buffer)
  const data = INI.decode(string)

  const dirname = getDirname(path)

  const controlPanel = data["Control Panel"]
  if (!controlPanel) return

  const { Colors, Desktop, Cursors } = data["Control Panel"]

  let wallpaper

  if (Desktop?.Wallpaper) {
    const wallpaperStyle =
      WALLPAPER_STYLES_VALUES[
        Desktop.TileWallpaper ? 1 : (Desktop.WallpaperStyle ?? 0)
      ]

    wallpaper = await resolveThemeAsset(Desktop.Wallpaper, dirname)

    if (wallpaper) {
      wallpaper = `url("${wallpaper}") ${wallpaperStyle}`
    }
  }

  const out = {}

  out["--desktop-bg"] = wallpaper
    ? `${wallpaper} var(--Background)`
    : `var(--Background)`

  if (Cursors) {
    const undones = []
    for (const [key, val] of Object.entries(CURSORS)) {
      if (Cursors[key]) {
        undones.push(
          resolveThemeAsset(Cursors[key], dirname).then((path) => {
            if (!path) return
            out[`--cursor-${val}`] = `url("${path}"), ${val}`
          }),
        )
      }
    }
    await Promise.all(undones)
  }

  if (Colors) {
    for (const [key, val] of Object.entries(Colors)) {
      if (!val) continue
      out[`--${key}`] = `rgb(${val})`
    }
  }

  const dataURLs = await applyIcons(data, dirname)

  if (dataURLs.length > 0) {
    for (const item of dataURLs) {
      if (!item) continue
      const name1 = "--icon--" + item.name.split("/").pop()
      const name2 = "--icon--" + item.name.replaceAll("/", "__")
      out[name1] = `url(${item.dataURL})`
      out[name2] = `var(${name1})`
    }
  }

  const sounds = await applySounds(data, dirname)
  Object.assign(out, sounds)

  if (data.css) {
    for (const [key, val] of Object.entries(data.css)) {
      if (!val) continue
      out[key] = val
    }
  }

  return out
}
