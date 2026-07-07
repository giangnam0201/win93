/* eslint-disable dot-notation */
import "../../lib/audio/mixer.js"
import "../../ui/layout/workbench.js"
import { gamepad } from "../../ui/interface/gamepad.js"
import { App } from "./App.js"
import { alert } from "../../ui/layout/dialog.js"
import { render } from "../gui/render.js"
import { toolbar } from "../../ui/layout/menu.js"
import { getStemname } from "../../lib/syntax/path/getStemname.js"
import { filePickerOpen, filePickerSave } from "../../ui/desktop/explorer.js"
import { slugify } from "../../lib/type/string/slugify.js"
import { getSortableDateTime } from "../../lib/date/getSortableDateTime.js"
import { ensureElement } from "../../lib/type/element/ensureElement.js"
import { os } from "../os.js"
import {
  blobToBinaryString,
  blobToDataURL,
} from "../../lib/type/binary/blobToDataURL.js"

/** @import { WorkbenchComponent } from "../../ui/layout/workbench.js" */

let toast

export class EmulatorApp extends App {
  statePathDir = "emulators"

  constructor(options) {
    super()
    this.init(options)
  }

  setFullName(fullName) {
    this.fullName = fullName
    this.slug = `${this.command}_${slugify(this.fullName, { preserveUnicode: false })}`
    this.setTitle(fullName)
  }

  getExportStemname() {
    return `${this.slug}_${getSortableDateTime()}`
  }

  wrapWithPause(fn) {
    return async (...args) => {
      const { paused } = this.emulator
      if (!paused) this.emulator.togglePause(true)
      await fn(...args)
      if (!paused) this.emulator.togglePause(false)
    }
  }

  async init(options) {
    await this.ready

    document.title ||= this.name
    this.off("decode", this.setTitleListener)

    this.config.core ??= this.name

    this.topToolbar = toolbar({
      area: "top",
      iconOnly: true,
    })
    this.bottomToolbar = toolbar({
      area: "bottom",
      iconOnly: true,
    })

    this.el = render({
      tag: "ui-emulator",
      aria: { busy: true },
      content: [
        { tag: ".ui-emulator__message.font-mono.hide" },
        {
          tag: "ui-workbench",
          reveal: true,
          // active: true,
          content: [
            this.topToolbar,
            {
              tag: "canvas",
              width: this.manifest.dialog.width,
              height: this.manifest.dialog.height,
            },
            this.bottomToolbar,
          ],
        },
        gamepad(),
      ],
    })

    document.body.append(this.el)

    this.canvas = this.el.querySelector("canvas")
    this.canvas.tabIndex = 0
    /** @type HTMLElement */
    this.messageEl = this.el.querySelector(".ui-emulator__message")
    /** @type HTMLElement */
    this.loadingEl = document.body.querySelector(".loading")

    if (!this.loadingEl) {
      this.loadingEl = document.createElement("div")
      this.loadingEl.className = "loading center-self"
      document.body.append(this.loadingEl)
    }

    this.fullScreenHandler = () => {
      if (document.pointerLockElement === this.canvas) return
      this.toggleFullscreen()
    }

    this.canvas.addEventListener("dblclick", this.fullScreenHandler)
    this.canvas.addEventListener("pointerdown", () => this.canvas.focus())

    this.el.addEventListener("contextmenu", (e) => e.preventDefault())

    let inited = false

    this.decode.startIn ??= `roms/${this.name ?? ""}`

    toast = this.desktopRealm.sys42?.toast ?? os.toast

    this.on("decode", async (fileAgent) => {
      this.el.toggleAttribute("aria-busy", true)
      this.canvas.classList.toggle("hide", true)
      this.loadingEl.classList.toggle("hide", false)
      this.loadingEl.textContent = "Loading ROM"

      let data

      if (options?.romType === "url") {
        data = await fileAgent.getURL()
      } else {
        data = await fileAgent.getBlob()

        switch (options?.romType) {
          case "binaryString":
            data = await blobToBinaryString(data)
            break

          case "arrayBuffer":
            data = await data.arrayBuffer()
            break

          case "bytes":
            data = new Uint8Array(await data.arrayBuffer())
            break

          case "dataURL":
            data = await blobToDataURL(data)
            break

          default:
            break
        }
      }

      try {
        if (inited === false && options?.init) {
          this.emulator = await options.init.call(this, this.canvas, this)
          inited = true
        }

        const emulator = await options?.load?.call(this, data, this, fileAgent)
        this.emulator ??= emulator
      } catch (err) {
        alert(err)
      }

      this.emulator ??= {}

      this.setFullName(getStemname(fileAgent.path))

      if (options?.supportsMouse ?? this.emulator?.config?.supportsMouse) {
        this.canvas.removeEventListener("dblclick", this.fullScreenHandler)
      }

      if (this.emulator.on) {
        this.emulator.off?.("*")
        this.emulator.on("error", (err, options) => {
          alert(err, options)
        })

        this.emulator.on("notif", (message, options) => {
          toast(message, options)
        })

        this.emulator.on("fullName", (fullName) => {
          this.setFullName(fullName)
        })

        this.emulator.on("nativeSize", ({ width, height }) => {
          this.resize(
            width * this.config.zoom, //
            height * this.config.zoom,
          )
        })

        let mesageTimeoutId

        this.emulator.on("message", (message) => {
          clearTimeout(mesageTimeoutId)
          this.messageEl.classList.toggle("hide", false)
          this.messageEl.replaceChildren()
          render(message, this.messageEl)
          mesageTimeoutId = setTimeout(() => {
            this.messageEl.classList.toggle("hide", true)
          }, 2500)
        })
      }

      if ("ready" in this.emulator) await this.emulator.ready

      this.el.removeAttribute("aria-busy")
      this.canvas.classList.toggle("hide", false)
      this.loadingEl.classList.toggle("hide", true)
      this.loadingEl.textContent = ""

      this.createToolbars()
    })

    if (options?.file) {
      this.loadFile(options?.file)
    } else if (!this.file && options?.pickFileOnStart !== false) {
      this.openFile()
    }
  }

