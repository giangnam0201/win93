import {
  EditorState,
  Compartment,
} from "../../../../c/libs/codemirror/6.39/lib/state.js"
// import { openSearchPanel } from "../../../../c/libs/codemirror/6.39/lib/search.js"
import {
  EditorView,
  keymap,
} from "../../../../c/libs/codemirror/6.39/lib/view.js"
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "../../../../c/libs/codemirror/6.39/lib/language.js"

import { langs } from "./langs.js"
import { configure } from "../../../api/configure.js"
import { Emitter } from "../../../lib/class/Emitter.js"
import { merge } from "../../../lib/type/object/merge.js"
import { defer } from "../../../lib/type/promise/defer.js"

export { EditorView, EditorState, keymap }

let LanguageSupport
let StreamLanguage

const BASE = "../../../../c/libs/codemirror/6.39"

const MODULES = {
  highlightSpecialChars: "view",
  highlightWhitespace: "view",
  highlightTrailingWhitespace: "view",
  drawSelection: "view",
  dropCursor: "view",
  rectangularSelection: "view",
  lineNumbers: "view",
  highlightActiveLine: "view",
  highlightActiveLineGutter: "view",
  indentOnInput: "language",
  bracketMatching: "language",
  foldGutter: "language",
  autocompletion: "autocomplete",
  closeBrackets: "autocomplete",
  search: "search",
  highlightSelectionMatches: "search",
  history: "commands",
}

const DEFAULTS = {
  mode: "minimal",

  /** @type {string} */
  lang: undefined,

  /** @type {string} */
  theme: undefined,

  /** @type {string} */
  doc: undefined,

  tabSize: 2,
  readOnly: false,
  allowMultipleSelections: true,
  indentWithTab: true,
  textDragging: false,
  singleLine: false,

  // view
  highlightSpecialChars: undefined,
  highlightWhitespace: false,
  highlightTrailingWhitespace: false,
  drawSelection: true,
  dropCursor: false,
  rectangularSelection: false,
  lineNumbers: false,
  lineWrapping: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,

  // language
  indentOnInput: false,
  bracketMatching: false,
  foldGutter: false,

  // autocomplete
  autocompletion: false,
  closeBrackets: false,

  // search
  search: false,
  highlightSelectionMatches: false,

  // commands
  history: true,

  // extensions
  incDecNumber: true,
  minimap: false,

  keymaps: [
    "commands.default", //
    "commands.history",
  ],

  modes: {
    expression: {
      bracketMatching: true,
      closeBrackets: true,

      search: true,
      highlightSelectionMatches: false,

      keymaps: [
        "keymaps.sublime",
        "search",
        "commands.history",
        "autocomplete.completion",
      ],
    },
    basic: {
      dropCursor: true,
      rectangularSelection: true,
      lineNumbers: true,
      highlightActiveLine: true,
      highlightActiveLineGutter: true,
      // highlightWhitespace: true,
      // highlightTrailingWhitespace: true,

      indentOnInput: true,
      bracketMatching: true,
      foldGutter: true,

      autocompletion: true,
      closeBrackets: true,

      search: true,
      highlightSelectionMatches: true,

      keymaps: [
        "autocomplete.closeBrackets",
        // "commands.default",
        "keymaps.sublime",
        "keymaps.vscode",
        "search",
        "commands.history",
        "language.fold",
        "autocomplete.completion",
        "lint",
      ],
    },
    complete: {
      mode: "basic",
      minimap: true,
    },
  },
}

const SINGLE_LINE = {
  indentWithTab: false,
  lineNumbers: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  foldGutter: false,
  minimap: false,
}

const STATES = new Set(["allowMultipleSelections", "tabSize", "readOnly"])

