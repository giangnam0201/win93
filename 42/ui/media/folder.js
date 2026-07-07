/* eslint-disable complexity */
import "./icon.js"
import { fileClipboard } from "../../api/os/fileClipboard.js"
import { actions } from "../../api/os/actions.js"
import { fs } from "../../api/fs.js"
import { Component } from "../../api/gui/Component.js"
import { configure } from "../../api/configure.js"
import { fileIndex } from "../../api/fileIndex.js"
import { selectable } from "../../api/gui/trait/selectable.js"
import { transferable } from "../../api/gui/trait/transferable.js"
import { matrixable } from "../../api/gui/trait/matrixable.js"
import { dataTransfertImport } from "../../api/io/dataTransfertImport.js"
import { virtualizable } from "../../api/gui/trait/virtualizable.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { hook } from "../../lib/event/hook.js"
import { listen, on } from "../../lib/event/on.js"
import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { segmentize } from "../../lib/type/string/segmentize.js"
import { menu } from "../layout/menu.js"
import { isGlob } from "../../lib/syntax/glob/isGlob.js"
import { Glob } from "../../lib/syntax/glob.js"
import { createFuzzySearch } from "../../lib/algo/fuzzySearch.js"
import { noop } from "../../lib/type/function/noop.js"
import {
  displayFilename,
  normalizeDirname,
} from "../../api/fs/normalizeFilename.js"
import {
  getFolderShortcutHandlers,
  makeFileContextMenu,
  makeFolderContextMenu,
} from "../../api/os/plans.js"

/** @import { IconComponent } from "../media/icon.js" */

function addDirectChildPath(prefix, paths, path) {
  const segments = segmentize(path, "/")
  if (segments.length > 1) paths.add(prefix + segments[0] + "/")
  else paths.add(prefix + segments[0])
}

// MARK: FolderComponent
// =====================

export class FolderComponent extends Component {
  static plan = {
    tag: "ui-folder",
    props: {
      value: true,
      glob: true,
      filter: true,
      filterType: true,
    },
  }

  // MARK: props
  // ===========

  get value() {
    return this.getAttribute("value") ?? ""
  }
  set value(value) {
    this.setAttribute("value", normalizeDirname(value))
    this.#watch()
  }

  get glob() {
    return this.hasAttribute("glob")
  }
  set glob(value) {
    this.toggleAttribute("glob", Boolean(value))
  }

  #singleFileFilter
  #applyFilter = noop
  #initFilter() {
    const { filter, filterType } = this

