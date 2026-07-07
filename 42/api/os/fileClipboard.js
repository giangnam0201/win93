import { Emitter } from "../../lib/class/Emitter.js"
import { assertPath } from "../../lib/syntax/path/assertPath.js"
import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { getDirname } from "../../lib/syntax/path/getDirname.js"
import { fs } from "../fs.js"
import { incrementFilename } from "../fs/incrementFilename.js"
import { normalizeDirname, normalizeFilename } from "../fs/normalizeFilename.js"

/** @import { IconComponent } from "../../ui/media/icon.js" */

export class FileClipboard extends Emitter {
  copied = new Set()
  cutted = new Set()

  isEmpty() {
    return this.copied.size === 0 && this.cutted.size === 0
  }

  get size() {
    return this.copied.size + this.cutted.size
  }

  #updateIcons() {
    if (globalThis.document) {
      for (const icon of /** @type {NodeListOf<IconComponent>} */ (
        document.querySelectorAll(`ui-icon`)
      )) {
        icon.toggleAttribute("cutted", this.cutted.has(icon.value))
      }
    }
  }

  async copy(selection) {
    this.cutted.clear()
    this.copied.clear()
    for (let path of [selection].flat()) {
      assertPath(path)
      path = normalizeFilename(path, { preserveDir: true })
      this.copied.add(path)
    }
    this.emit("copy", this.copied)
    this.#updateIcons()
  }

  async cut(selection) {
    this.cutted.clear()
    this.copied.clear()
    for (let path of [selection].flat()) {
      assertPath(path)
      path = normalizeFilename(path, { preserveDir: true })
      this.cutted.add(path)
    }
    this.emit("cut", this.cutted)
    this.#updateIcons()
  }

  async pasteTo(path, folderEl) {
    const added = []
    path = normalizeDirname(path)
    const undones = []
    if (this.cutted.size > 0) {
      for (const item of this.cutted) {
        let filename = path + getBasename(item)
        if (normalizeDirname(getDirname(item)) === path) {
          filename = incrementFilename(filename)
        }
        added.push(filename)
        this.copied.add(filename) // Allow pasting a cutted file multiple times
        undones.push(fs.move(item, filename))
      }
    } else if (this.copied.size > 0) {
      for (const item of this.copied) {
        let filename = path + getBasename(item)
        if (normalizeDirname(getDirname(item)) === path) {
          filename = incrementFilename(filename)
        }
        added.push(filename)
        undones.push(fs.copy(item, filename))
      }
    }

    this.cutted.clear()

    if (added.length === 0) return
    folderEl?.selectAddedIcon(added)
    await Promise.all(undones)
  }
}

export const fileClipboard = new FileClipboard()
