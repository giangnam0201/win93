import "../layout/listbox.js"
import { Control } from "../../api/gui/Control.js"
import { on } from "../../lib/event/on.js"
import { positionable } from "../../api/gui/trait/positionable.js"

/** @import { ListboxComponent } from "../layout/listbox.js" */

/**
 * @param {any} detail
 * @returns {string}
 */
function getItemValue(detail) {
  if (typeof detail === "string") return detail
  return detail?.value ?? detail?.text ?? detail?.label ?? ""
}

/**
 * @param {any} detail
 * @returns {string}
 */
function getItemText(detail) {
  if (typeof detail === "string") return detail
  return detail?.label ?? detail?.text ?? detail?.value ?? ""
}

export class ComboboxControl extends Control {
  static plan = {
    tag: "ui-combobox",
    role: "combobox",
    tabIndex: -1,
    props: {
      strict: true,
      freetext: true,
      size: true,
      rows: true,
      multiple: true,
      mode: true,
      modes: true,
    },
    on: {
      focus: (e, target) => {
        if (target === document.activeElement) {
          if (target.#isSelectLike()) {
            target.listboxEl?.focus()
          } else {
            target.inputEl?.focus()
          }
        }
      },
    },
  }

  /** @type {HTMLInputElement} */
  inputEl

  /** @type {ListboxComponent} */
  listboxEl

  #positionable
  #items = []
  #isOpen = false
  #mode
  #modes = {}
  #size = 1
  #rows = 4
  #selectedValues = []
  #committedValues = []
  #suppressHighlightInput = false
  #draftInputValue = ""
  #preserveDraftInput = false
  #pendingFilterPreview = false

  strict = false

  // MARK: freetext
  get freetext() {
    return this.hasAttribute("freetext")
  }
  set freetext(value) {
    this.toggleAttribute("freetext", Boolean(value))
  }

  // MARK: content
  get content() {
    return this.#items
  }
  set content(value) {
    this.items = value ?? []
  }

  // MARK: mode
  get mode() {
    return this.#mode
  }
  set mode(value) {
    this.#mode = value
    if (this.listboxEl) this.listboxEl.mode = value
  }

  // MARK: modes
  get modes() {
    return this.#modes
  }
  set modes(value) {
    this.#modes = value ?? {}
    if (this.listboxEl) this.listboxEl.modes = this.#modes
  }

  // MARK: size
  get size() {
    return this.#size
  }
  set size(value) {
    const next = Math.max(1, Number(value) || 1)
    if (next === this.#size) return
    this.#size = next
    if (this.isRendered) this.rerender()
  }

  // MARK: rows
  get rows() {
    return this.#rows
  }
  set rows(value) {
    const next = Math.max(0, Number(value) || 0)
    if (next === this.#rows) return
    this.#rows = next
    this.#syncListboxLayout()
  }

  // MARK: multiple
  get multiple() {
    return this.hasAttribute("multiple")
  }
  set multiple(value) {
    const next = Boolean(value)
    if (next === this.multiple) return
    this.toggleAttribute("multiple", next)
    if (!next && this.#selectedValues.length > 1) {
      this.#commitSelection(this.#selectedValues.slice(0, 1))
    }
    if (this.listboxEl) this.listboxEl.multiselectable = next
    if (this.isRendered) this.rerender()
  }

  // MARK: values
  get values() {
    return [...this.#selectedValues]
  }
  set values(value) {
    const values = Array.isArray(value) ? value : value == null ? [] : [value]
    this.#commitSelection(values)
  }

  // MARK: #isSelectLike
  #isSelectLike() {
    return this.multiple || this.size > 1
  }

  // MARK: #normalizeValues
  #normalizeValues(values) {
    const out = []
    const seen = new Set()

    for (const value of values ?? []) {
      if (value == null) continue
      const normalized = String(value)
      if (seen.has(normalized)) continue
      seen.add(normalized)
      out.push(normalized)
    }

    return this.multiple ? out : out.slice(0, 1)
  }

  // MARK: #findItemByValue
  #findItemByValue(value) {
    return this.#items.find((item) => getItemValue(item) === value)
  }

