/* eslint-disable max-depth */
import { getPathInfo } from "../../../../lib/syntax/path/getPathInfo.js"
import { getStemname } from "../../../../lib/syntax/path/getStemname.js"
import { mimetypesManager } from "../mimetypesManager.js"
import { iconsManager } from "../iconsManager.js"
import { isURLImage } from "../../../../lib/syntax/url/isURLImage.js"
import { parseExec } from "../../exec.js"
import { decodeDesktopEntry } from "../../decodeDesktopEntry.js"
import { ensureURL } from "../../ensureURL.js"
import { encodePath } from "../../../encodePath.js"

let ready = false

async function getDesktopFile(path, size, options) {
  const ini = await decodeDesktopEntry(path)
  if (!ini) return

  const icon = ini.Icon

  const infos = { name: ini.Name || getStemname(path), ext: "" }

  if (ini.Exec) {
    infos.command = ini.Exec

    if (!icon) {
      try {
        const exec = await parseExec(infos.command)
        if (exec.type === "app") {
          try {
            infos.image = await ensureURL(exec.icon)
          } catch {
            infos.image = exec.icon
          }
        }
      } catch {}
    }
  }

  infos.description = "shortcut"

  if (icon) {
    if (isURLImage(icon)) {
      infos.image = icon
    } else {
      infos.image ??= await iconsManager.getIconPath(icon, size, options)
    }
  } else {
    infos.image ??= await iconsManager.getIconPath(
      "apps/generic",
      size,
      options,
    )
  }

  return infos
}

export async function getIconFromPath(path, size = "32x32", options) {
  if (path === undefined) return

  if (!ready) {
    await Promise.all([iconsManager.ready, mimetypesManager.ready])
    ready = true
  }

  if (options?.ignoreDesktopFiles !== true && path.endsWith(".desktop")) {
    const res = await getDesktopFile(path, size, options)
    if (res) return res
  }

  const infos = getPathInfo(encodePath(path), {
    getURIMimetype: false,
    parseMimetype: false,
  })

  const m = infos.isURI
    ? undefined
    : (mimetypesManager.extnames[infos.ext] ??
      mimetypesManager.basenames[infos.base])
  if (m) {
    infos.mimetype = m.mimetype
    infos.mime = mimetypesManager.parse(m.mimetype)
  } else {
    infos.mime = mimetypesManager.parse(infos.mimetype)
  }

  infos.image ??= await iconsManager.getIconPath(infos, size, options)

  if (infos.isURI) infos.ext = ""

  infos.description ??= infos.isDir ? "folder" : infos.isURI ? "uri" : "file"

  infos.name ??= (
    infos.isURI
      ? infos.host.replace(/^www\./, "") +
        (infos.pathname !== "/" || infos.search
          ? infos.pathname + infos.search
          : "")
      : infos.stem
  ).replaceAll(".", "\u200B.")

  return infos
}
