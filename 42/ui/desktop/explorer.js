/* eslint-disable max-depth */
import "../media/folder.js"
import { os } from "../../api/os.js"
import { fs } from "../../api/fs.js"
import { uid } from "../../api/uid.js"
import { Dragger } from "../../lib/dom/Dragger.js"
import { Component } from "../../api/gui/Component.js"
import { parsePath } from "../../lib/syntax/path/parsePath.js"
import { fileIndex } from "../../api/fileIndex.js"
import { getDirname } from "../../lib/syntax/path/getDirname.js"
import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { toPlanObject } from "../../api/gui/render.js"
import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { untilNextTask } from "../../lib/timing/untilNextTask.js"
import { resolvePath } from "../../lib/syntax/path/resolvePath.js"
import { truncate } from "../../lib/type/string/truncate.js"
import { pluralize } from "../../lib/type/string/pluralize.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { keep } from "../../api/keep.js"
import {
  dialog,
  confirm,
  prompt,
  extractDialogOptions,
} from "../layout/dialog.js"
import {
  normalizeDirname,
  normalizeFilename,
} from "../../api/fs/normalizeFilename.js"
import { getSortableDateTime } from "../../lib/date/getSortableDateTime.js"
import { incrementFilename } from "../../api/fs/incrementFilename.js"

/** @import { FolderComponent } from "../media/folder.js" */
/** @import { DialogComponent } from "../layout/dialog.js" */
/** @import { IconComponent } from "../media/icon.js" */

function focusIfDocumentHasFocus(el) {
  if (el.ownerDocument.hasFocus()) el.focus()
}

/* MARK: Explorer
================= */

export class ExplorerComponent extends Component {
  /** @type {DialogComponent} */
  dialogEl

  static plan = {
    tag: "ui-explorer",
    props: {
      value: true,
      glob: true,
      multiselectable: true,
    },

    on: {
      "Alt+Up || Backspace": (e, target) => {
        if (
          e.key === "Backspace" &&
          e.target.form !== undefined &&
          e.target.localName !== "button"
        ) {
          return
        }
        target.folderUp()
      },
    },
  }

  #value
  get value() {
    return this.#value
  }
  set value(path) {
    path = normalizeFilename(path, { preserveDir: true })

    let parsed

    if (fileIndex.has(path)) {
      if (fileIndex.isFile(path)) {
        parsed = parsePath(path)
        path = parsed.dir
      }
    }

    if (path !== "/" && !path.endsWith("/")) path += "/"

    this.#value = path

    const setWhenReady = !this.ready.isPending

    this.ready.then(async () => {
      this.navEl.value = path

      if (this.dialogEl) {
        if (this.#title) {
          this.dialogEl.title = this.#title
        } else {
          this.dialogEl.title =
            this.titlePrefix + (path === "/" ? path : getBasename(path))
        }

        if (this.#picto) {
          this.dialogEl.picto = this.#picto
        } else {
          this.dialogEl.picto = "places/folder"
          os.icons.getIconFromPath(path, "16x16").then((iconInfo) => {
            this.dialogEl.picto = iconInfo?.image ?? "places/folder"
          })
        }
      }

      if (setWhenReady) this.folderEl.value = path

      if (parsed) {
        await this.folderEl.ready

        const filename = `${parsed.dir === "/" ? "" : parsed.dir}/${parsed.base}`

        const idx = this.folderEl.virtualizable.items.indexOf(filename)
        if (idx !== -1) {
          const el = this.folderEl.virtualizable.scrollToElement(idx)
          if (el) {
            this.folderEl.selectable.selectOne(el)
            el.focus({ preventScroll: true })
          }
        }
      }
    })
  }

  #glob = false
  get glob() {
    if (this.folderEl) return this.folderEl.glob
    return this.#glob
  }
  set glob(value) {
    this.#glob = value
    if (this.folderEl) this.folderEl.glob = value
  }

  #filter = ""
  get filter() {
    if (this.folderEl) return this.folderEl.filter
    return this.#filter
  }
  set filter(value) {
    this.#filter = value
    if (this.folderEl) this.folderEl.filter = value
  }

  #filterType = ""
  get filterType() {
    if (this.folderEl) return this.folderEl.filterType
    return this.#filterType
  }
  set filterType(value) {
    this.#filterType = value
    if (this.folderEl) this.folderEl.filterType = value
  }

