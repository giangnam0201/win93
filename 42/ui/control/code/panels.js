import "../../media/picto.js"
import { render } from "../../../api/gui/render.js"
import { runScopeHandlers } from "../../../../c/libs/codemirror/6.39/lib/view.js"
import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  searchState,
  setSearchQuery,
  closeSearchPanel,
  searchConfigFacet,
} from "../../../../c/libs/codemirror/6.39/lib/search.js"

/** @typedef {import("../../../../c/libs/codemirror/6.39/lib/view.js").ViewUpdate} ViewUpdate */

export class CustomSearchPanel {
  constructor(view) {
    this.view = view
    const query = view.state.field(searchState).query.spec
    this.query = query
    this.commit = this.commit.bind(this)

    const toggler = (e, target) => {
      target.ariaPressed = target.ariaPressed === "true" ? "false" : "true"
      this.commit()
    }

    this.dom = render({
      tag: ".cols.pa-y-xs.gap-xs",
      on: { keydown: this.keydown.bind(this) },
      content: [
        {
          if: !view.state.readOnly,
          tag: "button._clear",
          picto: "caret-right",
          // picto: "caret-down",
        },
        {
          tag: ".rows.gap-xs",
          content: [
            {
              tag: ".cols",
              content: [
                {
                  tag: ".field.items-center.cols",
                  content: [
                    {
                      tag: "input.grow.font-mono",
                      value: query.search,
                      placeholder: "Find",
                      aria: { label: "Find" },
                      name: "search",
                      oninput: this.commit,
                      created: (el) => {
                        this.searchField = /** @type {HTMLInputElement} */ (el)
                        this.searchField.toggleAttribute("main-field", true)
                      },
                    },
                    {
                      tag: ".font-mono.txt-dim",
                      created: (el) =>
                        (this.resultField = /** @type {HTMLElement} */ (el)),
                      content: "-/-",
                    },
                  ],
                },

                {
                  tag: "button._clear.ma-l-xs",
                  picto: "font",
                  title: "Match Case",
                  aria: { pressed: query.caseSensitive },
                  on: { click: toggler },
                  created: (el) =>
                    (this.caseField = /** @type {HTMLInputElement} */ (el)),
                },
                {
                  tag: "button._clear",
                  picto: "quote",
                  // picto: "match-word",
                  title: "Match Whole Word",
                  aria: { pressed: query.wholeWord },
                  on: { click: toggler },
                  created: (el) =>
                    (this.wordField = /** @type {HTMLInputElement} */ (el)),
                },
                {
                  tag: "button._clear",
                  picto: "regex",
                  title: "Use Regular Expression",
                  aria: { pressed: query.regexp },
                  on: { click: toggler },
                  created: (el) =>
                    (this.reField = /** @type {HTMLInputElement} */ (el)),
                },

                {
                  tag: "button._clear.ma-l-xs",
                  picto: "arrow-thin-up",
                  title: "Previous Match",
                  on: { click: () => findPrevious(this.view) },
                },
                {
                  tag: "button._clear",
                  picto: "arrow-thin-down",
                  title: "Next Match",
                  on: { click: () => findNext(this.view) },
                },
                {
                  tag: "button.clear.pointer-instant.ma-l-xs",
                  picto: "cross-thin", // "close"
                  title: "Close",
                  on: { click: () => closeSearchPanel(this.view) },
                },
              ],
            },
            {
              tag: ".cols",
              class: {
                hide: view.state.readOnly,
              },
              content: [
                {
                  tag: "input.font-mono",
                  value: query.replace,
                  placeholder: "Replace",
                  aria: { label: "Replace" },
                  name: "replace",
                  oninput: this.commit,
                  created: (el) =>
                    (this.replaceField = /** @type {HTMLInputElement} */ (el)),
                },
                {
                  tag: "button._clear.ma-l-xs",
                  picto: "play-one",
                  // picto: "replace",
                  title: "Replace",
                  on: { click: () => replaceNext(this.view) },
                },
                {
                  tag: "button._clear",
                  picto: "play-all-alt",
                  // picto: "replace-all",
                  title: "Replace All",
                  on: { click: () => replaceAll(this.view) },
                },
              ],
            },
          ],
        },
      ],
    })

    this.updateMatchCount()
  }

  commit() {
    const query = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.caseField.ariaPressed === "true",
      regexp: this.reField.ariaPressed === "true",
      wholeWord: this.wordField.ariaPressed === "true",
      replace: this.replaceField.value,
    })
    if (!query.eq(this.query)) {
      this.query = query
      this.view.dispatch({ effects: setSearchQuery.of(query) })
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  keydown(e) {
    if (runScopeHandlers(this.view, e, "search-panel")) {
      e.preventDefault()
    } else if (e.key === "Enter" && e.target === this.searchField) {
      e.preventDefault()
      ;(e.shiftKey ? findPrevious : findNext)(this.view)
    } else if (e.key === "Enter" && e.target === this.replaceField) {
      e.preventDefault()
      replaceNext(this.view)
    }
  }

  /**
   * @param {ViewUpdate} update
   */
  update(update) {
    let shouldRefreshCount = update.docChanged || update.selectionSet

    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value)
        }
        if (effect.is(setSearchQuery)) shouldRefreshCount = true
      }
    }

    if (shouldRefreshCount) this.updateMatchCount()
  }

  /**
   * @param {SearchQuery} query
   */
  setQuery(query) {
    this.query = query
    this.searchField.value = query.search
    this.replaceField.value = query.replace
    this.caseField.ariaPressed = String(query.caseSensitive)
    this.reField.ariaPressed = String(query.regexp)
    this.wordField.ariaPressed = String(query.wholeWord)
    this.updateMatchCount()
  }

  updateMatchCount() {
    if (!this.resultField) return

    const search = this.view.state.field(searchState).query
    if (!search.spec.valid) {
      this.resultField.textContent = "-/-"
      return
    }

    const selection = this.view.state.selection.main
    const cursor = search.spec.getCursor(this.view.state)
    let total = 0
    let current = 0

    while (!cursor.next().done) {
      total++

      const { from, to } = cursor.value
      if (from === selection.from && to === selection.to) {
        current = total
      }
    }

    this.resultField.textContent = `${current}/${total}`
  }

  mount() {
    this.searchField.select()
  }

  get pos() {
    return 80
  }

  get top() {
    return this.view.state.facet(searchConfigFacet).top
  }
}
