import { fileIndex } from "../fileIndex.js"
import { os } from "../os.js"
import { mimetypesManager } from "./managers/mimetypesManager.js"

/**
 * @typedef {{accept: string | string[] | Record<string, string[]>}} AppFileType
 * @typedef {{
 *   name: string,
 *   command: string,
 *   manifestURL?: string,
 *   decode?: {types?: AppFileType[]},
 *   contextMenu?: boolean | {files?: boolean, folders?: boolean, types?: AppFileType[]},
 *   [key: string]: any,
 * }} AppAgentManifest
 */

/**
 * @param {string} path
 * @param {AppFileType[]} [types]
 */
function matchesTypes(path, types = []) {
  if (fileIndex.isDir(path) || path.endsWith("/")) return false
  const lowerPath = path.toLowerCase()
  for (const { accept } of types) {
    /** @type {Array<[string, string[]]>} */
    const entries =
      typeof accept === "string" || Array.isArray(accept)
        ? [accept].flat().map((mime) => [mime, []])
        : Object.entries(accept ?? {})
    for (const [mime, extensions] of entries) {
      if (mime === "*" || mime === "*/*") return true
      if (extensions?.length) {
        if (extensions.some((ext) => lowerPath.endsWith(ext.toLowerCase()))) {
          return true
        }
      } else {
        const { mimetype } = mimetypesManager.lookup(path)
        if (
          mimetype === mime ||
          (mime.endsWith("/*") && mimetype?.startsWith(mime.slice(0, -1)))
        ) {
          return true
        }
      }
    }
  }
  return false
}

/** Manifest utilities for app hooks, without launching an App. */
export class AppAgent {
  /**
   * @param {AppAgentManifest} manifest Normalized app manifest.
   * @param {string[]} [selection]
   */
  constructor(manifest, selection = []) {
    this.manifest = manifest
    this.selection = [...selection]
    this.name = manifest.name
    this.command = manifest.command
  }

  /** @returns {string[]} Selected files accepted by the app's decoder. */
  getSupportedFiles() {
    return this.selection.filter((path) =>
      matchesTypes(path, this.manifest.decode?.types),
    )
  }

  /** @returns {string[]} Selected paths accepted by the context-menu hook. */
  getSupportedSelection() {
    const config = this.manifest.contextMenu
    if (!config) return []
    const options = config === true ? {} : config
    return this.selection.filter((path) => {
      if (fileIndex.isDir(path) || path.endsWith("/")) {
        return options.folders === true
      }
      return (
        options.files === true ||
        matchesTypes(path, options.types ?? this.manifest.decode?.types)
      )
    })
  }

  /** @param {object | string | string[]} [options] */
  launch(options = this.selection) {
    return os.apps.launch(this.command, options)
  }

  /** Close an active window, activate an inactive one, or launch the app. */
  toggle() {
    for (const app of os.apps.launched.values()) {
      if (app.command !== this.command || !app.dialogEl) continue
      if (app.dialogEl.active) return app.destroy()
      return app.dialogEl.activate()
    }
    return this.launch()
  }

  /** @param {string} [size] */
  getIcon(size) {
    return os.apps.getAppIcon(this.manifest, size)
  }

  /** @param {string} path */
  resolveURL(path) {
    return new URL(path, this.manifest.manifestURL).href
  }
}
