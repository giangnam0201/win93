import "../../../../42/ui/control/code.js"
import "../../../../42/ui/control/combobox.js"
import { fileIndex } from "../../../../42/api/fileIndex.js"
import { until } from "../../../../42/lib/event/on.js"
import { form } from "../../../../42/ui/layout/dialog.js"
import { langs } from "../../../../42/ui/control/code/langs.js"
import { getBasename } from "../../../../42/lib/syntax/path/getBasename.js"

const AUTO_DETECT_VALUE = "__auto_detect__"

const THEMES = [
  ...new Set(
    fileIndex
      .glob("/c/libs/codemirror/*/themes/*.js")
      .map((path) => getBasename(path, ".js")),
  ),
].sort((left, right) => left.localeCompare(right))

const LANGUAGE_OPTIONS = [
  {
    label: "Auto Detect",
    value: AUTO_DETECT_VALUE,
  },
  ...Object.entries(langs)
    .map(([value, config]) => ({
      label: config.name,
      value,
    }))
    .sort((left, right) => left.label.localeCompare(right.label)),
]

function queueTask(task, callback) {
  return task.catch(() => {}).then(callback)
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  let codeEl
  let currentFilePath
  let manualLang
  let langTask = Promise.resolve()
  let themeTask = Promise.resolve()

  const statusBar = {}

  const state = await app.initState({
    theme: "dracula",
    lineWrapping: true,
    minimap: false,
  })

  const updateStatus = () => {
    const lang = codeEl?.editor?.langDescription?.name ?? "Plain Text"
    if (statusBar.langMode) statusBar.langMode.textContent = lang
  }

  const detectCurrentLang = async () => {
    if (!codeEl?.editor || !currentFilePath) return
    const detected = await codeEl.editor.detectLangFromFilename(currentFilePath)
    return detected?.lang
  }

  const applyLanguage = async (lang) => {
    langTask = queueTask(langTask, async () => {
      if (!codeEl?.editor) return
      const nextLang = lang ?? (await detectCurrentLang())
      await codeEl.editor.loadLang(nextLang)
      updateStatus()
    })

    return langTask
  }

  const applyTheme = async (theme) => {
    themeTask = queueTask(themeTask, async () => {
      if (!codeEl?.editor) return
      await codeEl.editor.ready
      await codeEl.editor.loadTheme(theme)
      updateStatus()
    })

    return themeTask
  }

  const openPickerDialog = async ({ label, name, value, content, preview }) => {
    let idleId
    const data = await form(
      {
        tag: "ui-combobox",
        name,
        aria: { label },
        strict: true,
        autofocus: true,
        rows: 9,
        value,
        content,
        on: {
          input: async (_, target) => {
            const { value } = target
            cancelIdleCallback(idleId)
            idleId = requestIdleCallback(async () => {
              if (value === target.value) preview(target.value)
            })
          },
        },
      },
      {
        label,
        agree: "Apply",
        decline: "Cancel",
        opener: codeEl,
        resizable: false,
        maximizable: false,
        minimizable: false,
        width: 300,
        signal: app.signal,
      },
    )

    cancelIdleCallback(idleId)

    return data?.[name]
  }

  const openLanguageDialog = async () => {
    const initialLang = manualLang

    const nextValue = await openPickerDialog({
      label: "Language Mode",
      name: "lang",
      value: initialLang ?? AUTO_DETECT_VALUE,
      content: LANGUAGE_OPTIONS,
      preview: async (value) => {
        await applyLanguage(value === AUTO_DETECT_VALUE ? undefined : value)
      },
    })

    if (nextValue === undefined) {
      await applyLanguage(initialLang)
      return
    }

    manualLang = nextValue === AUTO_DETECT_VALUE ? undefined : nextValue
    await applyLanguage(manualLang)
  }

  const openThemeDialog = async () => {
    const initialTheme = state.theme

    const nextTheme = await openPickerDialog({
      label: "Theme",
      name: "theme",
      value: state.theme,
      content: THEMES.map((theme) => ({
        label: theme,
        value: theme,
      })),
      preview: async (value) => {
        await applyTheme(value)
      },
    })

    if (nextTheme === undefined) {
      await applyTheme(initialTheme)
      return
    }

    state.theme = nextTheme
    await applyTheme(state.theme)
  }

  const syncEditorSettings = async () => {
    if (!codeEl?.editor) return
    await codeEl.editor.ready
    codeEl.editor.set("lineWrapping", state.lineWrapping)
    codeEl.editor.set("minimap", state.minimap)
    updateStatus()
  }

  app
    .on("decode", async (fileAgent, options) => {
      if (options?.reload) return // TODO add warning that file has changed
      currentFilePath = fileAgent.path
      manualLang = undefined
      codeEl.src = fileAgent.path
      await until(codeEl, "load", { signal: app.signal })
      updateStatus()
      await syncEditorSettings()
    })
    .on("encode", () => codeEl.value)

  app.menubar = [
    app.menus.FileMenu(),
    {
      label: "View",
      content: [
        app.menus.fullscreen(),
        // app.menus.openInNewTab(),
        "---",
        {
          tag: "checkbox",
          label: "Word Wrap",
          value: () => state.lineWrapping,
          action: async (e, target) => {
            state.lineWrapping = target.checked
            await syncEditorSettings()
          },
        },
        {
          tag: "checkbox",
          label: "Minimap",
          value: () => state.minimap,
          action: async (e, target) => {
            state.minimap = target.checked
            await syncEditorSettings()
          },
        },
        {
          label: "Change Theme...",
          action: async () => {
            await openThemeDialog()
          },
        },
      ],
    },
    app.menus.HelpMenu(),
  ]

  return [
    {
      tag: "ui-code.grow",
      mode: "complete",
      options: {
        minimap: state.minimap,
        lineWrapping: state.lineWrapping,
      },
      theme: state.theme,
      created(el) {
        codeEl = el
        syncEditorSettings()
      },
      on: {
        input: () => {
          updateStatus()
        },
      },
    },
    {
      tag: "footer.cols.liquid.pa-x-xxs.pa-t-xxs",
      content: [
        {
          tag: "button.clear.ma-l-auto",
          title: "Change Language Mode",
          created(el) {
            statusBar.langMode = el
          },
          action: async () => {
            await openLanguageDialog()
          },
        },
      ],
      created() {
        updateStatus()
      },
    },
  ]
}
