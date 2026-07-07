/* eslint-disable max-depth */
import { getStemname } from "../../../../lib/syntax/path/getStemname.js"
import { isURLImage } from "../../../../lib/syntax/url/isURLImage.js"
import { decodeDesktopEntry } from "../../decodeDesktopEntry.js"
import { ensureURL } from "../../ensureURL.js"
import { parseExec } from "../../exec.js"
import { os } from "../../../os.js"

const DOT = 46
const HYPHEN = 45
const UNDERSCORE = 95

function isNumber(codePoint) {
  return codePoint >= 48 && codePoint <= 57
}

function isLowercase(codePoint) {
  return codePoint >= 97 && codePoint <= 122
}

function isUppercase(codePoint) {
  return codePoint >= 65 && codePoint <= 90
}

/**
 * @param {string} source
 */
export function tokenizeFilename(source) {
  if (source.endsWith("/")) source = source.slice(0, -1)
  const lastSeparator = source.lastIndexOf("/")
  if (lastSeparator !== -1) source = source.slice(lastSeparator + 1)

  const tokens = []
  let buffer = ""
  let current = 0

  const flush = () => {
    if (buffer) {
      tokens.push(buffer)
      buffer = ""
    }
  }

  let isCamelCase = false
  let wasUppercase = false

  while (current < source.length) {
    const codePoint = source.codePointAt(current)

    if (codePoint === DOT) {
      isCamelCase = false
      wasUppercase = false
      flush()
      buffer += "."
      current++
      continue
    }

    if (isLowercase(codePoint) || isNumber(codePoint)) {
      if (wasUppercase) isCamelCase = true
    } else if (isUppercase(codePoint)) {
      if (isCamelCase) buffer += "\u200B"
      else wasUppercase = true
    } else {
      wasUppercase = false
      isCamelCase = false
    }

    const char = source[current]

    buffer +=
      codePoint === UNDERSCORE || codePoint === HYPHEN //
        ? `\u200B${char}\u200B`
        : char

    current++
  }

  if (buffer !== ".desktop") flush()

  return tokens
}

async function getIconFromDesktopFile(path, size, options) {
  const ini = await decodeDesktopEntry(path)
  if (!ini) return

  const icon = ini.Icon

  const infos = {
    name: ini.Name || getStemname(path),
    ext: "",
  }

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
      infos.image ??= await os.icons.getIconPath(icon, size, options)
    }
  } else {
    infos.image ??= await os.icons.getIconPath("apps/generic", size, options)
  }

  return infos
}

let ready
export async function getIconFromTokens(
  filename,
  tokens,
  size = "32x32",
  options,
) {
  if (!ready) {
    await Promise.all([os.apps.ready, os.mimetypes.ready])
    ready = true
  }

  if (
    options?.ignoreDesktopFiles !== true &&
    filename.toLowerCase().endsWith(".desktop")
  ) {
    const res = await getIconFromDesktopFile(filename, size, options)
    if (res) return res
  }

  let mimetype
  let extension
  let extensions = ""

  for (let i = tokens.length - 1; i >= 0; i--) {
    let item = tokens[i]

    if (item.startsWith(".")) {
      item = item.toLowerCase().replaceAll("\u200B", "")
      extension ??= item

      if (os.mimetypes.extnames) {
        const tmp = item + (extensions || extension)
        if (tmp in os.mimetypes.extnames) {
          mimetype = os.mimetypes.extnames[item]
          extensions = tmp
        } else if (item in os.mimetypes.extnames) {
          mimetype = os.mimetypes.extnames[item]
        }
      }
    }
  }

  const isDir = filename.endsWith("/")

  const ext =
    extensions && extensions !== extension //
      ? [extensions, extension]
      : extension

  const infos = {
    filename,
    ext,
    mimetype,
    description: isDir ? "folder" : "file",
    isDir,
  }

  if (mimetype) infos.mime = os.mimetypes.parse(mimetype.mimetype)
  infos.image = await os.icons.getIconPath(infos, size)

  return infos
}

export async function getIconFromFilename(filename, size = "32x32", options) {
  const tokens = tokenizeFilename(filename)
  const { image } = await getIconFromTokens(filename, tokens, size, options)
  return image
}