  #multiselectable = true
  get multiselectable() {
    return this.#multiselectable
  }
  set multiselectable(value) {
    this.#multiselectable = value
    if (this.folderEl) this.folderEl.multiselectable = value
  }

  get selection() {
    return this.folderEl?.selectable.selection
  }
  set selection(value) {
    if (value?.length === 0) return
    this.ready
      .then(() => this.folderEl.ready)
      .then(() => {
        this.folderEl.selection = value
      })
  }

  async selectAll() {
    this.ready
      .then(() => this.folderEl.ready)
      .then(() => {
        this.folderEl.selectable.selectAll()
      })
  }

  #isPicker = false
  get isPicker() {
    return this.#isPicker
  }
  set isPicker(value) {
    this.#isPicker = Boolean(value)
  }

  #showDisabledFilesOption = false
  get showDisabledFilesOption() {
    return this.#showDisabledFilesOption
  }
  set showDisabledFilesOption(value) {
    this.#showDisabledFilesOption = Boolean(value)
  }

  #titlePrefix = ""
  get titlePrefix() {
    return this.#titlePrefix
  }
  set titlePrefix(value) {
    this.#titlePrefix = String(value)
    if (this.dialogEl) this.dialogEl.title = this.#titlePrefix + this.#value
  }

  #title = ""
  get title() {
    return this.#title
  }
  set title(value) {
    this.#title = String(value)
    if (this.dialogEl) this.dialogEl.title = this.#title
  }

  #picto = ""
  get picto() {
    return this.#picto
  }
  set picto(value) {
    this.#picto = String(value)
    if (this.dialogEl) this.dialogEl.picto = this.#picto
  }

  folderUp() {
    let path = getDirname(this.value)
    if (!path.endsWith("/")) path += "/"
    this.value = path
  }

  updated(key, val) {
    if (key === "value") {
      this.value = val
    }
  }

  go(path) {
    if (path === this.value) {
      this.ready.then(() => {
        if (this.folderEl) this.folderEl.refresh()
      })
    }
    this.value = path
  }

  close(ok) {
    this.dialogEl.close(ok)
  }

  /* MARK: render
  --------------- */

  async render() {
    const dir = this.value

    let inContextMenu = false

    const getMenuItems = () => {
      const menuItems = [
        {
          label: "Refresh",
          action: () => this.folderEl.refresh(),
        },
        {
          label: "Show Hidden Files",
          tag: "checkbox",
          checked: this.folderEl.showHiddenFiles,
          action: () =>
            (this.folderEl.showHiddenFiles = !this.folderEl.showHiddenFiles),
        },
      ]

      if (this.showDisabledFilesOption && this.filter) {
        menuItems.push({
          label: "Show Disabled Files",
          tag: "checkbox",
          checked: this.filterType === "disable",
          action: () => {
            this.filterType = this.filterType === "disable" ? "" : "disable"
            return this.filterType === "disable"
          },
        })
      }

      return menuItems
    }

    return [
      {
        tag: "header.ui-explorer__header.cols.gap-xxs.ma-b-xxs",
        content: [
          {
            tag: "button.ui-explorer__button.ui-explorer__button--up",
            picto: "arrow-right-to-up",
            title: "Go up (Alt+Up)",
            onclick: () => this.folderUp(),
          },
          {
            tag: "input.ui-explorer__nav",
            inputmode: "url",
            value: dir,
            enterKeyHint: "go",
            on: {
              Enter: ({ target }) => {
                this.go(target.value)
              },
              focus({ target }) {
                const { length } = target.value
                target.selectionStart = length
                target.selectionEnd = length
              },
            },
          },
          {
            tag: "button.ui-explorer__button.ui-explorer__button--desktop",
            // picto: "places/folder-desktop",
            picto: "desktop",
            // aria: { pressed: dir === os.env.HOME + "/desktop/" },
            aria: { pressed: false },
            title: "Go to desktop",
            onclick: () => this.go("~/desktop"),
          },
          {
            tag: "button.ui-explorer__button.ui-explorer__button--home",
            picto: "home",
            // aria: { pressed: dir === os.env.HOME + "/" },
            aria: { pressed: false },
            title: "Go to home folder",
            onclick: () => this.go("~"),
          },
          {
            tag: "button.ui-explorer__button.ui-explorer__button--menu",
            picto: "bars",
            title: "Menu",
            menu: () => getMenuItems(),
          },
        ],
      },
      {
        tag: "ui-folder.ui-explorer__body.document-style.inset",
        value: dir,
        glob: this.glob,
        filter: this.filter,
        filterType: this.filterType,
        multiselectable: this.multiselectable,

        autofocus: true,
        on: [
          {
            "ui.render": () => {
              dispatch(this, "ui:explorer.navigate")
            },
          },
          {
            "prevent": true,
            "contextmenu": (e) => {
              if (e.pointerType === "touch") inContextMenu = true
              this.folderEl.displayContextMenu(e)
            },
            "Ctrl+h": () => {
              this.folderEl.showHiddenFiles = !this.folderEl.showHiddenFiles
            },
          },
          {
            "selector": "ui-icon[folder]",
            "Ctrl+dblclick || Ctrl+Enter": (e, icon) => explorer(icon.value),
          },
          {
            "prevent": true,
            "selector": "ui-icon",
            "touchend || dblclick || Enter": (e, icon) => {
              if (inContextMenu) {
                inContextMenu = false
                return
              }

              if (Dragger.isDragging) return

              if (icon.ariaDescription === "folder") {
                return this.go(icon.value)
              }

              if (this.isPicker) {
                this.folderEl.selectable.ensureSelected(icon)
                return this.dialogEl.close(true)
              }

              if (icon.ariaDescription === "shortcut") {
                if (fileIndex.isDir(icon.command)) {
                  this.go(icon.command)
                } else {
                  os.exec(icon.command, { cwd: this.value })
                }
              } else {
                os.apps.open(icon.value)
              }
            },
          },
        ],
      },
    ]
  }

