/* eslint-disable guard-for-in */
/* eslint-disable max-depth */
/* eslint-disable complexity */

import { fs } from "../../../fs.js"
import { fileIndex } from "../../../fileIndex.js"
import { decodeINI } from "../../../../formats/data/INI/decodeINI.js"
import { locate } from "../../../../lib/type/object/locate.js"
import { parsePath } from "../../../../lib/syntax/path/parsePath.js"
import { parseMimetype } from "../../../../lib/syntax/mimetype/parseMimetype.js"
import { cssVar } from "../../../../lib/cssom/cssVar.js"
import { scrapeCSSUrls } from "../../../../lib/cssom/scrapeCSSUrls.js"

function needleInIconName(needle, iconName) {
  return iconName
    .slice(0, iconName.lastIndexOf("."))
    .split("_")
    .includes(needle)
}

function searchIcon(themePath, obj, val) {
  if (typeof val === "string") {
    if (val.includes("/")) {
      const { dir, base } = parsePath(val)
      const r = locate(obj, dir, "/")
      if (r) {
        for (const k in r) {
          if (k.startsWith(`${base}.`)) return `${themePath}/${dir}/${k}`
        }
      }
    } else {
      for (const key in obj) {
        for (const k in obj[key]) {
          if (k.startsWith(`${val}.`)) return `${themePath}/${key}/${k}`
        }
      }

      return
    }

    val = { mime: parseMimetype(val) }
  }

  let { filename, ext, mime } = val

  if (filename?.endsWith("/")) {
    if ("places" in obj) {
      for (const k in obj.places) {
        if (k.startsWith(`folder.`)) return `${themePath}/places/${k}`
      }
    }

    return
  }

  if (ext && "ext" in obj) {
    if (Array.isArray(ext)) {
      for (let extItem of ext) {
        if (extItem.startsWith(".")) extItem = extItem.slice(1)
        for (const k in obj.ext) {
          if (needleInIconName(extItem, k)) {
            return `${themePath}/ext/${k}`
          }
        }
      }
    } else {
      if (ext.startsWith(".")) ext = ext.slice(1)
      for (const k in obj.ext) {
        if (needleInIconName(ext, k)) {
          return `${themePath}/ext/${k}`
        }
      }
    }
  }

  if (mime) {
    if (mime.subtype && "subtype" in obj) {
      for (const k in obj.subtype) {
        if (needleInIconName(mime.subtype, k)) {
          return `${themePath}/subtype/${k}`
        }
      }

      if (mime.suffix) {
        for (const k in obj.subtype) {
          if (needleInIconName(mime.suffix, k)) {
            return `${themePath}/subtype/${k}`
          }
        }
      }
    }

    if (mime.type && "type" in obj) {
      for (const k in obj.type) {
        if (needleInIconName(mime.type, k)) {
          return `${themePath}/type/${k}`
        }
      }
    }
  }
}

export async function findIconPath(themePath, val, size) {
  if (val.isDir && fileIndex.has(val.filename + ".directory")) {
    try {
      const ini = decodeINI(await fs.readText(val.filename + ".directory"))
      val = ini["Desktop Entry"]?.Icon
    } catch {}
  }

  if (typeof val === "string") {
    const cssPath = val.includes("/")
      ? cssVar.get(`--icon--${val.replaceAll("/", "__")}`)
      : cssVar.get(`--icon--${val}`)

    if (cssPath) {
      const url = scrapeCSSUrls(cssPath, { includeEmbedded: true })[0]
      if (url) return url
    }
  }

  const dirNode = fileIndex.get(themePath)
  if (!dirNode) return

  if (size && size in dirNode) {
    const res = searchIcon(`${themePath}${size}`, dirNode[size], val)
    if (res) return res
  }

  size = "32x32"
  if (size in dirNode) {
    return searchIcon(`${themePath}${size}`, dirNode[size], val)
  }
}
