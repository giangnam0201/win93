import { parsePath } from "../../../lib/syntax/path/parsePath.js"

import { inBackend } from "../../env/runtime/inBackend.js"
import { isObject } from "../../../lib/type/any/isObject.js"

import { configure } from "../../configure.js"
import { esc } from "../logUtils.js"
import { shortenFilename } from "../../fs/normalizeFilename.js"
import { bytesize } from "../../../lib/type/binary/bytesize.js"

const DEFAULTS = {
  appendFullPath: !true,
  shorten: true,
  bytes: false,
  colors: {
    dir: "grey",
    name: "reset",
    ext: "grey",
    line: "dim",
    column: "grey",
    punctuation: "grey",
    bytes: "yellow",
  },
}

export function formatFilename(stackframe, options) {
  const config = configure(
    DEFAULTS,
    typeof options === "string"
      ? { colors: { name: options, line: `${options}.dim` } }
      : options,
  )

  const { colors, appendFullPath } = config

  const isStackframe = isObject(stackframe) && "filename" in stackframe

  const originalFilename = isStackframe
    ? (stackframe.filename ?? "<anonymous>")
    : stackframe

  const hasPosition =
    isStackframe &&
    !Number.isNaN(Number(stackframe.line)) &&
    !Number.isNaN(Number(stackframe.column))

  const href = originalFilename
  const filename = config.shorten
    ? shortenFilename(originalFilename)
    : originalFilename

  let { dir, name, ext } =
    filename === "./" ? { dir: "./", name: "", ext: "" } : parsePath(filename)

  dir = dir.endsWith("/") ? dir : dir + "/"

  let out = ""

  // devtools doesn't autolink when using color
  if (!inBackend && appendFullPath) {
    out += esc` {reset ${href}`
    out += hasPosition ? `:${stackframe.line}:${stackframe.column}}` : `}`
  } else {
    out = esc`{${colors.dir} ${dir}}{${colors.name} ${name}}{${colors.ext} ${ext}}`
    if (hasPosition) {
      out += `{${colors.dir}.dim :}{${colors.line} ${stackframe.line}}{${colors.column}.dim :${stackframe.column}}`
    }
  }

  if (config.bytes) {
    const { size, unit } = bytesize(config.bytes, { returnString: false })
    out += `  {${colors.bytes} ${size}} {${colors.bytes}.dim ${unit}}`
  }

  return out
}
