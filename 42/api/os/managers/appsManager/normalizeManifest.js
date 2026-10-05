/* eslint-disable camelcase */
import { getDirname } from "../../../../lib/syntax/path/getDirname.js"
import { mimetypesManager } from "../mimetypesManager.js"
import { fileIndex } from "../../../fileIndex.js"
import { extractDialogOptions } from "../../../../ui/layout/dialog.js"
import { slugify } from "../../../../lib/type/string/slugify.js"

export function getIcons(manifest) {
  const icons = []

  let icon16
  let icon32
  let icon160

  for (const path of fileIndex.glob([
    `${manifest.dirPath}icons/**/*.{jpg,gif,svg,png}`,
    `${manifest.dirPath}icons/*.{jpg,gif,svg,png}`,
    `${manifest.dirPath}icon*.{jpg,gif,svg,png}`,
  ])) {
    if (path.includes("/16x16/icon.") || path.includes("-16.")) {
      icon16 = {
        src: new URL(path, manifest.dirURL).pathname,
        sizes: "16x16",
      }
    } else if (
      path.includes("/32x32/icon.") ||
      path.includes("/icon.") ||
      path.includes("-32.")
    ) {
      icon32 = {
        src: new URL(path, manifest.dirURL).pathname,
        sizes: "32x32",
      }
    } else if (path.includes("/160x160/icon.") || path.includes("-160.")) {
      icon160 = {
        src: new URL(path, manifest.dirURL).pathname,
        sizes: "160x160",
      }
    }
  }

  if (icon16) icons.push(icon16)
  if (icon32) icons.push(icon32)
  if (icon160) icons.push(icon160)

  if (Array.isArray(manifest.icons)) {
    for (let item of manifest.icons) {
      if (typeof item === "string") item = { src: item }
      icons.push({
        src: new URL(item.src, manifest.dirURL).pathname,
        sizes: item.sizes ?? "32x32",
      })
    }
  }

  if (manifest.icon) {
    icons.push({
      src: new URL(manifest.icon, manifest.dirURL).pathname,
      sizes: "32x32",
    })
  }

  return icons
}

function normalizeEncodeDecode(manifest, key, options) {
  const out = {}

  if (!manifest[key]) return out

  Object.assign(out, manifest[key])

  if (manifest[key].types) {
    const mainAction = manifest.dirPath

    out.types = manifest[key].types.map((type) => {
      const out = {}
      out.action = type.action ?? mainAction

      out.accept =
        options?.ignoreAccept === true
          ? type.accept
          : mimetypesManager.normalize(type.accept)

      if (type.description) out.description = type.description
      if (type.icons) out.icons = type.icons
      if (type.launch_type) out.launch_type = type.launch_type
      return out
    })

    if (options?.combine && options?.ignoreAccept !== true) {
      const accept = {}
      // const description = []

      for (const item of out.types) {
        // if (item.description) description.push(truncate(item.description, 20))
        Object.assign(accept, item.accept)
      }

      out.types.unshift({
        // description:
        //   description.length > 0
        //     ? `Supported Files (${truncate(description.join(", "), 60)})`
        //     : "Supported Files",
        // description: "Supported Files",
        accept,
      })
    }
  }

  return out
}

export function normalizeEncode(manifest, options) {
  return normalizeEncodeDecode(manifest, "encode", options)
}

export function normalizeDecode(manifest, options) {
  return normalizeEncodeDecode(manifest, "decode", options)
}

export async function normalizeManifest(manifest, options) {
  manifest.command ??=
    slugify(
      manifest.name
        .toLowerCase()
        .split(".")[0]
        .replaceAll(/[^\da-z]/g, ""),
    ) || slugify(manifest.name)

  manifest.manifestPath ??= new URL(document.baseURI).pathname
  manifest.manifestURL ??= new URL(manifest.manifestPath, document.baseURI).href
  manifest.dirPath ??= getDirname(manifest.manifestPath) + "/"
  manifest.dirURL ??= getDirname(manifest.manifestURL) + "/"

  manifest.icons = getIcons(manifest)

  const decodeOpt = { ignoreAccept: true, ...options }

  if (decodeOpt.ignoreAccept !== true) await mimetypesManager.ready
  if (manifest.encode) manifest.encode = normalizeEncode(manifest, decodeOpt)
  if (manifest.decode) manifest.decode = normalizeDecode(manifest, decodeOpt)

  manifest.dialog = extractDialogOptions(manifest)

  if ("animation" in manifest) {
    if (manifest.animation === false) {
      manifest.dialog.class ??= {}
      manifest.dialog.class["animation-false"] = true
    }
    delete manifest.animation
  }

  manifest.modified ??= Date.now()
}
