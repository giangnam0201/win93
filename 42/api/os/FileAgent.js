import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { getDirname } from "../../lib/syntax/path/getDirname.js"
import { parseLineColumn } from "../../lib/syntax/path/parseLineColumn.js"
import { parseURL } from "../../lib/syntax/url/parseURL.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { ensureURL } from "./ensureURL.js"
import { fileIndex } from "../fileIndex.js"
import { fs } from "../fs.js"
import { encodePath } from "../encodePath.js"
import { normalizeFilename } from "../fs/normalizeFilename.js"

/** @import {App} from "./App.js" */

// MARK: FileAdjacents
// ===================
class FileAdjacents {
  accept
  #app
  list = []
  loop = false
  random = false

  constructor(fileAgent) {
    this.#app = fileAgent.app
    this.currentFile = fileAgent
    this.dirname = fileAgent.path ? getDirname(fileAgent.path) : undefined
    this.accept = this.#app.decode?.types?.[0]?.accept
    this.scan()
  }

  scan() {
    if (this.dirname && this.accept) {
      const exts = new Set()
      for (const items of Object.values(this.accept)) {
        for (const item of items) exts.add(`${this.dirname}/*${item}`)
      }

      this.list = fileIndex.glob(exts, "i")
      this.current = this.list.indexOf(this.currentFile.path)
    }
  }

  registerPrevButton(prevButton) {
    this.prevButton = prevButton
    this.prevButton.disabled = !this.hasPrev()
  }
  registerNextButton(nextButton) {
    this.nextButton = nextButton
    this.nextButton.disabled = !this.hasNext()
  }
  registerButtons(prevButton, nextButton) {
    this.registerPrevButton(prevButton)
    this.registerNextButton(nextButton)
  }

  hasPrev() {
    if (this.list.length === 0) return false
    if (this.loop || this.random) return true
    return this.current - 1 > -1
  }
  hasNext() {
    if (this.list.length === 0) return false
    if (this.loop || this.random) return true
    return this.current + 1 < this.list.length
  }

  getPrev(options) {
    const loop = options?.loop ?? this.loop
    if (loop && this.current - 1 < 0) return this.list.at(-1)
    return this.list[this.current - 1]
  }
  getNext(options) {
    const loop = options?.loop ?? this.loop
    if (loop && this.current + 1 >= this.list.length) return this.list[0]
    return this.list[this.current + 1]
  }

  setCurrent(fileAgent) {
    this.currentFile = fileAgent
    this.current = this.list.indexOf(fileAgent.path)
    fileAgent.adjacents = this
    return fileAgent
  }

  prev(options) {
    if (this.random) return this.randomNext()
    if (options?.loop !== true && !this.hasPrev()) return false
    const fileAgent = this.#app.loadFile(this.getPrev(options), {
      silent: true,
    })
    this.setCurrent(fileAgent)
    fileAgent.emitDecode()
    return fileAgent
  }
  next(options) {
    if (this.random) return this.randomNext()
    if (options?.loop !== true && !this.hasNext()) return false
    const fileAgent = this.#app.loadFile(this.getNext(options), {
      silent: true,
    })
    this.setCurrent(fileAgent)
    fileAgent.emitDecode()
    return fileAgent
  }

  #notPlayed
  #removeCurrent() {
    this.#notPlayed[this.current] = this.#notPlayed.at(-1)
    this.#notPlayed.pop()
  }
  randomNext() {
    if (this.list.length === 0) return false
    if (!this.#notPlayed) {
      this.#notPlayed = [...this.list]
      this.#removeCurrent()
    }

    if (this.#notPlayed.length === 0) {
      this.#notPlayed = [...this.list]
    }

    this.current = Math.floor(Math.random() * this.#notPlayed.length)

    const fileAgent = this.#app.loadFile(this.#notPlayed[this.current], {
      silent: true,
    })
    this.#removeCurrent()
    this.setCurrent(fileAgent)
    fileAgent.emitDecode()
    return fileAgent
  }
}

// MARK: FileAgent
// ===============
export class FileAgent {
  // TODO: add getHomonym
  /**
   * @param {App} app
   * @param {string | Blob | File} [pathOrFile]
   */
  constructor(app, pathOrFile) {
    this.app = app
    this.decoded = false

    if (typeof pathOrFile === "string") {
      this.path = pathOrFile
    } else {
      this.path = ""
      if (isInstanceOf(pathOrFile, Blob)) {
        this.blob = /** @type {File} */ (pathOrFile)
      }
    }

    this.app.signal.addEventListener("abort", () => this.destroy())
  }

  #pauseWatcher = false
  #forgetWatcher
  #path
  get path() {
    return this.#path
  }
  set path(path) {
    const parsed = parseURL(
      encodePath(
        normalizeFilename(path, {
          cwd: this.app?.config?.cwd,
        }),
      ),
    )
    const { pathname, line, column } = parseLineColumn(
      path ? parsed.pathname : "",
    )

    this.params = parsed.query
    this.line = parsed.query.line ?? line
    this.column = parsed.query.column ?? column

    let newPath = pathname
    try {
      newPath = decodeURIComponent(pathname)
    } catch {}
    if (this.#path === newPath) return
    this.#path = newPath
    this.#forgetWatcher?.()
    if (!path) return

    const { signal } = this.app
    this.#forgetWatcher = fileIndex.watch(this.#path, { signal }, (_, type) => {
      if (this.#pauseWatcher || type === "delete") return
      this.decoded = false
      this.emitDecode({ reload: true })
    })
  }

  #adjacents
  get adjacents() {
    this.#adjacents ??= new FileAdjacents(this)
    return this.#adjacents
  }

  set adjacents(value) {
    this.#adjacents = value
  }

  emitDecode(options) {
    if (this.decoded) return
    this.app.emit("decode", this, options)
    this.decoded = true
  }

  async setData(data) {
    if (!this.path) {
      const path = await this.app.getSavePath()
      if (path === false) return false
      this.path = path
    }

    this.#pauseWatcher = true

    if (typeof data === "string") {
      await fs.writeText(this.path, data)
      this.#pauseWatcher = false
      return true
    }

    if (
      isInstanceOf(data, Blob) ||
      isInstanceOf(data, ArrayBuffer) ||
      ArrayBuffer.isView(data)
    ) {
      await fs.write(this.path, data)
      this.#pauseWatcher = false
      return true
    }

    await fs.writeJSON5(this.path, data)
    this.#pauseWatcher = false
    return true
  }

  async getBlob() {
    if (this.blob) return this.blob
    if (!this.path) return new Blob()
    return fs.open(this.path)
  }

  async getArrayBuffer() {
    if (this.blob) return this.blob.arrayBuffer()
    if (!this.path) return new ArrayBuffer()
    const blob = await fs.open(this.path)
    return blob.arrayBuffer()
  }

  async getText() {
    if (this.blob) return this.blob.text()
    if (!this.path) return ""
    return fs.readText(this.path)
  }

  async getJSON() {
    if (this.blob) return JSON.parse(await this.blob.text())
    if (!this.path) return ""
    return fs.readJSON(this.path)
  }

  #url
  async getURL() {
    if (!this.path) return
    this.#url = await ensureURL(this.path, { signal: this.app.signal })
    return this.#url
  }

  getName() {
    if (this.path) return getBasename(this.path)
    if (this.blob?.name) return this.blob.name
  }

  destroy() {
    this.blob = undefined
    this.#adjacents = undefined
    this.#forgetWatcher?.()
    if (this.#url?.startsWith("blob:")) URL.revokeObjectURL(this.#url)
  }
}
