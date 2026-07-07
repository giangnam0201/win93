import { Component } from "../../api/gui/Component.js"
import { createFuzzySearch, sortByScore } from "../../lib/algo/fuzzySearch.js"
import { fuzzyResultsToPlan } from "../../api/gui/helper/fuzzyResultsToPlan.js"
import { Frecency } from "../../lib/structure/Frecency.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { MenuComponent } from "./menu.js"
import { noop } from "../../lib/type/function/noop.js"
import { i18n } from "../../api/i18n.js"
import { isPromiseLike } from "../../lib/type/any/isPromiseLike.js"

/**
 * @import { FuzzyResult } from "../../lib/algo/fuzzySearch.js"
 *
 * @typedef {{
 *   prefix?: string,
 *   load: (() => any[] | Promise<any[]>),
 *   getText?: (item: any) => string,
 *   frecency?: boolean,
 * }} ListboxMode
 *
 * @typedef {{
 *   text: string,
 *   item?: any,
 *   score?: number,
 *   matches?: FuzzyResult["matches"],
 * }} ListboxEntry
 */

// MARK: Presets
// =============

/** @type {Record<string, () => ListboxMode>} */
const presets = {
  apps: () => ({
    prefix: ">",
    async load() {
      const { os } = await import("../../api/os.js")
      await os.apps.ready
      return Object.values(os.apps.value).map(({ name }) => name)
    },
  }),
  exec: () => ({
    prefix: "$",
    async load() {
      const { os } = await import("../../api/os.js")
      await os.apps.ready
      return Object.values(os.apps.value).map(({ command }) => command)
    },
  }),
  help: () => ({
    prefix: "?",
    frecency: false,
    async load() {
      const { inApple } = await import("../../api/env/browser/inApple.js")
      return [
        { label: "… Open file", shortcut: inApple ? "⌘+P" : "Ctrl+P" },
        { label: "> Apps", shortcut: inApple ? "⌘+Shift+P" : "Ctrl+Shift+P" },
        { label: "? Help" },
      ]
    },
  }),
  files: () => ({
    async load() {
      const { os } = await import("../../api/os.js")
      const homeItems = []
      const items = []
      os.fileIndex.readDir("/", { recursive: true, absolute: true }, (text) => {
        if (
          text.endsWith("/") ||
          text.endsWith(".desktop") ||
          text.endsWith(".directory")
        ) {
          return
        }

        if (text.startsWith(os.env.HOME)) {
          homeItems.push(text)
        } else {
          items.push(text)
        }
      })
      return [...homeItems, ...items]
    },
  }),
}

/**
 * @param {any} def
 * @param {string} name
 * @returns {ListboxMode | undefined}
 */
function resolveMode(def, name) {
  if (def === true) return presets[name]?.()
  if (typeof def === "object") {
    const preset = presets[name]?.()
    return preset ? { ...preset, ...def } : def
  }
}

// MARK: getText
// =============

function defaultGetText(item) {
  if (typeof item === "string") return item
  return item?.label ?? item?.text ?? item?.value ?? ""
}

/**
 * @param {any[]} source
 * @param {(item: any) => string} [getText]
 * @returns {ListboxEntry[]}
 */
function toEntries(source, getText = defaultGetText) {
  const out = []
  for (const item of source) {
    const text = getText(item)
    out.push(typeof item === "string" ? { text } : { text, item })
  }
  return out
}

/**
 * @param {ListboxEntry} entry
 * @returns {any}
 */
function entryToPlan(entry) {
  const sourceItem = entry.item

  // Spread source plan properties (label, picto, shortcut, disabled, etc.)
  const plan =
    sourceItem && typeof sourceItem === "object" ? { ...sourceItem } : {}

  if (entry.matches) {
    plan.label = () => fuzzyResultsToPlan(entry)
  } else {
    plan.label ??= entry.text
  }

  return plan
}

// MARK: Listbox
// =============

export class ListboxComponent extends MenuComponent {
  static plan = {
    tag: "ui-listbox",
    role: "listbox",
    id: true,
  }

  /** Items after filtering/sorting, before conversion to plans. */
  items = []

  emptyLabel = i18n("No matching results")

  itemRole = "option"
  fuzzy = true
  frecency = false
  limit = 50

  /** @type {(item: any) => string} */
  #getText = noop

