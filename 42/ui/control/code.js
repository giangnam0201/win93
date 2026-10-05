import { Control } from "../../api/gui/Control.js"
import { CodeEditor } from "./code/CodeEditor.js"
import { loadText } from "../../api/load/loadText.js"
import { dispatch } from "../../lib/event/dispatch.js"

export class CodeControl extends Control {
  static plan = {
    tag: "ui-code",

    props: {
      mode: true,
      lang: true,
      theme: true,
      singleLine: true,
      src: true,
      srcdoc: true,
    },

    tabIndex: -1,
    dataset: { focusable: true },
    on: {
      focus: async (e, target) => {
        await Promise.all([target.ready, target.editor.ready])
        if (target === document.activeElement) {
          target.editor.view.focus()
        }
      },
    },
  }

  options = {}

  /** @type {CodeEditor} */
  editor

  get mode() {
    return this.getAttribute("mode")
  }
  set mode(value) {
    this.setAttribute("mode", value)
  }

  get lang() {
    return this.getAttribute("lang")
  }
  set lang(value) {
    this.setAttribute("lang", value)
  }

  #theme
  get theme() {
    return this.#theme
  }
  set theme(value) {
    this.#theme = value
  }

  get singleLine() {
    return this.hasAttribute("singleline")
  }
  set singleLine(value) {
    this.toggleAttribute("singleline", Boolean(value))
  }

  get src() {
    return this.getAttribute("src")
  }
  set src(value) {
    this.setAttribute("src", value)
  }

  get srcdoc() {
    return this.getAttribute("srcdoc")
  }
  set srcdoc(value) {
    this.setAttribute("srcdoc", value)
  }

  get value() {
    if (this.editor?.view) return this.editor.view.state.doc.toString()
    return super.value
  }
  set value(val) {
    super.value = val
  }

  valueChanged(val) {
    if (!this.editor?.view) return
    this.editor.setDoc(val)
  }

  async updated(key, val) {
    // await this.ready
    switch (key) {
      case "src": {
        if (!val) {
          this.value = ""
          return
        }
        // @ts-ignore
        const { sys42 } = window
        const indexOfQuery = val.lastIndexOf("?")
        if (indexOfQuery !== -1) val = val.slice(0, indexOfQuery)

        try {
          this.value = await (sys42?.load
            ? sys42.load.text(val)
            : loadText(val))
          await this.editor.ready
          this.editor.set("history", false)
          this.editor.set("history", true)
          // Auto-detect lang from filename if lang attribute is not set
          if (!this.lang && this.editor) {
            const detected = await this.editor.detectLangFromFilename(val)
            this.editor.loadLang(detected?.lang)
          }
          dispatch(this, "load", { detail: { src: val } })
        } catch (error) {
          dispatch(this, "error", { detail: error })
        }

        break
      }
      case "srcdoc": {
        this.value = val
        break
      }
      case "lang": {
        if (this.editor && val) this.editor.loadLang(val)
        break
      }
      case "theme": {
        if (this.editor && val) this.editor.loadTheme(val)
        break
      }
    }
  }

  async created() {
    this.editor = new CodeEditor(this, {
      doc: super.value,
      mode: this.mode,
      lang: this.lang,
      theme: this.theme,
      singleLine: this.singleLine,
      ...this.options,
    })

    await this.editor.init()

    this.editor.on("change", () => {
      // TODO: test how to set value only when a form needs it
      // this.setValue(this.editor.view.state.doc.toString(), { fromInput: true })
      this.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }
}

export const code = Control.define(CodeControl)