  created() {
    this.dialogEl = this.closest("ui-dialog")
    /** @type {FolderComponent} */
    this.folderEl = this.querySelector("ui-folder")
    /** @type {HTMLInputElement} */
    this.navEl = this.querySelector(".ui-explorer__nav")
  }
}

Component.define(ExplorerComponent)

/* MARK: explorer
================= */

let index = 0

/**
 * @param {string} [path]
 * @param {any} [options]
 */
export async function explorer(path = "/", options = {}) {
  path = String(path) || "/"

  const dialogOptions = extractDialogOptions(options, ["picto"])
  dialogOptions.width ??= 442 // 416
  dialogOptions.height ??= 342 // 316

  if (options.signal) {
    dialogOptions.signal = options.signal
    delete options.signal
  }

  const dialogEl = await dialog({
    label: path,
    picto: "transparent",
    class: {
      "ui-dialog-explorer": true,
      "app__explorer": true,
    },
    id: `app__explorer__${index++}`,
    content: {
      tag: "ui-explorer",
      value: path,
      ...options,
    },
    pivot: options.isPicker ? "center" : undefined,
    pivotKind: options.isPicker ? "file-picker" : undefined,
    geometryKind: options.isPicker ? undefined : "explorer",
    footer: options.isPicker
      ? undefined
      : {
          class: {
            "ui-explorer__footer": true,
            "w-full": true,
          },
          content: [
            {
              tag: "input.ui-explorer__status._inset-shallow",
              style: { background: "var(--panel-bg)" },
              readonly: true,
              on: {
                focus: (e, target) => {
                  target.select()
                },
              },
            },
            {
              tag: ".ui-explorer__digest.field.gap-false.shrink.hide-empty",
              style: { minWidth: "11ch", background: "var(--panel-bg)" },
              content: [{ tag: "span" }, { tag: "span" }],
            },
          ],
        },
    ...dialogOptions,
  })

  /** @type {ExplorerComponent} */
  const explorerEl = dialogEl.querySelector("ui-explorer")

  /* MARK: status
  =============== */
  if (options.isPicker !== true) {
    const statusEl = /** @type {HTMLInputElement} */ (
      dialogEl.querySelector(".ui-explorer__status")
    )
    const digestEl = dialogEl.querySelector(".ui-explorer__digest")

    const setDigest = () => {
      const total = explorerEl.folderEl.virtualizable.items.length
      const sel = explorerEl.folderEl.selection.length
      digestEl.firstElementChild.classList.toggle("txt-b", sel === total)
      digestEl.firstElementChild.textContent = sel ? `${sel} / ${total}` : total
      digestEl.lastElementChild.textContent = `${pluralize("item", total)}`
    }
    setDigest()
    explorerEl.folderEl.addEventListener("ui.render", setDigest)

    explorerEl.addEventListener("ui.selection.change", (e) => {
      setDigest()
      const { selection } = e.detail
      statusEl.value =
        selection.length === 0
          ? ""
          : selection.length === 1
            ? selection[0]
            : JSON.stringify(selection)
    })
  }

  await explorerEl.ready
  return explorerEl
}

