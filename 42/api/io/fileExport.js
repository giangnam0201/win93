// @read https://github.com/jimmywarting/native-file-system-adapter/blob/master/src/adapters/downloader.js
// @read https://github.com/eligrey/FileSaver.js/blob/master/src/FileSaver.js

import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { inOpaqueOrigin } from "../env/realm/inOpaqueOrigin.js"
import { slugify } from "../../lib/type/string/slugify.js"
import { streamToFile } from "../../lib/type/binary/streamToFile.js"

const supportShowSaveFilePicker = "showSaveFilePicker" in globalThis

function saveFileLegacy(file, options) {
  const link = document.createElement("a")
  link.download = options.suggestedName
  link.href = URL.createObjectURL(file)
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 4e4) // 40s
  return true
}

async function saveFile(readable, options) {
  let handle
  try {
    handle = await globalThis.showSaveFilePicker(options)
    await options.onExportStart?.()
  } catch (err) {
    if (err.name === "AbortError") return false
    throw err
  }

  const writable = await handle.createWritable()
  try {
    const pipeOptions = {}
    if (options.signal) pipeOptions.signal = options.signal
    await readable.pipeTo(writable, pipeOptions)
  } catch (err) {
    if (err.name === "AbortError") return false
    throw err
  }
  return true
}

/**
 * @param {Blob | File | ReadableStream} file
 * @param {any} [options]
 */
export async function fileExport(file, options = {}) {
  if (typeof options === "string") options = { suggestedName: options }

  const config = {
    ...options,
    suggestedName:
      // @ts-ignore
      options.suggestedName ?? options.name ?? file.name ?? "untitled",
    id: options.id ? slugify(options.id).slice(-32) : undefined,
  }

  const useLegacy =
    config.legacy || inOpaqueOrigin || !supportShowSaveFilePicker

  const isStream = isInstanceOf(file, ReadableStream)

  if (isStream) {
    if (supportShowSaveFilePicker && !useLegacy) return saveFile(file, config)
    await config.onExportStart?.()
    file = await streamToFile(file, config.suggestedName, config)
  }

  if (!isInstanceOf(file, Blob)) {
    throw new TypeError(
      "File argument must be a Blob, a File or a ReadableStream",
    )
  }

  if (useLegacy) {
    if (!isStream) await config.onExportStart?.()
    return saveFileLegacy(file, config)
  }
  return saveFile(file.stream(), config)
}