  async createToolbars() {
    if (this.toolbarDone) return

    const isFullscreen = this.isFullscreen()

    this.menuItems = {
      "Core Settings": {
        if: this.emulator.setCoreSettings,
        label: "Core Settings…",
        picto: "faders",
        action: async () => {
          await this.emulator.setCoreSettings()
        },
      },

      "Save State": {
        if: this.emulator.getState,
        label: "Save State…",
        picto: "save",
        action: this.wrapWithPause(async () => {
          const { ok, selection } = await filePickerSave({
            id: this.slug + "_state",
            title: `Save State — ${this.name}`,
            picto: this.getIcon("16x16"),
            startIn: "documents",
            suggestedName: `${this.getExportStemname()}.state`,
          })
          if (!ok) return
          const [path] = selection
          this.lastSavedStatePath = path
          os.fs.write(path, this.emulator.getState())
        }),
      },

      "Load State": {
        if: this.emulator.setState,
        label: "Load State…",
        picto: "folder-open",
        action: this.wrapWithPause(async () => {
          const { ok, selection } = await filePickerOpen({
            id: this.slug + "_state",
            title: `Load State — ${this.name}`,
            picto: this.getIcon("16x16"),
            startIn: "documents",
            path: this.lastSavedStatePath,
          })
          if (!ok) return
          const [path] = selection
          const data = await os.fs.read(path)
          this.emulator.setState(new Uint8Array(data))
        }),
      },

      "Screenshot": {
        if: this.emulator.screenshot,
        label: "Screenshot",
        picto: "photo", // "image", // "screen"
        action: this.wrapWithPause(async () => {
          const uint8 = await this.emulator.screenshot()
          const { ok, selection } = await filePickerSave({
            id: this.slug + "_screenshot",
            startIn: "pictures",
            suggestedName: `${this.getExportStemname()}.png`,
          })
          if (!ok) return
          const [path] = selection
          os.fs.write(path, uint8)
        }),
      },

      "Control Settings": {
        if: this.emulator.setControls,
        label: "Control Settings…",
        picto: "joystick",
        action: this.wrapWithPause(() => this.emulator.setControls()),
      },

      "Cheats": {
        if: this.emulator.setCheats,
        label: "Cheats…",
        picto: "magic", // "smiley"
        action: () => {
          this.emulator.setCheats()
        },
      },

      "Shader": {
        if: this.emulator.setShader,
        label: "Shader…",
        picto: "palette",
        action: () => this.emulator.setShader(),
      },

      "Import Save File": {
        if: this.emulator.saveExtension,
        label: "Import Save File…",
        picto: "save-import",
        action: this.wrapWithPause(async () => {
          const { ok, selection } = await filePickerOpen({
            id: this.slug + "_save",
            title: `Import Save File — ${this.name}`,
            picto: this.getIcon("16x16"),
            startIn: "documents",
            path: this.lastSavedSaveFilePath,
          })
          if (!ok) return
          const [path] = selection
          const data = await os.fs.read(path)
          this.emulator.setSaveFile(new Uint8Array(data))
        }),
      },

      "Export Save File": {
        if: this.emulator.saveExtension,
        label: "Export Save File…",
        picto: "save-export",
        action: this.wrapWithPause(async () => {
          const { ok, selection } = await filePickerSave({
            id: this.slug + "_save",
            title: `Export Save File — ${this.name}`,
            picto: this.getIcon("16x16"),
            startIn: "documents",
            suggestedName: `${this.getExportStemname()}.${this.emulator.saveExtension}`,
          })
          if (!ok) return
          const [path] = selection
          this.lastSavedSaveFilePath = path
          const file = this.emulator.getSaveFile()
          os.fs.write(path, file)
        }),
      },

      "Restart": {
        if: this.emulator.restart,
        label: "Restart",
        picto: "arrow-ccw",
        action: () => this.emulator.restart(),
      },
      "Load rom": {
        label: "Load rom…",
        picto: "eject",
        action: this.emulator.loadRom
          ? () => this.emulator.loadRom()
          : () =>
              this.restart({
                paths: undefined,
                state: undefined,
                cheat: undefined,
                cheats: undefined,
              }),
      },

      //

      "Pause": {
        if: this.emulator.togglePause,
        id: "pauseButton",
        label: "Pause",
        picto: "pause",
        action: () => this.emulator.togglePause(),
      },

      "Rewind": {
        if:
          this.emulator.toggleRewind && //
          this.emulator.config.rewindEnabled,
        label: "Rewind",
        picto: "fast-backward",
        on: {
          "pointerdown": () => this.emulator.toggleRewind(true),
          "pointerup || pointercancel": () => this.emulator.toggleRewind(false),
        },
      },
      "Fast Forward": {
        if: this.emulator.toggleFastForward,
        label: "Fast Forward",
        picto: "fast-forward",
        on: {
          "pointerdown": () => this.emulator.toggleFastForward(true),
          "pointerup || pointercancel": () =>
            this.emulator.toggleFastForward(false),
        },
      },

      "Toggle Slow Motion": {
        if: this.emulator.toggleSlowMotion,
        id: "slowMotion",
        label: "Toggle Slow Motion",
        picto: "slow",
        aria: { pressed: false },
        action: (e, target) => {
          const val = target.ariaPressed !== "true"
          target.ariaPressed = val
          if (val && fastForward?.ariaPressed === "true") {
            fastForward.ariaPressed = "false"
            this.emulator.toggleFastForward(false)
          }

          this.emulator.toggleSlowMotion(val)
        },
      },
      "Toggle Fast Forward": {
        if: this.emulator.toggleFastForward,
        id: "fastForward",
        label: "Toggle Fast Forward",
        picto: "fast",
        aria: { pressed: false },
        action: (e, target) => {
          const val = target.ariaPressed !== "true"
          target.ariaPressed = val
          if (val && slowMotion?.ariaPressed === "true") {
            slowMotion.ariaPressed = "false"
            this.emulator.toggleSlowMotion(false)
          }

          this.emulator.toggleFastForward(val)
        },
      },
      "Enable Pointer Lock": {
        if: this.emulator.enablePointerLock,
        label: "Enable Pointer Lock",
        picto: "cursor",
        action: () => {
          const el =
            this.emulator.enablePointerLock === true
              ? this.canvas
              : ensureElement(this.emulator.enablePointerLock)

          if (!el.requestPointerLock) return
          try {
            el.requestPointerLock({ unadjustedMovement: true })
          } catch {
            el.requestPointerLock()
          }
        },
      },

      "Zoom 200%": {
        if: this.emulator.zoom2x !== false,
        id: "zoomButton",
        label: "Zoom 200%",
        picto: this.config.zoom === 1 ? "magnifier-plus" : "magnifier-minus",
        disabled: isFullscreen,
        action: async (e, target) => {
          this.config.zoom = this.config.zoom === 1 ? 2 : 1
          target.firstChild.value =
            this.config.zoom === 1 ? "magnifier-plus" : "magnifier-minus"
          this.resize(this.canvas.width, this.canvas.height)
        },
      },
      "Enter Fullscreen": {
        if: this.emulator.toggleFullscreen !== false,
        id: "fullscreenButton",
        label: isFullscreen ? "Leave Fullscreen" : "Enter Fullscreen",
        picto: isFullscreen ? "shrink" : "grow",
        disabled: !document.fullscreenEnabled,
        action: () => {
          this.toggleFullscreen()
        },
      },
    }

    const settingsItems = [
      this.menuItems["Core Settings"],
      this.menuItems["Control Settings"],
      "---",
      // this.menuItems["Load rom"],
      this.menuItems["Import Save File"],
      this.menuItems["Export Save File"],
      "---",
      this.menuItems["Save State"],
      this.menuItems["Load State"],
      "---",
      this.menuItems["Cheats"],
      this.menuItems["Shader"],
      "---",
      this.menuItems["Screenshot"],
      // this.menuItems["Restart"],
    ]

    const hasSettingsMenu = settingsItems.some((item) => {
      if (item === "---") return false
      // @ts-ignore
      if ("if" in item && !item.if) return false
      return true
    })

    const toolBarHead = []
    if (hasSettingsMenu) {
      toolBarHead.push({
        label: "Settings",
        picto: "cog",
        content: settingsItems,
      })
    }

    this.topToolbar.content = [
      ...toolBarHead,
      // this.menuItems["Shader"],
      // this.menuItems["Control Settings"],
      // this.menuItems["Save State"],
      // this.menuItems["Load State"],
      // this.menuItems["Screenshot"],
      { spacer: true },
      this.menuItems["Restart"],
      this.menuItems["Load rom"],
    ]

    this.bottomToolbar.content = [
      this.menuItems["Pause"],
      this.menuItems["Rewind"],
      this.menuItems["Fast Forward"],
      this.menuItems["Toggle Slow Motion"],
      this.menuItems["Toggle Fast Forward"],
      this.menuItems["Enable Pointer Lock"],
      { spacer: true },
      this.menuItems["Zoom 200%"],
      this.menuItems["Enter Fullscreen"],
    ]

    await Promise.all([this.topToolbar.ready, this.bottomToolbar.ready])

    const slowMotion = this.el.querySelector("#slowMotion")
    const fastForward = this.el.querySelector("#fastForward")

    const pauseButton = /** @type {HTMLButtonElement} */ (
      this.el.querySelector("#pauseButton")
    )

    this.emulator.on?.("togglePause", (res) => {
      // @ts-ignore
      pauseButton.firstChild.value = res ? "play" : "pause"
      pauseButton.title = res ? "Play" : "Pause"
    })

    const fullscreenButton = /** @type {HTMLButtonElement} */ (
      this.el.querySelector("#fullscreenButton")
    )
    const zoomButton = /** @type {HTMLButtonElement} */ (
      this.el.querySelector("#zoomButton")
    )

    this.on("fullscreenChange", (res) => {
      zoomButton.disabled = res
      // @ts-ignore
      fullscreenButton.firstChild.value = res ? "shrink" : "grow"
      pauseButton.title = res ? "Leave Fullscreen" : "Enter Fullscreen"
    })

    const workbenchEl = /** @type {WorkbenchComponent} */ (
      this.el.querySelector("ui-workbench")
    )
    workbenchEl.addEventListener("ui:workbench.active-change", () => {
      this.el.classList.toggle("cursor-none", !workbenchEl.active)
    })

    this.toolbarDone = true
  }
}

export async function createEmulatorApp(options) {
  const instance = new EmulatorApp(options)
  await Promise.all([instance.ready, instance.emulator?.ready])
  return instance
}
