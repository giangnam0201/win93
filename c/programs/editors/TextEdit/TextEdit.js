/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  let textareaEl

  const state = await app.initState({
    monospace: true,
    spellcheck: false,
    wrap: true,
  })

  app
    .on("decode", async (fileAgent) => {
      textareaEl.removeAttribute("readonly")
      textareaEl.removeAttribute("aria-busy")
      textareaEl.value = await fileAgent.getText()
    })
    .on("encode", () => textareaEl.value)

  app.menubar = [
    app.menus.FileMenu(),
    {
      label: "View",
      content: [
        app.menus.fullscreen(),
        app.menus.openInNewTab(),
        "---",
        {
          tag: "checkbox",
          label: "Monospace",
          value: () => state.monospace,
          action: (e, target) => {
            state.monospace = target.checked
            textareaEl.classList.toggle("font-mono", target.checked)
          },
        },
        {
          tag: "checkbox",
          label: "Wrap",
          value: () => state.wrap,
          action: (e, target) => {
            state.wrap = target.checked
            textareaEl.wrap = target.checked ? "soft" : "off"
          },
        },
        {
          tag: "checkbox",
          label: "Spellcheck",
          value: () => state.spellcheck,
          action: (e, target) => {
            state.spellcheck = target.checked
            textareaEl.spellcheck = target.checked
          },
        },
      ],
    },
    app.menus.HelpMenu(),
  ]

  return {
    tag: "textarea",
    id: `${app.id}__textarea`,
    class: { "font-mono": state.monospace },
    spellcheck: state.spellcheck,
    wrap: state.wrap ? "soft" : "off",
    readonly: Boolean(app.file),
    aria: { busy: Boolean(app.file) },
    created(el) {
      textareaEl = el
    },
  }
}