const OTHERS = {
  singleLine: async (val, setups) => {
    if (val === false) return
    return import(`${BASE}/extensions/singleLine.js`).then((mod) => {
      setups.unshift(mod.singleLine())
    })
  },
  indentWithTab: async (val, _setups, keymaps) => {
    if (val === false) return
    return import(`${BASE}/lib/commands.js`).then((mod) => {
      keymaps.unshift(mod.indentWithTab)
    })
  },
  textDragging: async (val, setups) => {
    if (val === false) {
      setups.push(
        EditorView.domEventHandlers({
          dragstart: (event) => {
            event.preventDefault()
            return true // Return true to indicate the event was handled
          },
        }),
      )
    }
  },
  minimap: async () =>
    import(`${BASE}/extensions/minimap.js`) //
      .then(({ showMinimap }) => (val) => {
        if (val === false) return []
        if (val === true) val = {}
        return showMinimap.compute(["doc"], () => ({
          create: () => {
            const dom = document.createElement("div")
            return { dom }
          },
          ...val,
        }))
      }),
  incDecNumber: async (val, _setups, keymaps) => {
    if (val === false) return
    return import(`${BASE}/extensions/incDecNumber.js`).then((mod) => {
      keymaps.unshift(
        {
          key: "Ctrl-ArrowUp",
          mac: "Cmd-ArrowUp",
          run: mod.incrementNumber1,
        },
        {
          key: "Ctrl-ArrowDown",
          mac: "Cmd-ArrowDown",
          run: mod.decrementNumber1,
        },
        {
          key: "Alt-ArrowUp",
          mac: "Ctrl-Alt-ArrowUp",
          run: mod.incrementNumber01,
        },
        {
          key: "Alt-ArrowDown",
          mac: "Ctrl-Alt-ArrowDown",
          run: mod.decrementNumber01,
        },
        {
          key: "Ctrl-Alt-ArrowUp",
          mac: "Cmd-Alt-ArrowUp",
          run: mod.incrementNumber10,
        },
        {
          key: "Ctrl-Alt-ArrowDown",
          mac: "Cmd-Alt-ArrowDown",
          run: mod.decrementNumber10,
        },
      )
    })
  },
}

// MARK: lang
// ----------

const langEntries = Object.entries(langs)
const langAliases = new Map(
  langEntries.flatMap(([lang, config]) =>
    (config.alias ?? []).map((alias) => [alias.toLowerCase(), lang]),
  ),
)

// MARK: theme
// -----------

function defineTag(tagName, tags) {
  const args = tagName.split(".")
  if (args.length > 0) {
    let out
    for (let i = args.length - 1; i >= 0; i--) {
      const item = tags[args[i]]
      if (!item) {
        console.warn(`Tag "${args[i]}" is not a valid`)
        continue
      }
      if (typeof item === "function") {
        if (!out) {
          console.warn(
            `Tag "${tagName}" is not valid because "${args[i]}" is a function tag that requires an argument`,
          )
          return
        }
        out = item(out)
      } else {
        out = item
      }
    }
    return out
  }
}

let tags
let createThemes
async function loadTheme(str) {
  if (!tags || !createThemes) {
    const [modTags, modCreateThemes] = await Promise.all([
      import(`${BASE}/lib/lezer/highlight.js`),
      import(`${BASE}/lib/theme.js`),
    ])
    tags = modTags.tags
    createThemes = modCreateThemes.createTheme
  }

  const themeConfig =
    typeof str === "string"
      ? await import(`${BASE}/themes/${str}.js`) //
          .then((mod) => mod.default ?? mod[str])
      : str

  const styles =
    themeConfig.styles
      ?.map((style) => {
        const tag = Array.isArray(style.tag)
          ? style.tag.map((t) => defineTag(t, tags)).filter(Boolean)
          : defineTag(style.tag, tags)
        if (!tag) return
        return { ...style, tag }
      })
      .filter(Boolean) ?? []

  return createThemes({
    ...themeConfig,
    styles,
  })
}

// MARK: gui
// ---------

async function createSearchPanel() {
  const { CustomSearchPanel } = await import("./panels.js")
  return (view) => new CustomSearchPanel(view)
}