/* MARK: getFolderFilter
======================== */

async function getFolderFilter(types, excludeAcceptAllOption, filterEl) {
  let filterValue
  const allFiles = "All Files"
  const filterDict = {}

  if (excludeAcceptAllOption !== true) {
    filterDict[allFiles] = { value: "" }
    filterEl.append(new Option(allFiles))

    // const sep = new Option("---")
    // sep.disabled = true
    // filterEl.append(sep)
  }

  if (types) {
    await os.mimetypes.ready
    for (const type of types) {
      if (!isHashmapLike(type.accept)) continue

      const exts = new Set()
      for (const [key, val] of Object.entries(type.accept)) {
        for (const ext of val) exts.add(ext)

        for (const { extnames } of os.mimetypes.list(key)) {
          if (extnames) for (const ext of extnames) exts.add(ext)
        }
      }

      const list = []
      const values = []

      for (const ext of exts) {
        list.push(ext)
        values.push(`*${ext}`)
      }

      const value = values.join(",")

      const displayValue =
        type.description ?? truncate(value, { lastBreak: "," })

      filterDict[displayValue] = {
        value,
        exts: list,
        mainExt: list[0],
      }

      filterValue ??= displayValue

      filterEl.append(new Option(displayValue))
    }
  }

  filterValue ??= allFiles
  filterEl.value = filterValue

  return {
    allFiles,
    filterValue,
    filterDict,
  }
}

let filePickerKeep
async function normalisePickerPath(options, type) {
  if (options?.path) return options?.path

  if (options?.id) {
    filePickerKeep ??= await keep("~/config/explorer.json5")
    if (filePickerKeep[type]?.[options.id]) {
      return filePickerKeep[type][options.id]
    }
  }

  return options?.startIn
    ? resolvePath(os.env.HOME, options.startIn)
    : os.env.HOME
}

/* MARK: filePicker
=================== */

