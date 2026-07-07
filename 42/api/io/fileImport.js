// @related https://github.com/GoogleChromeLabs/browser-fs-access
// @related https://github.com/pqina/filepond

// @thanks https://stackoverflow.com/a/67603015

import { inOpaqueOrigin } from "../env/realm/inOpaqueOrigin.js"
import { setFileRelativePath } from "./setFileRelativePath.js"
import { slugify } from "../../lib/type/string/slugify.js"

const supportShowOpenFilePicker = "showOpenFilePicker" in globalThis

function setAcceptLegacy(types) {
  if (!Array.isArray(types)) return

  const mimetypes = []
  const extensions = []
  for (const { accept } of types) {
    for (const [mimetype, extension] of Object.entries(accept)) {
      mimetypes.push(mimetype)
      extensions.push(...extension)
    }
  }

  return [...mimetypes, ...extensions].join(",")
}

function openFileLegacy(options = {}) {
  return new Promise((resolve) => {
    let input = document.createElement("input")
    input.type = "file"

    if (options.types) input.accept = setAcceptLegacy(options.types)
    if (options.multiple) input.multiple = options.multiple
    if (options.directory) input.webkitdirectory = true

    // @read https://stackoverflow.com/questions/47664777/javascript-file-input-onchange-not-working-ios-safari-only
    input.style.position = "absolute"
    input.style.top = "-1000vh"
    input.style.left = "-1000vw"
    input.style.opacity = "0.01"
    document.body.append(input)

    input.addEventListener(
      "cancel",
      () => {
        resolve()
        input.remove()
        input = undefined
      },
      { once: true },
    )

    input.addEventListener(
      "change",
      () => {
        resolve([...input.files])
        input.remove()
        input = undefined
      },
      { once: true },
    )

    // Disable bubling to prevent infinite recursion
    input.dispatchEvent(new MouseEvent("click", { bubbles: false }))
  })
}

async function* getFilesRecursively(entry, parentName = "") {
  if (entry.kind === "file") {
    const file = await entry.getFile()
    if (file !== null) {
      if (!file.webkitRelativePath) {
        setFileRelativePath(file, parentName + entry.name)
      }

      yield file
    }
  } else if (entry.kind === "directory") {
    for await (const handle of entry.values()) {
      yield* getFilesRecursively(handle, parentName + entry.name + "/")
    }
  }
}

async function openFile(options = {}) {
  let handle
  try {
    handle = await (options.directory
      ? globalThis.showDirectoryPicker(options)
      : globalThis.showOpenFilePicker(options))
  } catch (err) {
    if (err.name === "AbortError") return
    throw err
  }

  const files = []

  for await (const entry of handle.values()) {
    for await (const fileHandle of getFilesRecursively(
      entry,
      options.directory ? handle.name + "/" : "",
    )) {
      files.push(fileHandle)
    }
  }

  return files
}

export async function fileImport(options = {}) {
  const config = {
    id: options.id ? slugify(options.id).slice(-32) : undefined,
    types: options.types,
    startIn: options.startIn,
    excludeAcceptAllOption: options.excludeAcceptAllOption,
    multiple: options.multiple,
    directory: options.directory,
  }

  const useLegacy =
    options.legacy || inOpaqueOrigin || !supportShowOpenFilePicker

  return useLegacy //
    ? openFileLegacy(config)
    : openFile(config)
}