  // MARK: #getEntrySourceItem
  #getEntrySourceItem(entry) {
    if (!entry) return entry
    if (typeof entry.index === "number") {
      return this.#items[entry.index] ?? entry.item ?? entry
    }
    return entry.item ?? entry
  }

  // MARK: #selectedLabels
  #selectedLabels() {
    return this.#selectedValues.map((value) => {
      const item = this.#findItemByValue(value)
      return item ? getItemText(item) : value
    })
  }

  // MARK: #sameValues
  #sameValues(values) {
    if (values.length !== this.#selectedValues.length) return false

    for (let i = 0; i < values.length; i++) {
      if (values[i] !== this.#selectedValues[i]) return false
    }

    return true
  }

  // MARK: #sameCommittedValues
  #sameCommittedValues(values) {
    if (values.length !== this.#committedValues.length) return false

    for (let i = 0; i < values.length; i++) {
      if (values[i] !== this.#committedValues[i]) return false
    }

    return true
  }

  // MARK: #setControlValue
  #setControlValue(value, options) {
    const prevDispatchChange = this.config.dispatchChange

    if (options?.dispatchChange === false) {
      this.config.dispatchChange = false
    }

    super.setValue(value, { fromInput: true })

    this.config.dispatchChange = prevDispatchChange
  }

  // MARK: #updateSelectionState
  #updateSelectionState(values, options) {
    const nextValues = this.#normalizeValues(values)
    const selectedChanged = !this.#sameValues(nextValues)
    const committedChanged = !this.#sameCommittedValues(nextValues)
    const nextValue = nextValues[0] ?? ""
    const shouldDispatchChange = options?.dispatchChange !== false

    this.#selectedValues = nextValues

    if (
      selectedChanged ||
      this.value !== nextValue ||
      (options?.commit !== false && shouldDispatchChange && committedChanged)
    ) {
      this.#setControlValue(nextValue, { dispatchChange: shouldDispatchChange })
    }

    if (options?.commit !== false) {
      this.#committedValues = [...nextValues]
    }

    if (options?.syncInput !== false) {
      this.#syncInputValue()
    }

    this.#syncListboxSelection()
    this.#syncListboxLayout()

    return options?.commit === false ? selectedChanged : committedChanged
  }

  // MARK: #previewSelection
  #previewSelection(values, options) {
    return this.#updateSelectionState(values, {
      ...options,
      commit: false,
      dispatchChange: false,
    })
  }

  // MARK: #commitSelection
  #commitSelection(values, options) {
    return this.#updateSelectionState(values, options)
  }

  // MARK: items
  get items() {
    return this.#items
  }
  set items(value) {
    this.#items = value ?? []
    if (this.listboxEl) {
      this.listboxEl.content = this.#items
    }
    this.#syncInputValue()
    this.#syncListboxSelection()
    this.#syncListboxLayout()
  }

  // MARK: valueChanged
  valueChanged() {
    this.#committedValues = [...this.#selectedValues]
    this.#syncInputValue()
    this.#syncListboxSelection()
  }

  // MARK: setValue
  setValue(value, options) {
    const values = value == null || value === "" ? [] : [String(value)]
    this.#commitSelection(values, options)
  }

  // MARK: #syncInputValue
  #syncInputValue() {
    if (!this.inputEl) return

    if (this.multiple) {
      this.inputEl.value = this.#selectedLabels().join(", ")
      return
    }

    const selected = this.#selectedValues[0]
    if (selected == null) {
      this.inputEl.value = ""
      return
    }

    const item = this.#findItemByValue(selected)
    this.inputEl.value = item ? getItemText(item) : selected
  }

  // MARK: #setDraftInputValue
  #setDraftInputValue(value) {
    this.#draftInputValue = value
    this.#preserveDraftInput = true
  }

  // MARK: #restoreDraftInputValue
  #restoreDraftInputValue() {
    if (!this.#preserveDraftInput || !this.inputEl) return
    this.inputEl.value = this.#draftInputValue
  }

  // MARK: #clearDraftInputValue
  #clearDraftInputValue() {
    this.#draftInputValue = ""
    this.#preserveDraftInput = false
    this.#pendingFilterPreview = false
  }

  // MARK: #previewHighlightedSelection
  #previewHighlightedSelection(options) {
    if (this.multiple) return
    if (!this.#isSelectLike() && !this.#isOpen) return false

    const entry = this.listboxEl.items[this.listboxEl.current]
    if (!entry) return false

    const value = getItemValue(this.#getEntrySourceItem(entry))
    const changed = this.#previewSelection([value], {
      fromInput: true,
      syncInput: options?.syncInput,
    })

    if (options?.preserveInput) {
      this.#restoreDraftInputValue()
    }

    if (changed || options?.forceInput === true) {
      this.dispatchEvent(new Event("input", { bubbles: true }))
    }

    return changed
  }

  // MARK: #finalizeInputValue
  #finalizeInputValue() {
    if (!this.#preserveDraftInput) return

    if (this.freetext) {
      this.#commitSelection(
        this.#draftInputValue ? [this.#draftInputValue] : [],
        {
          fromInput: true,
          syncInput: false,
        },
      )
      this.#restoreDraftInputValue()
    } else if (this.listboxEl.current >= 0) {
      const entry = this.listboxEl.items[this.listboxEl.current]
      if (entry) {
        this.#commitSelection([getItemValue(this.#getEntrySourceItem(entry))], {
          fromInput: true,
        })
      } else {
        this.#syncInputValue()
      }
    } else {
      this.#syncInputValue()
    }

    this.#clearDraftInputValue()
  }

  // MARK: #highlightSelectionSilently
  #highlightSelectionSilently() {
    this.#suppressHighlightInput = true
    this.#highlightSelection()
    this.#suppressHighlightInput = false
  }

  // MARK: #syncListboxSelection
  #syncListboxSelection() {
    if (!this.listboxEl) return

    this.listboxEl.multiselectable = this.multiple

    const selected = new Set(this.#selectedValues)
    for (const itemEl of this.listboxEl.querySelectorAll(
      `.${this.listboxEl.itemClass}`,
    )) {
      const idx = Number(/** @type {HTMLElement} */ (itemEl).dataset.index)
      const entry = this.listboxEl.items[idx]
      if (!entry) continue

      const value = getItemValue(this.#getEntrySourceItem(entry))
      if (selected.has(value)) {
        itemEl.setAttribute("aria-selected", "true")
      } else {
        itemEl.removeAttribute("aria-selected")
      }
    }
  }

  // MARK: #highlightSelection
  #highlightSelection() {
    if (!this.listboxEl?.items.length) return

    const selected = this.#selectedValues[0]
    const index =
      selected == null
        ? -1
        : this.listboxEl.items.findIndex(
            (entry) =>
              getItemValue(this.#getEntrySourceItem(entry)) === selected,
          )

    if (index === -1) {
      this.listboxEl.highlightFirst()
    } else {
      this.listboxEl.highlight(index)
    }
  }

  // MARK: #measureListboxBlockSize
  #measureListboxBlockSize(rowCount) {
    const itemEl = this.listboxEl.querySelector("li")
    const itemHeight = itemEl?.offsetHeight || itemEl?.clientHeight || 28
    const borderSize = this.listboxEl.offsetHeight - this.listboxEl.clientHeight

    return Math.max(1, rowCount) * itemHeight + borderSize
  }

  // MARK: #syncListboxLayout
  #syncListboxLayout() {
    if (!this.listboxEl) return

    if (!this.#isSelectLike()) {
      const inputWidth =
        this.inputEl?.getBoundingClientRect().width ||
        this.getBoundingClientRect().width ||
        this.offsetWidth

      this.listboxEl.style.position = "fixed"
      if (!this.#positionable) {
        this.listboxEl.style.top = "0px"
        this.listboxEl.style.left = "0px"
      }
      this.listboxEl.style.minInlineSize = `${Math.ceil(inputWidth)}px`
      this.listboxEl.style.blockSize = ""

      this.listboxEl.style.maxBlockSize = `${this.#measureListboxBlockSize(this.rows)}px`
      this.listboxEl.style.overflowY = "auto"

      if (this.#isOpen) {
        this.#positionable?.refresh(this)
      }

      return
    }

    this.#positionable?.destroy()
    this.#positionable = undefined

    this.listboxEl.style.position = ""
    this.listboxEl.style.top = ""
    this.listboxEl.style.left = ""
    this.listboxEl.style.translate = ""
    this.listboxEl.style.minInlineSize = ""

    const nextSize = this.#measureListboxBlockSize(this.size)

    this.listboxEl.style.blockSize = `${nextSize}px`
    this.listboxEl.style.maxBlockSize = `${nextSize}px`
    this.listboxEl.style.overflowY = "auto"
  }

  // MARK: #show
  #show() {
    if (this.#isSelectLike()) {
      this.listboxEl.hidden = false
      this.inputEl?.setAttribute("aria-expanded", "false")
      return
    }

    if (this.#isOpen) return
    this.#isOpen = true

    this.listboxEl.hidden = false
    this.inputEl.setAttribute("aria-expanded", "true")

    this.#positionable?.destroy()
    this.#positionable = positionable(this.listboxEl, {
      signal: this.signal,
      preset: "popup",
      // position: "absolute",
      of: this,
    })
  }

  // MARK: showPicker
  showPicker() {
    this.#show()
    this.#syncListboxLayout()
    this.#highlightSelectionSilently()
    this.#syncActiveDescendant()
  }

  // MARK: closePicker
  closePicker() {
    if (this.#isSelectLike()) {
      this.listboxEl.hidden = false
      this.inputEl?.setAttribute("aria-expanded", "false")
      return
    }

    if (!this.#isOpen) return
    this.#isOpen = false

    this.listboxEl.hidden = true
    this.inputEl.setAttribute("aria-expanded", "false")
    this.inputEl.removeAttribute("aria-activedescendant")

    this.#positionable?.destroy()
    this.#positionable = undefined
  }

  // MARK: #syncActiveDescendant
  #syncActiveDescendant() {
    const item = this.listboxEl.currentItem
    if (item) {
      if (!item.id) {
        item.id = `${this.listboxEl.id}-opt-${this.listboxEl.current}`
      }
      this.inputEl.setAttribute("aria-activedescendant", item.id)
    } else {
      this.inputEl.removeAttribute("aria-activedescendant")
    }
  }

  // MARK: #pick
  #pick(idx = this.listboxEl.current) {
    const entry = this.listboxEl.items[idx]
    if (!entry) return

    const value = getItemValue(this.#getEntrySourceItem(entry))
    if (this.multiple) {
      const next = new Set(this.#selectedValues)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }

      this.#commitSelection([...next], { fromInput: true })
      this.listboxEl.highlight(idx)
    } else {
      this.#commitSelection([value], {
        fromInput: true,
        syncInput: !this.freetext,
      })
      if (this.freetext) {
        this.#restoreDraftInputValue()
      } else {
        this.#clearDraftInputValue()
      }
      this.closePicker()
    }

    if (this.freetext) {
      this.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }

  // MARK: render
  render({ content, mode, modes }) {
    if (content) this.items = content
    if (mode !== undefined) this.mode = mode
    if (modes !== undefined) this.modes = modes

    const selectLike = this.#isSelectLike()

    return [
      {
        tag: "input.clear",
        role: "none",
        autocomplete: "off",
        hidden: selectLike,
        readOnly: selectLike,
        value: this.value,
        created: (el) => {
          this.inputEl = el
        },
      },
      {
        tag: "button.addon",
        hidden: selectLike,
        picto: "caret-down",
        tabIndex: -1,
        on: {
          "disrupt": true,
          "pointerdown || Enter || Space": () => {
            this.inputEl?.focus()
            this.showPicker()
          },
        },
      },
      {
        tag: "ui-listbox",
        captureKeydown: selectLike,
        fuzzy: !selectLike,
        content: this.#items,
        mode: this.#mode,
        modes: this.#modes,
        multiselectable: this.multiple,
        created: (el) => {
          this.listboxEl = /** @type {ListboxComponent} */ (el)
        },
      },
    ]
  }

  // MARK: created
  created() {
    const { signal } = this

    if (this.inputEl) {
      this.inputEl.setAttribute("aria-expanded", "false")
    }

    this.listboxEl.ready.then(() => {
      this.inputEl?.setAttribute("aria-controls", this.listboxEl.id)
      this.listboxEl.hidden = !this.#isSelectLike() && !this.#isOpen
      this.#syncInputValue()
      this.#syncListboxSelection()
      this.#syncListboxLayout()
      this.#highlightSelectionSilently()
      this.#syncActiveDescendant()
    })

    if (this.inputEl) {
      on(
        this.inputEl,
        { signal },
        {
          focus: () => {
            if (this.#isSelectLike()) return
            this.showPicker()
          },
          input: (e) => {
            e.stopPropagation()
            this.#show()
            this.#setDraftInputValue(this.inputEl.value)
            this.#pendingFilterPreview = true
            this.#suppressHighlightInput = true
            this.listboxEl.search = this.inputEl.value
          },
          focusout: () => {
            if (!this.strict || this.#isSelectLike()) return
            const inputVal = this.inputEl.value
            const match = this.#items.some(
              (item) => getItemValue(item) === inputVal,
            )
            if (!match) {
              this.#syncInputValue()
            }
          },
        },
        {
          prevent: true,
          ArrowDown: () => {
            if (this.#isOpen) {
              this.listboxEl.highlightNext()
              this.#syncActiveDescendant()
            } else {
              this.showPicker()
              this.#previewHighlightedSelection({
                syncInput: !this.#preserveDraftInput,
                preserveInput: this.#preserveDraftInput,
              })
            }
          },
          ArrowUp: () => {
            if (this.#isOpen) {
              this.listboxEl.highlightPrev()
              this.#syncActiveDescendant()
            }
          },
          Enter: () => {
            if (this.#isOpen) this.#pick()
          },
          Escape: () => {
            if (this.#isOpen) {
              this.#finalizeInputValue()
              this.closePicker()
            }
          },
        },
      )
    }

    on(
      this,
      { signal },
      {
        focusout: () => {
          if (this.#isSelectLike()) return
          queueMicrotask(() => {
            if (!this.contains(document.activeElement)) {
              this.#finalizeInputValue()
              this.closePicker()
            }
          })
        },
      },
    )

    on(
      this.listboxEl,
      { signal },
      {
        "ui:listbox.pick": () => {
          this.#pick()
        },
        "ui:menu.highlight": () => {
          this.#syncActiveDescendant()
          if (!this.#suppressHighlightInput && !this.#pendingFilterPreview) {
            this.#previewHighlightedSelection({
              syncInput: !this.#preserveDraftInput,
              preserveInput: this.#preserveDraftInput,
            })
          }
        },
        "ui.render": () => {
          this.#syncListboxSelection()
          this.#syncListboxLayout()
          if (this.#isSelectLike()) this.#highlightSelectionSilently()
          if (this.#pendingFilterPreview) {
            this.#pendingFilterPreview = false
            if (this.listboxEl.items.length > 0) {
              this.listboxEl.highlightFirst()
            } else {
              this.listboxEl.highlight(-1)
            }
            this.#previewHighlightedSelection({
              syncInput: false,
              preserveInput: true,
              forceInput: this.listboxEl.current >= 0,
            })
          }
          this.#suppressHighlightInput = false
          this.#syncActiveDescendant()
        },
      },
    )
  }
}

export const combobox = Control.define(ComboboxControl)
