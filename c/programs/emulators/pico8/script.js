import { createEmulatorApp } from "../../../../42/api/os/EmulatorApp.js"
import { loadScript } from "../../../../42/api/load/loadScript.js"
import { noop } from "../../../../42/lib/type/function/noop.js"
import { trap } from "../../../../42/api/trap.js"
import { logger } from "../../../../42/api/logger.js"
import { KEY_CODES } from "../../../../42/lib/constant/KEY_CODES.js"

const Module = {}
// @ts-ignore
window.Module = Module

await createEmulatorApp({
  romType: "url",

  /**
   * @param {Blob} rom
   */
  async load(rom, { signal }) {
    trap(
      (err) => {
        if (this.shell) this.shell.stderr.writeln(err.stack)
        else {
          logger.groupCollapsed(err)
          logger.dir(err)
          logger.groupEnd()
        }

        return false
      },
      { signal },
    )

    if (this.shell) {
      // console.log = (msg) => this.shell.stdout.writeln(msg)
      // console.error = (msg) => this.shell.stderr.writeln(msg)
      Module.print = (msg) => this.shell.stdout.writeln(msg)
      Module.printErr = (msg) => this.shell.stderr.writeln(msg)
    } else {
      // console.log = noop
      // console.error = noop
      Module.print = noop
      Module.printErr = noop
    }

    Module.canvas = this.canvas
    Module.arguments = [rom]

    // Module.arguments = [encodeURI(rom)]
    // Module.arguments = ["-run", rom]

    // Module.arguments = []
    // window.codo_command = 9
    // window.p8_dropped_cart = rom
    // window.p8_dropped_cart_name = app.file.getName()
    // log("----", window.p8_dropped_cart_name)

    await loadScript(new URL("./cores/pico8_0206c_dev8.js", import.meta.url))

    // Fix pointerlock
    // ---------------

    document.addEventListener(
      "pointerlockchange",
      () => {
        // @ts-ignore
        const { Browser, SDL } = window

        if (Browser) {
          Browser.mouseX ??= Math.round(this.canvas.width / 2)
          Browser.mouseY ??= Math.round(this.canvas.height / 2)
        }

        if (SDL) {
          if (SDL.mouseX === undefined) {
            Object.defineProperty(SDL, "mouseX", { get: () => Browser.mouseX })
          }

          if (SDL.mouseY === undefined) {
            Object.defineProperty(SDL, "mouseY", { get: () => Browser.mouseY })
          }
        }
      },
      false,
    )

    // Keyboard proxy to use KeyboardEvent.code
    // ----------------------------------------

    function fakeKeyEvent(type, e) {
      // if (e.isTrusted && e.code.startsWith("Key")) {
      if (e.isTrusted) {
        e.stopImmediatePropagation()
        const [keyCode, key] = KEY_CODES[e.code]
        // logger.log(e.code, keyCode, key)
        document.dispatchEvent(new KeyboardEvent(type, { keyCode, key }))
      }
    }

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.repeat) return
        e.preventDefault()
        fakeKeyEvent("keydown", e)
      },
      { capture: true },
    )
    document.addEventListener(
      "keyup",
      (e) => {
        fakeKeyEvent("keyup", e)
      },
      { capture: true },
    )

    return {
      enablePointerLock: true,
      togglePause: (force) => Module.pico8TogglePaused(force),
    }
  },
})