  get getText() {
    return this.#getText
  }
  set getText(value) {
    this.#getText = value ?? noop
    this.#needsResolve ||= !Array.isArray(this.#contentRaw)
    this.#buildIndex()
    if (this.isRendered) this.rerender()
    else this.ready.then(() => this.rerender())
  }

  /** @type {(item: any) => any} */
  #renderElement = noop

  get renderElement() {
    return this.#renderElement
  }
  set renderElement(value) {
    this.#renderElement = value ?? noop
    if (this.isRendered) this.rerender()
    else this.ready.then(() => this.rerender())
  }

  #contentRaw = []
  #source = []
  #entries = []
  #defaultResults = []
  #fuzzySearchFn
  #frecencyInstance
  #search = ""
  #oldmode
  #mode
  #baseMode
  #loadedMode
  #modes = {}
  #history = {}
  #needsResolve = true
  #pickedItem
  #pickedText = ""
  #hasPicked = false

  // MARK: search
  get search() {
    return this.#search
  }
  set search(query) {
    this.#search = query
    if (this.isRendered) this.rerender()
    else if (this.renderReady?.isPending) {
      this.ready.then(() => this.rerender())
    }
  }

  // MARK: content
  get content() {
    return this.#contentRaw
  }
  set content(value) {
    this.#contentRaw = value ?? []
    this.#needsResolve = !Array.isArray(this.#contentRaw)

    if (!this.#needsResolve) {
      this.#setSource(this.#contentRaw)
    }

    if (this.isRendered) this.rerender()
    else this.ready.then(() => this.rerender())
  }

  // MARK: list
  get list() {
    return this.items
  }

  // MARK: itemRenderer
  get itemRenderer() {
    return this.renderElement === noop ? noop : this.renderElement
  }
  set itemRenderer(value) {
    this.renderElement = value ?? noop
  }

  // MARK: multiselectable
  get multiselectable() {
    return this.getAttribute("aria-multiselectable") === "true"
  }
  set multiselectable(value) {
    this.setAttribute("aria-multiselectable", String(Boolean(value)))
  }

  // MARK: autopick
  get autopick() {
    return this.hasAttribute("autopick")
  }
  set autopick(value) {
    this.toggleAttribute("autopick", Boolean(value))
  }

  // MARK: history
  get history() {
    return this.#history
  }
  set history(value) {
    this.#history = value ?? {}
    if (this.#frecencyInstance) {
      this.#frecencyInstance.history = this.#history
    }
  }

  // MARK: mode
  get mode() {
    return this.#mode
  }
  set mode(name) {
    this.#oldmode = this.#mode
    this.#baseMode = name
    this.#mode = name
    this.#loadedMode = undefined
    if (this.isRendered) this.rerender()
    else if (this.renderReady?.isPending) {
      this.ready.then(() => this.rerender())
    }
  }

  // MARK: modes
  get modes() {
    return this.#modes
  }
  set modes(value) {
    this.#modes = value ?? {}
  }

  // MARK: activate
  activate(idx, e, target) {
    if (target?.disabled || target?.dataset.disabled === "true") return
    this.items[idx]?.action?.(e, target)
    this.pick(idx)
  }

  // MARK: pick
  pick(idx) {
    const entry = this.items[idx]
    if (!entry) return

    this.#pickedItem = entry.item
    this.#pickedText = entry.text
    this.#hasPicked = true
    this.#syncPickedSelection()

    if (this.frecency && this.#frecencyInstance) {
      if (this.#search) {
        this.#frecencyInstance.recordSelection("", entry.text)
      }
      this.#frecencyInstance.recordSelection(this.#search, entry.text)
    }

    const detail = entry.item ?? entry
    dispatch(this, "ui:listbox.pick", { detail })
  }

