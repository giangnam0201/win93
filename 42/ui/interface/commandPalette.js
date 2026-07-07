import "../layout/listbox.js"
import { Component } from "../../api/gui/Component.js"
import { i18n } from "../../api/i18n.js"
import { getIconFromFilename } from "../../api/os/managers/iconsManager/getIconFromFilename.js"
import { fuzzyResultsToPlan } from "../../api/gui/helper/fuzzyResultsToPlan.js"
import { on } from "../../lib/event/on.js"
import { queueTask } from "../../lib/timing/queueTask.js"
import { picto } from "../media/picto.js"
import { actions } from "../../api/os/actions.js"
import { appsManager } from "../../api/os/managers/appsManager.js"

/** @import {ListboxComponent} from "../layout/listbox.js" */

const modePrefixMap = {
  apps: ">",
  exec: "$",
  help: "?",
}

function resolvePaletteMode(mode, search = "") {
  const prefix = modePrefixMap[mode]
  const query = prefix ? prefix + search : search

  return {
    inputValue: query,
    search: query,
    mode: prefix ? undefined : (mode ?? "files"),
  }
}

function stripModePrefix(mode, search = "") {
  const prefix = modePrefixMap[mode]
  if (!prefix || !search.startsWith(prefix)) return search
  return search.slice(prefix.length)
}

export class CommandPaletteComponent extends Component {
  static plan = {
    tag: "ui-command-palette",
    skipRender: [
      "mode", //
      "history",
      "search",
    ],
  }

  /** @type {HTMLInputElement} */
  inputEl

  /** @type {ListboxComponent} */
  listboxEl

  #history = {}
  get history() {
    return this.#history
  }
  set history(value) {
    this.#history = value ?? {}
    this.ready.then(() => {
      this.listboxEl.history = this.#history
    })
  }