    this.#applyFilter =
      filterType === "disable"
        ? filter
          ? (el) => {
              el.toggleAttribute(
                "disabled",
                this.#singleFileFilter
                  ? !this.#singleFileFilter(el.value)
                  : false,
              )
            }
          : (el) => el.toggleAttribute("disabled", false)
        : noop
  }
  get filter() {
    return this.getAttribute("filter")
  }
  set filter(value) {
    if (value) this.setAttribute("filter", String(value))
    else this.removeAttribute("filter")
    this.#initFilter()
  }

  get filterType() {
    return this.getAttribute("filter-type")
  }
  set filterType(value) {
    if (value) this.setAttribute("filter-type", String(value))
    else this.removeAttribute("filter-type")
    this.#initFilter()
  }

  #showHiddenFiles = false
  get showHiddenFiles() {
    return this.#showHiddenFiles
  }
  set showHiddenFiles(value) {
    value = Boolean(value)
    if (this.#showHiddenFiles === value) return
    this.#showHiddenFiles = value
    const wasFocused = this.contains(document.activeElement)
    this.rerender()
    if (wasFocused) this.focus()
  }

  get multiselectable() {
    const value = this.getAttribute("aria-multiselectable")
    return value === "true"
  }
  /**
   * @param {boolean | string} value
   */
  set multiselectable(value) {
    value = value === "true" ? true : value === "false" ? false : value
    this.setAttribute("aria-multiselectable", String(Boolean(value)))
  }

  get selection() {
    return this.selectable.selection
  }
  set selection(value) {
    if (value?.length === 0) return
    this.ready.then(() => {
      this.selectable.setSelection(value)
      const idx = this.virtualizable.items.indexOf(value[0])
      if (idx !== -1) {
        const el = this.virtualizable.scrollToElement(idx)
        el?.focus({ preventScroll: true })
      }
    })
  }

  // MARK: matrixable
  // ===================

  #matrixable
  get matrixable() {
    return this.#matrixable
  }
  set matrixable(options) {
    const { signal } = this

    const config = configure(
      {
        signal,
        animatableParents: "ui-dialog",
      },
      options,
    )

    this.#matrixable = matrixable(this, config)
  }

  // MARK: virtualizable
  // ===================

  #virtualizable
  get virtualizable() {
    return this.#virtualizable
  }
  set virtualizable(options) {
    const { signal } = this

    const config = configure(
      {
        signal,
        grid: true,
        animatableParents: "ui-dialog",
        updateElement: (/** @type IconComponent */ icon, item) => {
          if (typeof item === "string") {
            if (icon.value !== item) {
              icon.removeAttribute("id")
              icon.value = item
            }
          } else if (
            icon.value !== item.value ||
            icon.picto !== item.picto ||
            icon.label !== item.label
          ) {
            icon.removeAttribute("id")
            icon.removeAttribute("value")
            icon.removeAttribute("picto")
            icon.removeAttribute("label")
            Object.assign(icon, item)
          }
          icon.toggleAttribute("cutted", fileClipboard.cutted.has(icon.value))
          this.#applyFilter(icon)
        },
        renderElement: (item) => {
          const icon = /** @type IconComponent */ (
            document.createElement("ui-icon")
          )
          if (typeof item === "string") icon.value = item
          else Object.assign(icon, item)
          this.#applyFilter(icon)
          icon.toggleAttribute("cutted", fileClipboard.cutted.has(icon.value))
          return icon
        },
      },
      options,
    )

    this.#virtualizable = virtualizable(this, config)
  }

  // MARK: transferable
  // ==================

  #transferable
  get transferable() {
    return this.#transferable
  }
  set transferable(options) {
    const { signal } = this
    const config = configure(
      {
        signal,
        selector: ":scope ui-icon",
        kind: "42_TR_ICON",
        accept: { mimetype: "*" },
        effects: ["move", "copy"],
      },
      options,
      {
        export: ({ items }) => {
          const event = dispatch(this, "ui:folder.export", {
            cancelable: true,
            detail: { items },
          })
          if (event.defaultPrevented) return

          items.details = { paths: [], dataTypes: [] }
          if (
            this.selectable &&
            "virtualizable" in this.selectable &&
            this.selectable.virtualizable
          ) {
            for (const val of this.selectable.selection) {
              items.details.paths.push(val)
              items.details.dataTypes.push(
                val.endsWith("/")
                  ? "inode/directory"
                  : "application/octet-stream",
              )
            }
          } else {
            for (const item of items) {
              items.details.dataTypes.push(item.target.mime)
              items.details.paths.push(item.target.value)
            }
          }
        },
        import: (details) => {
          const event = dispatch(this, "ui:folder.import", {
            cancelable: true,
            detail: details,
          })
          // @ts-ignore
          if (event.defaultPrevented) return event.mode ?? "revert"

          const res = options?.import?.(details)
          if (res !== undefined) return res

          const {
            paths,
            files,
            folders,
            effect,
            isOriginDropzone,
            isDropImports,
          } = details

          if (isOriginDropzone && effect === "move") return "revert"

          if (paths?.length > 0) {
            const dests = paths.map(
              (path) =>
                this.value +
                getBasename(path) +
                (path.endsWith("/") ? "/" : ""),
            )
            options?.added?.(dests, details)

            const isCopy = effect === "copy"

            const done = isCopy
              ? actions.copyPath(paths, this.value)
              : actions.movePath(paths, this.value)

            done.then((dests) => this.selectAddedIcon(dests))
            if (isCopy) return "restore"
          } else if (isDropImports) {
            this.importFromDataTransfer({ files, folders }, options, details)
          } else {
            return "revert"
          }

          return "vanish"
        },
      },
    )
    this.#transferable = transferable(this, config)
  }

  async importFromDataTransfer({ files, folders }, options, details) {
    const undones = []
    const set = new Set()

    for (const path of folders) {
      const dirname = this.value + path
      undones.push(fs.writeDir(dirname))
      addDirectChildPath(this.value, set, path)
    }

    for (const [path, file] of Object.entries(files)) {
      const filename = this.value + path
      undones.push(fs.write(filename, file))
      addDirectChildPath(this.value, set, path)
    }

    if (undones.length === 0) return

    const paths = Array.from(set)

    options?.added?.(paths, details)
    this.selectAddedIcon(paths)
    await Promise.all(undones)
  }

  #creation(x, y) {
    return {
      onFilename: (filename) => {
        dispatch(this, "ui:folder.contextmenu-creation", {
          cancelable: true,
          detail: { x, y, filename },
        })
      },
    }
  }

  // MARK: selectAddedIcon
  // =====================

  #forgetFileAdded
  #forgetSelectionChange
  #forgetSelectAddedIcon() {
    this.#forgetFileAdded?.()
    this.#forgetSelectionChange?.()
    this.#forgetFileAdded = undefined
    this.#forgetSelectionChange = undefined
  }
  selectAddedIcon(filenames) {
    const { signal } = this

    let started = false

    this.#forgetSelectAddedIcon()

    // Forget if user manually change selection
    this.#forgetSelectionChange = listen(
      this,
      "ui.selection.change",
      () => this.#forgetSelectAddedIcon(),
      { signal },
    )

    this.#forgetFileAdded = listen(
      this,
      "ui:folder.icon-added",
      (e) => {
        const elements = []
        for (const filename of filenames) {
          if (e.detail.includes(filename)) {
            const icon = /** @type IconComponent */ (
              this.selectable.getElement(filename)
            )
            if (icon) elements.push(icon)
          }
        }

        if (elements.length > 0) {
          if (!started) {
            this.selectable.clear({ silent: true })
            elements[0].focus()
            started = true
          }
          const done =
            this.selectable.selection.length + elements.length ===
            filenames.length
          this.selectable.setElements(elements, { clear: false, silent: !done })
          if (done) this.#forgetSelectAddedIcon()
        }
      },
      { signal },
    )
  }

  // MARK: watch
  // ===========

  #idleId
  #forgetWatch
  #watch() {
    const pattern = this.value + "*"
    this.#forgetWatch?.()
    cancelIdleCallback(this.#idleId)

    let added
    this.#forgetWatch = fileIndex.watch(
      pattern,
      { signal: this.signal },
      (changed, type) => {
        added ??= []
        if (type === "set") added.push(changed)
        cancelIdleCallback(this.#idleId)
        this.#idleId = requestIdleCallback(async () => {
          await this.rerender()
          dispatch(this, "ui:folder.icon-added", { detail: added })
          added = undefined
        })
      },
    )
  }

  // MARK: methods
  // =============

  refresh() {
    this.rerender()
  }

  async createFolder(options) {
    const filename = await actions.createPath(this.value, {
      ...options,
      folder: true,
    })
    this.selectAddedIcon([filename])
  }

  async createFile(options) {
    const filename = await actions.createPath(this.value, options)
    this.selectAddedIcon([filename])
  }

  async createShortcut(options) {
    const filename = await actions.createShortcut(this.value, options)
    this.selectAddedIcon([filename])
  }

  async importFile(options) {
    const filenames = await actions.importFile(this.value, {
      multiple: true,
      ...options,
    })
    this.selectAddedIcon(filenames)
  }

  // MARK: contextmenu
  // =================

  async displayContextMenu(e, addItems) {
    e.preventDefault()
    const icon = e.target.closest("ui-icon")

    const { x, y } = e

    const ctxMenu = configure(
      {
        start: [],
        creation: [],
        modification: [],
        end: [],
      },
      (await addItems?.({ type: icon ? "icon" : "background" })) ?? {},
    )

    if (icon) {
      this.selectable.ensureSelected(icon)
      let hasFolders = false
      let hasFiles = false
      for (const path of this.selectable.selection) {
        if (path.endsWith("/")) hasFolders = true
        else hasFiles = true
      }

      let menuItems

      if (hasFolders) {
        menuItems = await (hasFiles
          ? makeFileContextMenu(this.selectable)
          : makeFolderContextMenu(this.selectable))
      } else {
        menuItems = await makeFileContextMenu(this.selectable)
      }

      menu(menuItems, { opener: icon, of: e })
    } else {
      this.selectable.clear()

      const menuItems = [
        ...ctxMenu.start,
        {
          ...actions.createFolder.meta,
          action: () => this.createFolder(this.#creation(x, y)),
        },
        {
          ...actions.createFile.meta,
          action: () => this.createFile(this.#creation(x, y)),
        },
        {
          ...actions.createShortcut.meta,
          action: () => this.createShortcut(this.#creation(x, y)),
        },
        ...ctxMenu.creation,
        "---",
        {
          ...actions.pasteTo.meta,
          // label: `Paste ${fileClipboard.size} files`,
          action: () => {
            fileClipboard.pasteTo(this.value, this)
          },
        },
        {
          ...actions.importFile.meta,
          action: () => this.importFile(this.#creation(x, y)),
        },
        ...ctxMenu.modification,
        "---",
        {
          label: "Select all",
          disabled: !this.multiselectable,
          action: () => this.selectable.selectAll(),
        },
        ...ctxMenu.end,
      ]
      menu(menuItems, { opener: this, of: e })
    }
  }

  async updated() {
    this.renderCancel?.resolve?.(false)
    const hasFocus = this.contains(document.activeElement)
    await this.rerender()
    if (hasFocus) this.focus()
  }

  // MARK: render
  // ============

  #lastValue
  async render() {
    const path = this.value

    if (!path) {
      this.virtualizable.clear()
      this.selectable.clear()
      return false
    }

    if (!this.glob && !fileIndex.has(path)) {
      const message = `The file or folder ${path} does not exist.`

      const event = dispatch(this, "ui:folder.inexistent", {
        cancelable: true,
        detail: { message },
      })
      if (event.defaultPrevented) return

      return {
        tag: ".message.negative.flex.items-center.gap.absolute.top-gap.left-gap.right-gap",
        content: [
          {
            tag: "span.truncate-center-box",
            content: [
              `The file or folder `,
              displayFilename(path),
              ` does not exist.`,
            ],
          },
          {
            tag: "button.aside.self-center.ma-l-auto",
            content: "Create",
            onclick: async () => {
              await fs.writeDir(path)
              this.value = path
            },
          },
        ],
      }
    }

    let dir

    try {
      const { filter, filterType } = this

      let globFilter

      if (filter) {
        globFilter = isGlob(filter)
          ? filter.split(",").map((glob) => path + glob)
          : [`${path}*${filter}*`]

        globFilter.unshift(path + "*/") // always add folders
        if (filterType === "disable") {
          const patterns = globFilter.map((pattern) => new Glob(pattern, "i"))
          this.#singleFileFilter = (path) =>
            patterns.some((pattern) => pattern.test(path))
        }
      }

      dir = await (this.glob
        ? fileIndex.glob(
            path.endsWith("*") || //
              (!path.startsWith(".") && path.includes("."))
              ? path
              : path + "*",
            // "i",
          )
        : globFilter && !filterType
          ? fileIndex.glob(globFilter, "i")
          : fileIndex.readDir(path, { absolute: true }))
    } catch (err) {
      dispatch(this, err)
      dir = []
    }

    hook(this, "ui:folder.items", { items: dir })

    if (this.#lastValue !== this.value) {
      this.virtualizable.clear()
    }

    const items = []
    const basenames = []

    for (const item of dir) {
      let value = item
      const itemIsObject = typeof item === "object"
      if (itemIsObject) value = item.value
      if (value) {
        const basename = getBasename(item.value ?? item)
        if (this.showHiddenFiles !== true && basename.startsWith(".")) continue
        items.push(item)
        basenames.push(basename)
      } else {
        items.push(item)
      }
    }

    this.virtualizable.items = items
    this.matrixable.update()

    this.fuzzySearch = createFuzzySearch(basenames)

    if (this.#lastValue === this.value) {
      this.selectable.setSelection(structuredClone(this.selectable.selection))
    } else {
      this.#lastValue = this.value
      this.selectable.clear()
    }
  }

  // MARK: inited
  // ============

  inited() {
    const { signal } = this

    this.virtualizable ??= {}

    this.transferable ??= {}

    this.matrixable ??= {}

    this.selectable = selectable(this, {
      signal,
      selector: ":scope ui-icon:not([disabled])",
      key: "value",
      rubberband: { ignore: ["ui-icon", ".message"] },
      attributes: {
        "aria-selected": "true",
      },
    })

    // MARK: fuzzySearch
    // =================

    let searchTimerId
    let searchBuffer = ""

    this.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape") searchBuffer = ""
        if (e.ctrlKey || e.altKey || e.metaKey) return
        if (e.key.length !== 1) return

        clearTimeout(searchTimerId)
        searchBuffer += e.key

        const res = this.fuzzySearch(searchBuffer)[0]
        if (res) {
          const el = /** @type {IconComponent} */ (
            this.virtualizable.scrollToElement(res.index)
          )
          if (el) {
            this.selectable.selectOne(el)
            el.focus({ preventScroll: true })
          }
        }

        searchTimerId = setTimeout(() => {
          searchBuffer = ""
        }, 1500)
      },
      { signal },
    )

    this.addEventListener(
      "paste",
      async (e) => {
        // fileClipboard.pasteTo(this.value)
        this.importFromDataTransfer(await dataTransfertImport(e))
      },
      { signal },
    )

    // MARK: focus
    // ===========

    this.addEventListener(
      "pointerdown",
      (e) => {
        if (e.target === this && this.contains(document.activeElement)) {
          e.preventDefault()
        }
      },
      { signal },
    )

    this.addEventListener(
      "focus",
      () => {
        if (document.activeElement !== this) return
        queueMicrotask(() => {
          if (this.selection.length > 0) return
          this.matrixable.focusTop({ ctrlKey: true })
          // const el = /** @type {HTMLElement} */ (this.firstElementChild)
          // el?.focus({ preventScroll: true })
        })
      },
      { signal },
    )

    // setTimeout(() => {
    //   this.matrixable.focusTop()
    // }, 100)

    // // @ts-ignore
    // this.addEventListener(
    //   "ui.matrix.focus",
    //   ({ detail }) => {
    //     console.log(detail)
    //   },
    //   { signal },
    // )

    // MARK: keyboard shortcuts
    // ========================

    getFolderShortcutHandlers(this).then((handlers) =>
      on(this, { signal }, handlers),
    )
  }
}

export const folder = Component.define(FolderComponent)

// MARK: folder icon
// =================

document.addEventListener("ui.check-icon-folder", async ({ target: icon }) => {
  icon.transferable?.destroy()
  icon.transferable = transferable(icon, {
    kind: "42_TR_ICON",
    accept: { mimetype: "*" },
    effects: ["move", "copy"],
    dragoverOutline: false,
    items: false,
    import(details) {
      if (!icon.folderPath) {
        icon.transferable?.destroy()
        return "revert"
      }

      const { paths, files, folders, effect, isDropImports } = details

      if (paths?.length > 0) {
        if (effect === "copy") {
          actions.copyPath(paths, icon.folderPath)
          return "restore"
        }
        actions.movePath(paths, icon.folderPath)
      } else if (isDropImports) {
        for (const path of folders) {
          const dirname = icon.folderPath + path
          fs.writeDir(dirname)
        }

        for (const [path, file] of Object.entries(files)) {
          const filename = icon.folderPath + path
          fs.write(filename, file)
        }
      } else {
        return "revert"
      }

      return "vanish"
    },
  })
})
