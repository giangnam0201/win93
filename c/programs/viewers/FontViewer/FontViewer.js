import "../../../../42/ui/layout/workbench.js"
import { alert } from "../../../../42/ui/layout/dialog.js"
import {
  makeGroundMenu,
  setGround,
} from "../../../../42/api/os/makeGroundMenu.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  await app.initState({
    ground: "checkerboard",
  })

  let currentFile
  let prevBtn
  let nextBtn
  let groundEl

  // ─────────────────────────────────────────────
  // Text specimen
  // ─────────────────────────────────────────────
  let fontSize = 32

  const textEl = document.createElement("div")
  textEl.textContent = "The quick brown fox jumps over the lazy dog"
  textEl.style.fontSize = fontSize + "px"
  textEl.style.padding = "2rem"
  textEl.style.textAlign = "center"
  textEl.style.whiteSpace = "wrap"
  textEl.style.lineHeight = "1.25"
  textEl.style.maxWidth = "90ch"
  textEl.style.margin = "auto"
  textEl.dataset.autofocus = true

  // ─────────────────────────────────────────────
  // Font loading
  // ─────────────────────────────────────────────
  async function loadFont(fileAgent) {
    try {
      const buffer = await fileAgent.getArrayBuffer()
      const fontName = `font-${crypto.randomUUID()}`

      const fontFace = new FontFace(fontName, buffer)
      await fontFace.load()

      document.fonts.add(fontFace)
      textEl.style.fontFamily = fontName

      app.resize()
    } catch (err) {
      alert(err)
    }
  }

  // ─────────────────────────────────────────────
  // File handling
  // ─────────────────────────────────────────────
  app.on("decode", async (fileAgent) => {
    if (currentFile === fileAgent) return
    currentFile = fileAgent

    currentFile.adjacents.registerButtons(prevBtn, nextBtn)
    await loadFont(fileAgent)
  })

  if (app.file) {
    currentFile = app.file
    app.once("ready", () => loadFont(currentFile))
  } else {
    app.openFile()
  }

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return {
    tag: "ui-workbench",
    reveal: true,
    content: [
      {
        tag: "ui-toolbar",
        area: "top",
        content: [
          {
            label: "Background",
            picto: "cog",
            content: () => makeGroundMenu(app, groundEl),
          },
          { spacer: true },
          {
            label: "Prev font",
            picto: "backward",
            disabled: true,
            action: () => app.file?.adjacents.prev(),
            created(el) {
              prevBtn = el
              currentFile?.adjacents.registerPrevButton(prevBtn)
            },
          },
          {
            label: "Next font",
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
      {
        tag: ".scroll-xy-auto",
        created(el) {
          groundEl = el
          setGround(app, groundEl)

          el.addEventListener(
            "wheel",
            (e) => {
              if (!e.shiftKey) return

              e.preventDefault()

              const delta =
                e.deltaY !== 0 ? Math.sign(e.deltaY) : Math.sign(e.deltaX)

              fontSize -= delta * 2
              fontSize = Math.min(Math.max(fontSize, 8), 256)

              textEl.style.fontSize = fontSize + "px"
              app.resize()
            },
            { passive: false }
          )


        },
        content: textEl,
        on: {
          "repeatable": true,
          "ArrowRight || ArrowUp": () =>
            app.file?.adjacents.next({ loop: true }),
          "ArrowLeft || ArrowDown": () =>
            app.file?.adjacents.prev({ loop: true }),
        },
      },
    ],
  }
}
