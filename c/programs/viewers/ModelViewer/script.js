import { os } from "../../../../42/api/os.js"
import { App } from "../../../../42/api/os/App.js"
import { model } from "../../../../42/ui/media/model.js"
import { workbench } from "../../../../42/ui/layout/workbench.js"
import { getStemname } from "../../../../42/lib/syntax/path/getStemname.js"
import { getDirname } from "../../../../42/lib/syntax/path/getDirname.js"
import { joinPath } from "../../../../42/lib/syntax/path/joinPath.js"
import {
  makeGroundMenu,
  setGround,
} from "../../../../42/api/os/makeGroundMenu.js"

const app = new App()

await app.initState({
  ground: "checkerboard",
})

setGround(app)

let animationsEl
const modelEl = model()

const workbenchEl = workbench({
  reveal: true,
  content: [
    modelEl,
    {
      tag: "ui-toolbar",
      area: "top",
      content: [
        {
          picto: "cog",
          content: makeGroundMenu(app),
        },
        { spacer: true },
        {
          picto: "eject",
          action: () => app.openFile(),
        },
      ],
    },
    {
      tag: "ui-toolbar",
      area: "bottom",
      created(el) {
        animationsEl = el
      },
    },
  ],
})

workbenchEl.className = "fit"
document.body.append(workbenchEl)

const dances = []

app.on("decode", async (fileAgent) => {
  modelEl.load(await fileAgent.getBlob(), fileAgent.path)

  dances.length = 0

  const dancerDir = joinPath(
    getDirname(fileAgent.path),
    getStemname(fileAgent.path),
  )

  if (os.fileIndex.has(dancerDir)) {
    const anims = os.fileIndex
      .readDir(dancerDir, { absolute: true })
      .map((item, i) => {
        const action = () => {
          modelEl.loadAnimation(item)
        }
        dances.push(action)
        return {
          label: String(i + 1),
          title: getStemname(item),
          action,
        }
      })

    anims.unshift({
      label: "0",
      title: "No animation",
      action: () => {
        modelEl.loadAnimation()
      },
    })

    animationsEl.content = anims
  } else {
    animationsEl.content = []
  }
})

document.addEventListener("keydown", ({ code }) => {
  if (code.startsWith("Numpad") || code.startsWith("Digit")) {
    const idx = Number(code.replace("Numpad", "").replace("Digit", "")) + 1
    dances[idx]?.()
  }
})

if (!app.file) {
  app.openFile()
  // app.loadFile("/c/users/windows93/models/dancers/goku.fbx")
}
