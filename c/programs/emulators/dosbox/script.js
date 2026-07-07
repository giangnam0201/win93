/* eslint-disable prefer-destructuring */
import { createEmulatorApp } from "../../../../42/api/os/EmulatorApp.js"
import { Emitter } from "../../../../42/lib/class/Emitter.js"
import { RomState } from "./modules/RomState.js"
import { mapKeyboard } from "./modules/mapKeyboard.js"
import { mapMouse } from "./modules/mapMouse.js"
import { renderAudio } from "./modules/renderAudio.js"
import { renderCanvas } from "./modules/renderCanvas.js"
import { Canceller } from "../../../../42/lib/class/Canceller.js"
// import { loadArrayBuffer } from "../../../../42/api/load/loadArrayBuffer.js"
// import { getBasename } from "../../../../42/lib/syntax/path/getBasename.js"
// import { libzip } from "../../../../42/formats/compression/zip/zip.w.js"
// import { identifyKeyboardLayout } from "../../../../42/api/env/device/keyboard/identifyKeyboardLayout.js"

// @ts-ignore
const emulators = /** @type {any} */ (window.emulators)

emulators.pathPrefix = "/c/libs/js-dos/8.3/emulators/"

const modules = []
let ci

// const prefix = "/c/libs/js-dos/cores"
// const cache = {}
// async function appendFileToBundle(path, libzip) {
//   const buf = cache[path] ?? (await loadArrayBuffer(path))
//   cache[path] = buf
//   const name = getBasename(path)
//   await libzip.writeFile(name, buf)
//   await libzip.zipAddFile("bundle.zip", name)
// }

class JSDOSEmulator extends Emitter {
  paused = false
  enablePointerLock = true

  constructor(app, ci) {
    super()
    this.app = app
    this.ci = ci
  }

  loadRom() {
    return this.app.openFile()
  }

  togglePause(force = !this.paused) {
    this.paused = force
    if (this.paused) this.ci.pause()
    else this.ci.resume()
    this.emit("togglePause", this.paused)
  }
}

let canceller
let canvas

await createEmulatorApp({
  romType: "arrayBuffer",
  supportsMouse: true,
  // pickFileOnStart: false,
  // file: "/c/users/windows93/roms/dosbox/games/DOOM.jsdos",
  // file: "/c/users/windows93/roms/dosbox/virus/CASCARE.COM.jsdos",
  // file: "/c/users/windows93/roms/dosbox/virus/AMBULANC.COM.jsdos",
  // file: "/c/users/windows93/roms/dosbox/os/dos.jsdos",
  // file: "/c/users/windows93/roms/dosbox/mkeyb.jsdos",
  // file: "/c/users/windows93/roms/dosbox/games/ALONE1.jsdos",
  // file: "/c/users/windows93/roms/dosbox/os/system-win98-v1.jsdos",

  /**
   * @param {ArrayBuffer} rom
   */
  async load(rom, app, fileAgent) {
    ci?.exit?.()
    canceller?.cancel()

    for (const forget of modules) forget()
    modules.length = 0

    canceller = new Canceller()
    const { signal } = canceller

    canvas ??= document.querySelector("canvas")

    const romState = new RomState(fileAgent.path, app)
    const changes = await romState.getChanges()

    const bundle = new Uint8Array(rom)

    /*  */
    /*  */
    /*  */
    /*  */
    let keyboardLayout
    // const keyboardLayout = await identifyKeyboardLayout()

    // if (keyboardLayout?.code && keyboardLayout?.code !== "US") {
    //   libzip.zipToFs(bundle, "/", ".jsdos/")

    //   let dosboxConf = await libzip.readFile(".jsdos/dosbox.conf")
    //   dosboxConf = dosboxConf.replace("DOOM.EXE", "")
    //   dosboxConf = dosboxConf.replace(
    //     "\nc:\n", //
    //     // `\nc:\nKEYB ${kayboardLayout.code}\nCLS\n`,
    //     `\nc:\nKEYB ${keyboardLayout.code}\n`,
    //   )
    //   await libzip.writeFile("bundle.zip", bundle)
    //   await libzip.writeFile(".jsdos/dosbox.conf", dosboxConf)
    //   await libzip.zipAddFile("bundle.zip", ".jsdos/dosbox.conf")

    //   // await appendFileToBundle(`${prefix}/freedos/KEYB.EXE`, libzip)
    //   // await appendFileToBundle(`${prefix}/freedos/KEYBOARD.SYS`, libzip)
    //   // await appendFileToBundle(`${prefix}/freedos/KEYBRD2.SYS`, libzip)
    //   // await appendFileToBundle(`${prefix}/freedos/KEYBRD3.SYS`, libzip)
    //   // await appendFileToBundle(`${prefix}/freedos/KEYBRD4.SYS`, libzip)

    //   await appendFileToBundle(`${prefix}/mkeyb/KEYB.EXE`, libzip)

    //   bundle = await libzip.readFile("bundle.zip", "binary")
    // }
    /*  */
    /*  */
    /*  */
    /*  */

    // const config = await emulators.bundleConfig(bundle)
    // config.dosboxConf = config.dosboxConf.replace(
    //   "echo on", //
    //   "echo on\nkeyb fr",
    // )
    // bundle = await emulators.bundleUpdateConfig(bundle, config)

    ci = await emulators.dosboxXWorker(changes ? [bundle, changes] : bundle, {
      // onExtractProgress: (...args) => {
      //   console.log(args)
      // },
    })
    romState.ci = ci

    ci.config().then((config) => {
      if (config.jsdosConf.output?.options?.autolock?.value === true) {
        canvas.addEventListener(
          "click",
          () => {
            if (!canvas.requestPointerLock) return
            try {
              canvas.requestPointerLock({ unadjustedMovement: true })
            } catch {
              canvas.requestPointerLock()
            }
          },
          { signal },
        )
      }
    })

    const events = ci.events()

    // events.onStdout((onStdout) => {
    //   console.log({ onStdout })
    // })
    // events.onMessage((...args) => {
    //   console.log("onMessage", args)
    // })

    modules.push(
      mapMouse(ci, canvas),
      mapKeyboard(ci, keyboardLayout),
      renderCanvas(ci, events, canvas),
      renderAudio(ci, events),
    )

    async function autosave() {
      // console.log("Autosave start")
      await romState.save()
      // console.log("Autosave done")
    }

    document.addEventListener("pointerleave", autosave, { signal })

    app.dialogEl?.addEventListener(
      "ui:dialog.close",
      (e) => {
        e.preventDefault()
        canceller?.cancel()

        requestAnimationFrame(async () => {
          await Promise.all([
            Promise.allSettled(
              app.dialogEl
                .getAnimations()
                .map((animation) => animation.finished),
            ).then(() => {
              app.dialogEl.style.display = "none"
            }),
            autosave(),
          ])

          app.dialogEl.remove()
        })
      },
      { signal },
    )

    // @ts-ignore
    window.ci = ci
    window.save = autosave

    events.onFrameSize((w, h) => app.resize(w, h))

    return new JSDOSEmulator(app, ci)
  },
})