async function filePicker(path, options, DEFAULT) {
  if (typeof path !== "string" && !options) {
    options = path
    path = undefined
  }

  path ||= await normalisePickerPath(options, DEFAULT.type)

  if (options?.accept && !options?.types) {
    let { accept } = options
    if (typeof accept === "string") {
      const keys = accept.split(/\s*,\s*/)
      accept = {}
      for (const key of keys) accept[key] = []
    }
    options.types = [{ accept, description: undefined }]
  }

  let {
    type,
    agree,
    decline,
    types,
    excludeAcceptAllOption,
    showDisabledFiles,

    // open
    multiple,
    returnFiles,

    // save
    suggestedName,
    suggestedNamePrefix,

    ...config
  } = /** @type {any} */ ({
    ...DEFAULT,
    ...options,
  })

  agree = toPlanObject(agree)
  decline = toPlanObject(decline)

  const dialogOptions = extractDialogOptions(config, ["picto"])

  const nameId = uid()
  const filterId = uid()

  const fileListEl = document.createElement("datalist")
  fileListEl.id = uid()

  const filterEl = document.createElement("select")
  filterEl.id = filterId

  const { allFiles, filterValue, filterDict } = await getFolderFilter(
    types,
    excludeAcceptAllOption,
    filterEl,
  )

  const pickerFilter =
    type === "save" ? undefined : filterDict[filterValue].value
  const pickerFilterType =
    type === "open" && showDisabledFiles ? "disable" : undefined

  // console.log(allFiles, filterValue, filterDict)

  const explorerEl = await explorer(path, {
    isPicker: true,
    filter: pickerFilter,
    filterType: pickerFilterType,
    showDisabledFilesOption: type === "open",

    multiselectable: type === "open" ? multiple : false,

    on: {
      error({ error }) {
        console.log(error)
      },
    },

    dialog: {
      class: [
        "ui-dialog-explorer",
        "ui-dialog-filepicker",
        `ui-dialog-filepicker--${type}`,
      ],
      footer: {
        class: {
          "ui-explorer__footer": true,
          "w-full": true,
          "rows": true,
          "gap-xs": true,
          "pa-xs": true,
        },
        content: [
          {
            tag: "table.table-form.w-full",
            content: [
              [
                {
                  tag: "label.txt-right",
                  content: "Name",
                  for: nameId,
                },
                {
                  tag: "td",
                  content: [
                    {
                      tag: `input#${nameId}`,
                      inputmode: type === "open" ? "none" : undefined,
                      autocomplete: "off",
                      enterkeyhint: "done",
                      renamable: true,
                      list: fileListEl.id,
                      on: {
                        preventDefault: true,
                        Enter: () => explorerEl.dialogEl.close(true),
                      },
                    },
                    fileListEl,
                  ],
                },
                {
                  tag: "button.ui-dialog__agree.w-full",
                  disabled: true,
                  onclick: () => explorerEl.dialogEl.close(true),
                  ...agree,
                },
              ],
              [
                {
                  tag: "label.txt-right",
                  content: "Filter",
                  for: filterId,
                },
                filterEl,
                {
                  tag: "button.ui-dialog__decline.w-full",
                  onclick: () => explorerEl.dialogEl.close(),
                  ...decline,
                },
              ],
            ],
          },
        ],
      },
      ...dialogOptions,
    },

    ...config,
  })

  explorerEl.filter = pickerFilter
  explorerEl.filterType = pickerFilterType
  explorerEl.showDisabledFilesOption = type === "open"

  let { selection, folderEl, signal } = explorerEl

  const agreeEl = /** @type {HTMLButtonElement} */ (
    explorerEl.dialogEl.querySelector(".ui-dialog__agree")
  )

  const nameEl = /** @type {HTMLInputElement} */ (
    explorerEl.dialogEl.querySelector(`input#${nameId}`)
  )

  const nameRenamable = nameEl[Symbol.for("Trait.INSTANCES")].renamable

  // MARK: Selection
  // ---------------

  function fromInputToSelection() {
    const elements = []

    for (const item of nameEl.value.split(/\s*,\s*/)) {
      const path = explorerEl.value + item
      const icon = folderEl.selectable.getElement(path)
      if (icon) elements.push(icon)
    }

    if (elements.length > 0) {
      folderEl.selectable.setElements(elements, { silent: true })
    } else {
      folderEl.selectable.clear({ silent: true })
      selection.length = 0
      checkValidity()
    }
  }

  function fromInputToFilter(options) {
    const ext = nameRenamable.getExt()
    if (ext) {
      let firstKey

      for (const [key, val] of Object.entries(filterDict)) {
        firstKey ??= key
        if (val.exts?.includes(ext)) {
          filterEl.value = key
          if (options?.fromInput !== true) applyFilter()
          return
        }
      }

      if (firstKey === allFiles) filterEl.value = allFiles

      if (options?.fromInput !== true) applyFilter()
    }
  }

  nameEl.addEventListener(
    "input",
    () => {
      fromInputToFilter({ fromInput: true })
      fromInputToSelection()
    },
    { signal },
  )

  // MARK: Validation
  // ----------------

  const checkValidity = () => {
    agreeEl.disabled = nameEl.value.length === 0
  }

  checkValidity()

  function setNewName(value) {
    nameEl.value = value
    if (type === "save") {
      fromInputToFilter()
      if (nameEl.value !== value) {
        fromInputToSelection()
      }
    }
  }

  folderEl.addEventListener(
    "ui.selection.change",
    (e) => {
      let hasFolder = false
      selection = e.detail.selection.filter((path) => {
        const isFolder = path.endsWith("/")
        hasFolder ||= isFolder
        return !isFolder
      })

      let value = ""

      for (let i = 0, l = selection.length; i < l; i++) {
        const item = selection[i]
        value += item.slice(explorerEl.value.length)
        if (i !== l - 1) value += ", "
      }

      if (type === "save") {
        if (selection.length > 0) {
          setNewName(value)
          if (e.detail.originalEvent?.type !== "keydown") {
            focusIfDocumentHasFocus(nameEl)
          }
        }
      } else if (!(hasFolder && selection.length === 0)) {
        setNewName(value)
      }

      checkValidity()
    },
    { signal },
  )

  // MARK: Filter
  // ------------

  function applyFilter() {
    const filterData = filterDict[filterEl.value]

    if (
      filterData.mainExt &&
      !filterData.exts.includes(nameRenamable.getExt())
    ) {
      nameRenamable.setExt(filterData.mainExt)
    } else if (!nameRenamable.getExt()) {
      nameRenamable.setExt(".txt")
    }

    if (type === "open") folderEl.filter = filterData.value
    setFilterElTitle()
  }

  function setFilterElTitle() {
    filterEl.title = filterDict[filterEl.value].value
  }

  suggestedName ??=
    (suggestedNamePrefix ? `${suggestedNamePrefix}_` : "") +
    getSortableDateTime({ seconds: true })

  if (type === "save") {
    if (selection.length === 0) {
      nameEl.value = suggestedName
      fromInputToFilter()
      applyFilter()
      focusIfDocumentHasFocus(nameEl)
      checkValidity()
    }
  }

  filterEl.addEventListener("input", () => applyFilter(), { signal })
  setFilterElTitle()

  // MARK: Autocomplete
  // ------------------

  function populateFilelist(options) {
    const nodes = []

    for (const icon of /** @type {NodeListOf<IconComponent>} */ (
      folderEl.querySelectorAll("ui-icon:not([disabled])")
    )) {
      if (icon.value.endsWith("/")) continue // aria-description=file may not be ready
      nodes.push(new Option(getBasename(icon.value)))
    }

    fileListEl.replaceChildren(...nodes)

    if (type === "save") {
      if (selection.length === 0 && nameEl.value) {
        fromInputToSelection()
      }

      if (
        options?.firstCall !== true &&
        explorerEl.ownerDocument.activeElement !== filterEl
      ) {
        focusIfDocumentHasFocus(nameEl)
      }
    }
  }

  folderEl.addEventListener("ui.render", populateFilelist, { signal })

  populateFilelist({ firstCall: true })

  // MARK: Response
  // --------------

  return new Promise((resolve) => {
    explorerEl.dialogEl.addEventListener(
      "ui:dialog.close",
      async (e) => {
        explorerEl.abort()
        folderEl.abort() // TODO: check if explorerEl should abort folderEl

        // allow dialog closing animation
        await untilNextTask()

        const res = e.detail
        const directory = explorerEl.value

        if (!res.ok) {
          return resolve({
            ok: false,
            directory,
          })
        }

        if (config.id && filePickerKeep) {
          filePickerKeep[type] ??= {}
          filePickerKeep[type][config.id] = directory
        }

        const out = {
          ok: true,
          directory,
          selection,
        }

        if (type === "save") {
          if (selection.length === 0) {
            selection.push(explorerEl.value + nameEl.value)
          }

          if (fileIndex.has(selection[0])) {
            e.preventDefault()
            const base = selection[0].slice(explorerEl.value.length)
            const { activeElement } = explorerEl.ownerDocument
            confirm(
              `The file "${base}" already exists. Do you wish to overwrite it?`,
              {
                dialog: { animation: false },
                agree: "Overwrite",
                afterAgree: {
                  tag: "button",
                  content: "Rename",
                  action: (e, target) => {
                    target.closest("ui-dialog")?.close()
                    prompt("Enter the new name", {
                      value: getBasename(incrementFilename(selection[0])),
                      field: { prose: false, renamable: true },
                      dialog: { animation: false },
                    }).then((res) => {
                      console.log(res)
                    })
                  },
                },
                icon: "warning",
              },
            ).then((ok) => {
              if (ok) {
                resolve(out)
                explorerEl.dialogEl.remove()
              } else {
                // @ts-ignore
                activeElement.focus?.()
              }
            })
          } else resolve(out)
        } else if (type === "open") {
          if (returnFiles === true) {
            Promise.all(
              selection.map((path) =>
                path.endsWith("/") //
                  ? undefined
                  : fs.open(path),
              ),
            ).then((files) => {
              out.files = files
              resolve(out)
            })
          } else resolve(out)
        }
      },
      { signal },
    )
  })
}