  #mode
  get mode() {
    return this.#mode
  }
  set mode(value) {
    value ??= "files"
    if (this.#mode === value) return
    this.#mode = value
    if (this.isRendered) this.#syncMode()
    else this.ready.then(() => this.#syncMode())
  }

  async render({ history, mode, search }) {
    const initialState = resolvePaletteMode(this.#mode ?? mode, search)

    return [
      {
        tag: "input",
        created: (el) => {
          this.inputEl = el
        },
        placeholder: i18n(
          "Search files by name (type ? to see available commands)",
        ),
        value: initialState.inputValue,
      },
      {
        tag: "ui-listbox.inset",
        created: (el) => {
          this.listboxEl = el
        },
        on: {
          "ui:listbox.mode-change": ({ detail: { mode, oldmode } }) => {
            if (
              oldmode?.prefix &&
              this.inputEl.value.startsWith(oldmode.prefix)
            ) {
              this.inputEl.value = this.inputEl.value.slice(
                oldmode.prefix.length,
              )
            }

            if (mode.prefix) {
              if (!this.inputEl.value.startsWith(mode.prefix)) {
                this.inputEl.value = mode.prefix + this.inputEl.value
              }
            }
          },
        },
        captureKeydown: false,
        autopick: true,
        fuzzy: true,
        frecency: true,
        limit: 50,
        history,
        mode: initialState.mode,
        search: initialState.search,
        modes: {
          files: true,
          apps: true,
          exec: true,
          help: true,
        },
        renderElement: (entry) => {
          const mode = this.listboxEl?.mode
          const isFilesMode = mode === "files"
          const isHelpMode = mode === "help"

          const content = []
          content.push({
            tag: ".ui-command-palette__item__path.truncate",
            content: () =>
              fuzzyResultsToPlan(entry, {
                isPath: isFilesMode,
              }),
          })
          if (isFilesMode) {
            content.push(
              {
                tag: "button.clear.ui-command-palette__action",
                title: actions.openContainingFolder.meta.label,
                content: () =>
                  picto(
                    actions.openContainingFolder.meta.picto ?? "folder-open",
                  ),
                dataset: { action: "openContainingFolder" },
              },
              {
                tag: "button.clear.ui-command-palette__action",
                title: actions.copyLocation.meta.label,
                content: () =>
                  picto(
                    actions.copyLocation.meta.picto, //
                  ),
                dataset: { action: "copyLocation" },
              },
            )
          }

          return {
            label: {
              tag: "span.ui-command-palette__item",
              content,
            },
            shortcut: isHelpMode ? entry.item?.shortcut : undefined,
            picto: () =>
              isFilesMode
                ? getIconFromFilename(entry.text, "16x16")
                : isHelpMode
                  ? undefined
                  : appsManager.getAppIcon(entry.text, "16x16"),
          }
        },
      },
    ]
  }

  created() {
    const { signal } = this

    if (document.hasFocus()) {
      this.opener = document.activeElement
      this.inputEl.focus()
    }

    let currentFocusList
    let focusIdx = -1

    on(
      { signal },
      {
        blur: () => document.hasFocus() && this.close(),
        pointerdown: (e) => {
          if (this.contains(/** @type {HTMLElement} */ (e.target))) return
          this.close()
        },
        keydown: (e) => {
          if (e.code === "Escape") this.close()
          if (e.code === "Tab") {
            e.preventDefault()

            currentFocusList ??=
              this.listboxEl.currentItem.querySelectorAll("button")

            focusIdx += e.shiftKey ? -1 : 1
            if (focusIdx > currentFocusList.length - 1) focusIdx = -1
            if (focusIdx < -1) focusIdx = currentFocusList.length - 1

            if (focusIdx === -1) this.inputEl.focus()
            else currentFocusList[focusIdx].focus()
          }
        },
      },

      this.listboxEl,
      {
        "stop": true,
        "selector": ".ui-command-palette__action",
        "pointerdown || Enter": (e, target) => {
          const entry = this.listboxEl.items[this.listboxEl.current]
          if (entry && target.dataset.action in actions) {
            actions[target.dataset.action]([entry.text])
            if (!e.ctrlKey) this.close()
          }
        },
        "ArrowDown": () => {
          this.listboxEl.highlightNext()
          // TODO: use https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-activedescendant
          currentFocusList =
            this.listboxEl.currentItem.querySelectorAll("button")
          currentFocusList[focusIdx].focus()
          return false
        },
        "ArrowUp": () => {
          this.listboxEl.highlightPrev()
          currentFocusList =
            this.listboxEl.currentItem.querySelectorAll("button")
          currentFocusList[focusIdx].focus()
          return false
        },
      },
      {
        selector: ".ui-menu__menuitem",
        pointerup: (e) => {
          this.pick(this.listboxEl.current, e)
        },
      },

      this.inputEl,
      {
        input: () => {
          this.listboxEl.search = this.inputEl.value
        },
        Enter: (e) => {
          this.pick(this.listboxEl.current, e)
          return false
        },
      },
      {
        repeatable: true,
        ArrowDown: () => {
          currentFocusList = undefined
          focusIdx = -1
          this.listboxEl.highlightNext()
          return false
        },
        ArrowUp: () => {
          currentFocusList = undefined
          focusIdx = -1
          this.listboxEl.highlightPrev()
          return false
        },
      },
    )
  }

  #syncMode() {
    if (!this.inputEl || !this.listboxEl) {
      return this.rerender()
    }

    const search = stripModePrefix(this.listboxEl.mode, this.inputEl.value)
    const state = resolvePaletteMode(this.#mode, search)

    this.inputEl.value = state.inputValue
    this.listboxEl.mode = state.mode
    this.listboxEl.search = state.search
  }

  pick(idx, e) {
    const entry = this.listboxEl.items[idx]
    if (!entry) return

    const { ctrlKey: keepOpen } = e ?? {}
    const { mode } = this.listboxEl

    if (mode === "help") {
      if (entry.text.startsWith(">")) {
        this.inputEl.value = ">"
        this.listboxEl.search = ">"
      } else if (entry.text.startsWith("…")) {
        this.inputEl.value = ""
        this.listboxEl.search = ""
      }
      return
    }

    this.listboxEl.pick(idx)

    if (mode === "apps") {
      appsManager.launch(entry.text, { stealFocus: !keepOpen })
    } else {
      appsManager.open(entry.text, { stealFocus: !keepOpen })
    }

    if (!keepOpen) this.close()
  }

  destroyed() {
    queueTask(() => {
      // @ts-ignore
      if (document.hasFocus()) this.opener?.focus()
    })
  }

  close() {
    this.destroy()
  }
}

export const commandPalette = Component.define(CommandPaletteComponent)
