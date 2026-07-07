import "../../../../42/ui/layout/workbench.js"
import { toast } from "../../../../42/ui/layout/toast.js"
import {
  makeGroundMenu,
  setGround,
} from "../../../../42/api/os/makeGroundMenu.js"

function setImageAttributes(img) {
  img.draggable = false
  img.width = img.naturalWidth
  img.height = img.naturalHeight

  if (img.src.endsWith(".svg")) {
    img.style.cssText = /* style */ `
      width: 100%;
      height: 100%;
      object-fit: contain;`
    img.parentElement.classList.toggle("center-content", false)
  } else {
    img.parentElement.classList.toggle("center-content", true)
  }

  // img.style.boxShadow = "0 0 25px 1px #0007, 0 0 0 100vmax #0003"
  // img.style.imageRendering = "pixelated"
}

const onError = (err) => toast(err)

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  await app.initState({
    ground: "checkerboard",
  })

  let currentFile

  /** @type {HTMLButtonElement} */
  let prevBtn
  /** @type {HTMLButtonElement} */
  let nextBtn

  let img = new Image()

  const groundEl = document.createElement("div")
  groundEl.classList.add("center-content", "scroll-xy-auto")
  groundEl.append(img)
  setGround(app, groundEl)

  app.on("decode", async (fileAgent) => {
    if (currentFile === fileAgent) return
    currentFile = fileAgent
    // currentFile.adjacents.loop = true
    currentFile.adjacents.registerButtons(prevBtn, nextBtn)

    const newImage = new Image()
    newImage.src = await fileAgent.getURL()
    await newImage.decode().catch(onError)
    img.replaceWith(newImage)
    img = newImage
    setImageAttributes(img)
    await app.resize({ animate: false })
  })

  if (app.file) {
    currentFile = app.file
    // currentFile.adjacents.loop = true
    img.src = await currentFile.getURL()
    await img.decode().catch(onError)
    setImageAttributes(img)
  } else app.openFile()

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
            label: "Prev image",
            picto: "backward",
            disabled: true,
            action: () => app.file?.adjacents.prev(),
            created(el) {
              prevBtn = el
              currentFile?.adjacents.registerPrevButton(prevBtn)
            },
          },
          {
            label: "Next image",
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
      groundEl,
      // {
      //   tag: ".scroll-xy-auto.center-content",
      //   created(el) {
      //     groundEl = el
      //     setGround(app, groundEl)
      //   },
      //   content: img,
      // },
    ],
    on: {
      // "disrupt": true,
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
