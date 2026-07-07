import { os } from "../../../../42/api/os.js"
import "../../../../42/ui/layout/workbench.js"
import { shader } from "../../../../42/ui/media/shader.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  let currentFile
  let srcdoc
  let prevBtn
  let nextBtn

  app.on("decode", async (fileAgent, options) => {
    if (options?.reload !== true && currentFile === fileAgent) return
    currentFile = fileAgent
    currentFile.adjacents.registerButtons(prevBtn, nextBtn)
    shaderEl.srcdoc = await fileAgent.getText()
    shaderEl.resetTime()
    shaderEl.resetMouse()
  })

  if (app.file) {
    currentFile = app.file
    srcdoc = await currentFile.getText()
  } else {
    app.openFile()
  }

  const shaderEl = shader({ srcdoc, autoplay: true })

  return {
    tag: "ui-workbench.screen",
    reveal: true,
    content: [
      {
        tag: "ui-toolbar",
        area: "top",
        content: [
          {
            label: "Edit shader…",
            picto: "pencil",
            action: async () => {
              if (!app.file?.path) {
                const path = await app.getSavePath()
                if (path === false) return
                await os.fs.writeText(path, "")
                app.loadFile(path)
              }
              os.exec(`$EDITOR -x 0 -- '${app.file.path}'`)
            },
          },
          {
            label: "Reset time",
            picto: "arrow-stop-left",
            action: () => shaderEl.resetTime(),
          },
          { spacer: true },
          {
            label: "Prev shader",
            picto: "backward",
            disabled: true,
            action: () => app.file?.adjacents.prev(),
            created(el) {
              prevBtn = el
              currentFile?.adjacents.registerPrevButton(prevBtn)
            },
          },
          {
            label: "Next shader",
            picto: "forward",
            disabled: true,
            action: () => app.file?.adjacents.next(),
            created(el) {
              nextBtn = el
              currentFile?.adjacents.registerNextButton(nextBtn)
            },
          },
          {
            label: "Open File…",
            picto: "eject",
            action: () => app.openFile(),
          },
        ],
      },
      shaderEl,
    ],
    on: {
      "repeatable": true,
      "ArrowRight || ArrowUp": (e, target) => {
        target.focus()
        app.file?.adjacents.next({ loop: true })
      },
      "ArrowLeft || ArrowDown": (e, target) => {
        target.focus()
        app.file?.adjacents.prev({ loop: true })
      },
    },
  }
}