/* MARK: folderPicker
===================== */

const DIRECORY_PICKER_DEFAULT = {
  titlePrefix: "Select a Folder — ",
  agree: "Choose",
  decline: "Cancel",
}

export async function folderPicker(path, options) {
  if (typeof path !== "string" && !options) {
    options = path
    path = await normalisePickerPath(options, "openFolder")
  }

  path = normalizeDirname(path)

  let {
    agree,
    decline,

    returnPaths,

    ...config
  } = /** @type {any} */ ({
    ...DIRECORY_PICKER_DEFAULT,
    ...options,
  })

  agree = toPlanObject(agree)
  decline = toPlanObject(decline)

  const dialogOptions = extractDialogOptions(config, ["picto"])

  const nameId = uid()

  const fileListEl = document.createElement("datalist")
  fileListEl.id = uid()

  const explorerEl = await explorer(path, {
    isPicker: true,
    filter: "*/",
    filterType: "disable",

    multiselectable: false,

    dialog: {
      class: [
        "ui-dialog-explorer",
        "ui-dialog-filepicker",
        `ui-dialog-filepicker--folder`,
      ],
      footer: {
        class: {
          "ui-explorer__footer": true,
          "w-full": true,
          "rows": true,
          "gap-xs": true,
          "pa-xs": true,
        },
        content: [
          {
            tag: ".cols.gap-xs",
            content: [
              {
                tag: "label.txt-right",
                content: "Name",
                for: nameId,
                style: { minWidth: "5ch" },
              },
              {
                tag: `input#${nameId}`,
                autocomplete: "off",
                enterkeyhint: "done",
                list: fileListEl.id,
                on: {
                  preventDefault: true,
                  Enter: () => explorerEl.dialogEl.close(true),
                },
              },
              fileListEl,
              {
                tag: "button.ui-dialog__decline",
                onclick: () => explorerEl.dialogEl.close(),
                ...decline,
              },
              {
                tag: "button.ui-dialog__agree.btn-default",
                disabled: true,
                onclick: () => explorerEl.dialogEl.close(true),
                ...agree,
              },
            ],
          },
        ],
      },
      ...dialogOptions,
    },

    ...config,
  })

  const { folderEl, signal } = explorerEl

  const agreeEl = /** @type {HTMLButtonElement} */ (
    explorerEl.dialogEl.querySelector(".ui-dialog__agree")
  )

  const nameEl = /** @type {HTMLInputElement} */ (
    explorerEl.dialogEl.querySelector(`input#${nameId}`)
  )

  const checkValidity = () => {
    agreeEl.disabled = nameEl.value.length === 0
  }

  nameEl.addEventListener(
    "input", //
    () => checkValidity(),
    { signal },
  )

  folderEl.addEventListener(
    "ui.selection.change",
    (e) => {
      const { selection } = e.detail
      nameEl.value = getBasename(selection[0] ?? "")
      checkValidity()
    },
    { signal },
  )

  // MARK: Autocomplete
  // ------------------

  function populateFilelist() {
    const nodes = []

    for (const icon of /** @type {NodeListOf<IconComponent>} */ (
      folderEl.querySelectorAll("ui-icon:not([disabled])")
    )) {
      if (!icon.value.endsWith("/")) continue
      nodes.push(new Option(getBasename(icon.value)))
    }

    fileListEl.replaceChildren(...nodes)
  }

  folderEl.addEventListener("ui.render", populateFilelist, { signal })

  populateFilelist()

  // MARK: Response
  // --------------

  return new Promise((resolve) => {
    explorerEl.dialogEl.addEventListener(
      "ui:dialog.close",
      async (e) => {
        // allow dialog closing animation
        await untilNextTask()

        const res = e.detail
        const directory =
          explorerEl.value + (nameEl.value ? nameEl.value + "/" : "")

        const out = {
          ok: res.ok,
          directory,
        }

        if (returnPaths) {
          out.paths = fileIndex.readDir(directory, {
            recursive: true,
            absolute: true,
            ...returnPaths,
          })
        }

        resolve(out)
      },
      { signal },
    )
  })
}

/* MARK: filePickerOpen
======================= */

const FILE_PICKER_OPEN_DEFAULT = {
  type: "open",
  titlePrefix: "Open File — ",
  agree: "Open",
  decline: "Cancel",

  multiple: false,
  returnFiles: false,
  showDisabledFiles: false,
}

export async function filePickerOpen(path, options) {
  return filePicker(path, options, FILE_PICKER_OPEN_DEFAULT)
}

/* MARK: filePickerSave
======================= */

const FILE_PICKER_SAVE_DEFAULT = {
  type: "save",
  titlePrefix: "Save File — ",
  agree: "Save",
  decline: "Cancel",

  // suggestedName: "untitled.txt",
}

export async function filePickerSave(path, options) {
  return filePicker(path, options, FILE_PICKER_SAVE_DEFAULT)
}