  // MARK: #setSource
  #setSource(items) {
    this.#source = items ?? []
    this.#buildIndex()
  }

  // MARK: #isPickedEntry
  #isPickedEntry(entry) {
    if (!this.#hasPicked || !entry) return false
    if (entry.item !== undefined || this.#pickedItem !== undefined) {
      return entry.item === this.#pickedItem
    }
    return entry.text === this.#pickedText
  }

  // MARK: #syncPickedSelection
  #syncPickedSelection() {
    if (this.multiselectable) return

    for (const itemEl of this.querySelectorAll(`.${this.itemClass}`)) {
      const idx = Number(/** @type {HTMLElement} */ (itemEl).dataset.index)
      const entry = this.items[idx]
      if (this.#isPickedEntry(entry)) {
        itemEl.setAttribute("aria-selected", "true")
      } else {
        itemEl.removeAttribute("aria-selected")
      }
    }
  }

  // MARK: #resolveContent
  async #resolveContent() {
    if (!this.#needsResolve) return

    /** @type {any} */
    let items = this.#contentRaw
    if (typeof items === "function") {
      items = items(this)
    }
    if (isPromiseLike(items)) {
      items = await items
    }
    if (this.signal.aborted) return

    this.#needsResolve = false
    this.#setSource(Array.isArray(items) ? items : [])
  }

  // MARK: #getModes
  #getModes() {
    const modes = { ...this.#modes }
    if (this.#mode && this.#mode in presets && !(this.#mode in modes)) {
      modes[this.#mode] = true
    }
    return modes
  }

  // MARK: #buildIndex
  #buildIndex() {
    const getText = this.getText === noop ? defaultGetText : this.getText
    this.#entries = toEntries(this.#source, getText)
    this.#defaultResults = this.#entries
      .map((e) => ({ ...e, score: 0 }))
      .sort(sortByScore)

    this.#fuzzySearchFn =
      this.fuzzy && this.#entries.length > 0
        ? createFuzzySearch(this.#entries.map((e) => e.text))
        : undefined

    if (this.frecency && !this.#frecencyInstance) {
      this.#frecencyInstance = new Frecency({
        accessor: (entry) => entry.text,
        // @ts-ignore
        history: this.#history,
      })
    }
  }

  async initMode(query = this.#search) {
    const modes = this.#getModes()
    const modeEntries = Object.entries(modes)

    if (modeEntries.length > 0) {
      for (const [name, def] of modeEntries) {
        const mode = resolveMode(def, name)
        if (mode?.prefix && query.startsWith(mode.prefix)) {
          this.#mode = name
          if (this.#loadedMode !== name) {
            await this.#loadMode(name, modes)
          }

          return query.slice(mode.prefix.length).trim()
        }
      }

      this.#mode = this.#baseMode

      if (!this.#mode && "files" in modes) {
        this.#mode = "files"
      }

      if (this.#loadedMode !== this.#mode) {
        await this.#loadMode(this.#mode, modes)
      }

      return query
    }

    if (this.#mode && this.#mode in presets) {
      if (this.#loadedMode !== this.#mode) {
        await this.#loadMode(this.#mode, { [this.#mode]: true })
      }
      return query
    }

    return query
  }

  // MARK: render
  async render() {
    const query = await this.initMode()

    if (!this.#loadedMode) {
      await this.#resolveContent()
    }

    let list

    list =
      query && this.fuzzy && this.#fuzzySearchFn
        ? this.#fuzzySearchFn(query)
        : this.#defaultResults.map((e) => ({ ...e }))

    // Frecency sorting
    const modeConf = this.#mode
      ? resolveMode(this.#modes[this.#mode], this.#mode)
      : undefined
    const useFrecency =
      modeConf?.frecency !== false && this.frecency && this.#frecencyInstance

    if (useFrecency) {
      this.#frecencyInstance.sortResults(query ?? "", list)
    }

    // Limit
    if (this.limit < list.length) {
      list = list.slice(0, this.limit)
    }

    this._content = list
    return super.render().then((res) => {
      this.#syncPickedSelection()
      if (this.items.length > 0) this.highlight(0)
      return res
    })
  }

  renderItem(item, i) {
    if (this.renderElement !== noop) {
      return super.renderItem(this.renderElement(item), i)
    }
    return super.renderItem(entryToPlan(item), i)
  }

  // MARK: #loadMode
  async #loadMode(name, modes = this.#getModes()) {
    const oldmode = this.#oldmode
      ? resolveMode(modes[this.#oldmode], this.#oldmode)
      : undefined
    const mode = resolveMode(modes[name], name)
    if (!mode) return

    this.#mode = name
    dispatch(this, "ui:listbox.mode-change", {
      detail: {
        mode,
        oldmode,
      },
    })

    let items
    if (typeof mode.load === "function") {
      items = await mode.load()
    } else if (Array.isArray(mode.load)) {
      items = mode.load
    }

    this.#loadedMode = name

    this.#setSource(items ?? [])
    return items
  }
}

export const listbox = Component.define(ListboxComponent)