export class CodeEditor extends Emitter {
  ready = defer()

  dynamic = {
    lang: { compartment: new Compartment() },
    theme: { compartment: new Compartment() },
  }

  constructor(el, options) {
    super()
    this.el = el

    if (options.mode && options.mode !== "minimal") {
      let mode = DEFAULTS.modes[options.mode]
      if (mode.mode) {
        const subMode = DEFAULTS.modes[mode.mode]
        if (!subMode) console.warn(`Unknown mode: ${mode.mode}`)
        mode = configure(subMode, mode)
      }
      if (!mode) console.warn(`Unknown mode: ${options.mode}`)
      this.config = configure(
        DEFAULTS,
        merge({}, mode, ({ val, key }) => {
          if (val === undefined) {
            console.log(key)
            return true
          }
        }),
        options,
      )
    } else {
      this.config = configure(DEFAULTS, options)
    }
  }

  async init() {
    if (this.config.theme) {
      await this.loadTheme(this.config.theme)
    }

    this.view = new EditorView({
      doc: this.config.doc,
      parent: this.el,
      extensions: await this.getExtensions(),
    })

    if (this.config.lang) {
      await this.loadLang(this.config.lang)
    }

    this.ready.resolve()

    // openSearchPanel(this.view)
  }

  setDoc(val = "") {
    const currentDoc = this.view.state.doc.toString()
    this.view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: val },
      // scrollIntoView: true,
      // selection: { anchor: 0 },
    })
  }

  set(key, val) {
    if (key in this.dynamic) {
      const d = this.dynamic[key]
      this.view.dispatch({
        effects: d.compartment.reconfigure(d.exe?.(val) ?? val),
      })
    } else {
      console.warn(`Unknown config key: ${key}`)
    }
  }

  // MARK: lang
  // ----------

  langDescription
  async loadLang(lang) {
    if (!lang) return void this.#unloadLang()

    let langKey = lang.toLowerCase()
    langKey = langAliases.get(langKey) ?? langKey
    const langData = langs[langKey]

    if (!langData) {
      console.warn(`Unknown language: ${lang}`)
      return void this.#unloadLang()
    }

    this.langDescription = langData
    this.emit("lang-change", this.langDescription)

    const moduleName = langData.module ?? langKey
    const exportName = langData.export ?? moduleName

    try {
      const module = await import(`${BASE}/langs/${moduleName}.js`)
      const language = module[exportName]

      this.#setLang(
        langData.parser === true
          ? await this.#loadStreamParser(language)
          : language(langData.options),
      )
    } catch (err) {
      console.warn(`Unknown language: ${lang}.\n`, err)
    }
  }

  async #loadStreamParser(streamParser) {
    if (!LanguageSupport) {
      const mod = await import(`${BASE}/lib/language.js`)
      LanguageSupport = mod.LanguageSupport
      StreamLanguage = mod.StreamLanguage
    }
    return new LanguageSupport(StreamLanguage.define(streamParser))
  }

  #unloadLang() {
    this.#setLang([])
    this.langDescription = undefined
  }

  #setLang(lang) {
    this.view.dispatch({
      effects: this.dynamic.lang.compartment.reconfigure(lang),
    })
  }

  detectLangFromFilename(path) {
    const fileName = path.split("/").pop() ?? path
    const lowerPath = path.toLowerCase()

    for (const [lang, config] of langEntries) {
      if (config.filename?.test(fileName)) {
        return { lang, module: config.module ?? lang }
      }

      if (
        config.extensions?.some((extension) =>
          lowerPath.endsWith(extension.toLowerCase()),
        )
      ) {
        return { lang, module: config.module ?? lang }
      }
    }
  }

  // MARK: theme
  // -----------

  #theme
  async loadTheme(theme) {
    this.#theme = await loadTheme(theme)
    this.#setTheme(this.#theme)
  }

  #setTheme(theme) {
    if (!this.view) return
    this.view.dispatch({
      effects: this.dynamic.theme.compartment.reconfigure(theme ?? []),
    })
  }

  // MARK: extensions
  // ----------------

  async getExtensions() {
    const others = []
    const setups = []
    const keymaps = []

    const config = this.config.singleLine
      ? merge(this.config, SINGLE_LINE, ({ val }) => {
          if (val === undefined) return true
        })
      : this.config

    for (let [key, val] of Object.entries(config)) {
      if (key in MODULES) {
        if (val === false) continue
        setups.push(
          import(`${BASE}/lib/${MODULES[key]}.js`).then(async (mod) => {
            const fn = mod[key]
            if (key === "search" && val === true) {
              val = {
                // top: true,
                createPanel: await createSearchPanel(),
              }
            }
            if (typeof fn === "function") {
              const exe = (val) =>
                val === true ? fn() : val === false ? [] : fn(val)
              this.dynamic[key] ??= { exe, compartment: new Compartment() }
              return this.dynamic[key].compartment.of(exe(val))
            }

            console.warn(`Extension ${key} not found in ${MODULES[key]}`)
          }),
        )
      } else if (key === "keymaps") {
        for (const keymapName of val) {
          let [modKey, subKey] = keymapName.split(".")
          subKey ??= modKey

          const libPath =
            modKey === "keymaps"
              ? `${BASE}/keymaps/${subKey}.js`
              : `${BASE}/lib/${modKey}.js`

          keymaps.push(
            import(libPath).then((mod) => {
              const km = mod[subKey + "Keymap"] ?? mod[subKey]
              if (km) return km
              console.warn(`Keymap ${keymapName} not found in ${modKey}`)
            }),
          )
        }
      } else if (key === "lineWrapping") {
        const exe = (val) => (val ? EditorView.lineWrapping : [])
        this.dynamic[key] ??= { exe, compartment: new Compartment() }
        setups.push(this.dynamic[key].compartment.of(exe(val)))
      } else if (STATES.has(key)) {
        this.dynamic[key] ??= { compartment: new Compartment() }
        setups.push(this.dynamic[key].compartment.of(EditorState[key].of(val)))
      } else if (OTHERS[key]) {
        others.push(
          OTHERS[key](val, setups, keymaps).then((exe) => {
            if (exe) {
              this.dynamic[key] ??= { exe, compartment: new Compartment() }
              setups.push(this.dynamic[key].compartment.of(exe(val)))
            }
          }),
        )
      } else if (key in DEFAULTS === false) {
        console.warn(`Unknown config key: ${key}`)
      }
    }

    await Promise.all(others)
    const extensions = await Promise.all(setups)

    extensions.push(
      EditorView.baseTheme({
        "&": {
          contain: "content",
        },
        ".cm-scroller": {
          fontFamily: "var(--font-mono-ff)",
          lineHeight: "var(--font-mono-lh)",
          fontSize: "var(--font-mono-fs)",
          padding: "0",
        },
        ".cm-content": {
          padding: "0.08333333333333333em 0",
        },
        ".cm-panels": {
          color: "var(--panel-fg)",
          background: "var(--panel-bg)",
        },
        ".cm-layer": {
          top: "calc(-1 * var(--bdw))",
          left: "calc(-1 * var(--bdw))",
        },
        "&.cm-editor.has-selection .cm-activeLine": {
          backgroundColor: "transparent !important",
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) this.emit("change")
        if (update.selectionSet) {
          const hasSelection = update.state.selection.ranges.some(
            (r) => !r.empty,
          )
          update.view.dom.classList.toggle("has-selection", hasSelection)
        }
      }),
      // EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      this.dynamic.theme.compartment.of(this.#theme ?? []),
      this.dynamic.lang.compartment.of([]),
      keymap.of((await Promise.all(keymaps)).flat()),
    )

    return extensions
  }
}
