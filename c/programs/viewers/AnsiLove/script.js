import { App } from "../../../../42/api/os/App.js"
import { on } from "../../../../42/lib/event/on.js"
import { fileIndex } from "../../../../42/api/fileIndex.js"
import { joinPath } from "../../../../42/lib/syntax/path/joinPath.js"
import { parsePath } from "../../../../42/lib/syntax/path/parsePath.js"
import { getSortableDateTime } from "../../../../42/lib/date/getSortableDateTime.js"

const retina = window.devicePixelRatio > 1

const render = document.querySelector("render")
const app = new App()
let currentFile

let dirname
let fileList = []
let idx
// ANSi (.ANS), PCBOARD (.PCB), BiNARY (.BIN), ADF (.ADF), iDF (.IDF), TUNDRA (.TND), .CBS and XBiN (.XB) formats.
function getFileDir() {
  const parsed = parsePath(currentFile.path)
  dirname = parsed.dir
  fileList = fileIndex
    .glob(
      dirname +
        "/*.{ans,ANS,cbs,CBS,pcb,PCB,bin,BIN,adf,ADF,idf,IDF,tnd,TND,xb,XB}",
    )
    .map((path) => path.slice(dirname.length + 1))
  idx = fileList.indexOf(parsed.base)
}

function right() {
  idx++
  if (idx >= fileList.length) idx = 0
  app.file = joinPath(dirname, fileList[idx])
}

function left() {
  idx--
  if (idx < 0) idx = fileList.length - 1
  app.file = joinPath(dirname, fileList[idx])
}

on(
  render,
  {
    preventDefault: true,
    Left: () => {
      left()
    },
    Right: () => {
      right()
    },
  },

  "#openFile",
  { click: () => app.openFile() },

  "#exportFileAs",
  { click: () => exportFileAs() },

  "#right",
  { click: () => right() },

  "#left",
  { click: () => left() },
)

app
  .on("decode", async (fileAgent) => {
    if (currentFile === fileAgent) return
    currentFile = fileAgent
    getFileDir()
    const bytes = await fileAgent.getArrayBuffer()
    AnsiLove.renderBytes(
      new Uint8Array(bytes),
      (canvas) => {
        document.querySelector("#render").replaceChildren(canvas)
      },
      { "bits": "9", "2x": retina ? 1 : 0 },
    )
  })
  .on("encode", (path) => {
    // console.log(path)
    const canvas = document.querySelector("#render canvas")
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, `image/png`)
    })
  })

function exportFileAs() {
  const timeStamp = getSortableDateTime()

  app.saveFileAs({
    path: undefined,
    suggestedName: `ansilove_${timeStamp}.png`,
    startIn: "desktop",
  })
}

if (!app.file) app.openFile()
