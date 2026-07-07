/* eslint-disable camelcase */
/* eslint-disable complexity */

/* Based on @emulatorjs/emulatorjs 4.2.2 */

import {
  DEFAULT_CONTROLLERS,
  normalizeControls,
  setControls,
  SPECIAL_KEYS,
} from "./retroArchControls.js"
// import { RETRO_ARCH_SHADERS } from "./RETRO_ARCH_SHADERS.js"
import { EmscriptenFS } from "../../../42/api/fs/class/EmscriptenFS.js"
import { os } from "../../../42/api/os.js"
import { Emitter } from "../../../42/lib/class/Emitter.js"
import { getBasename } from "../../../42/lib/syntax/path/getBasename.js"
import { defer } from "../../../42/lib/type/promise/defer.js"
import { shortenFilename } from "../../../42/api/fs/normalizeFilename.js"
import { noop } from "../../../42/lib/type/function/noop.js"
import { watchResize } from "../../../42/lib/type/element/watchResize.js"
import { gamepads } from "../../../42/api/env/device/gamepads.js"
import { sevenZip } from "../../../42/formats/compression/sevenZip.js"
import { loadScript } from "../../../42/api/load/loadScript.js"
import { loadJSON } from "../../../42/api/load/loadJSON.js"
import { form } from "../../../42/ui/layout/dialog.js"
import { parseINI } from "../../../42/formats/data/INI/parseINI.js"
import { merge } from "../../../42/lib/type/object/merge.js"
import { getDesktopRealm } from "../../../42/api/env/realm/getDesktopRealm.js"
import { getStemname } from "../../../42/lib/syntax/path/getStemname.js"
import { getDirname } from "../../../42/lib/syntax/path/getDirname.js"

const desktopRealm = getDesktopRealm()

const GENERIC_SYSTEMS = {
  // Generic
  Arcade: "fbneo",
  n64: "parallel_n64",
  // "n64": "mupen64plus_next",
  nds: "melonds",
  // "nds": "desmume",
  dmg: "gambatte",
  // gb: "mgba",
  gba: "mgba",
  nes: "fceumm",
  snes: "snes9x",
  vb: "beetle_vb",
  psx: "pcsx_rearmed",
  gg: "genesis_plus_gx",
  sms: "genesis_plus_gx",
  // "sms": "smsplus",
  Megadrive: "genesis_plus_gx",
  pce: "mednafen_pce",
  pcfx: "mednafen_pcfx",
  ngp: "mednafen_ngp",
  Lynx: "handy",
  a2600: "stella2014",
  a5200: "a5200",
  Jaguar: "virtualjaguar",
  Coleco: "gearcoleco",
  Amiga: "puae",
  ws: "mednafen_wswan",
  prBoom: "prboom",
  cpc: "crocods",
  c64: "vice_x64sc",
  Mame: "mame2003_plus",
  Dosbox: "dosbox_pure",
}

const USE_SET_GEOMETRY = new Set(["genesis_plus_gx"])
const PREVENT_WIDESCREEN = new Set(["pcsx_rearmed"])
const ROTATE_ON_NEGATIVE_RATIO = new Set(["fbneo"])
const MOUSE_ENABLED = new Set(["melonds"])

/** @type [string | RegExp, Record<string, any>][] */
const ROM_OPTIONS = [
  [/240psuite-n64/i, { core: "mupen64plus_next" }], //
  [/n64_controller_test/i, { core: "mupen64plus_next" }],
  [/mimi-.*.z64/i, { core: "mupen64plus_next" }],
  [/super.*bowsette.*64/i, { core: "parallel_n64" }],
  // [/pyoro64.n64/i, { fixedGeometry: [640, 480] }],
]

const FIXED_GEOMETRY = {
  puae: [720, 576],
  // pcsx_rearmed: [640, 480],
  // melonds: [256, 384],
  // mupen64plus_next: [320, 240],
  // parallel_n64: [320, 240],
}

const BIOS = {
  fbalpha2012_cps1: "fbneo",
  fbalpha2012_cps2: "fbneo",
}

const CORE_SAVE = {
  gambatte: "sav",
}

const CORE_CONFIGS = {
  // puae: {
  //   "puae_floppy_sound": "0", // puae_floppy_sound = "80"
  //   "puae_video_aspect": "PAL",
  //   "puae_video_resolution": "hires",
  //   "puae_crop":"maximum",
  // },

  parallel_n64: {
    "parallel-n64-screensize": "320x240",
    // "parallel-n64-cpucore": "pure_interpreter",
    // // "parallel-n64-filtering": "nearest",
    // "parallel-n64-filtering": "N64 3-point",
    // "parallel-n64-polyoffset-factor": "0.0",
    // "parallel-n64-gfxplugin": "angrylion",
    // "parallel-n64-angrylion-vioverlay": "Unfiltered",
    // "parallel-n64-parallel-rdp-upscaling": "8x",
  },

  mupen64plus_next: {
    "mupen64plus-43screensize": "320x240",
  },

  snes9x: {
    // snes9x_sndchan_1: "disabled",
    // snes9x_sndchan_2: "disabled",
    // snes9x_sndchan_3: "disabled",
    // snes9x_sndchan_4: "disabled",
    // snes9x_sndchan_5: "disabled",
    // snes9x_sndchan_6: "disabled",
    // snes9x_sndchan_7: "disabled",
    // snes9x_sndchan_8: "disabled",
    // snes9x_audio_interpolation: "none",
    // snes9x_audio_interpolation: "linear",
    // snes9x_audio_interpolation: "cubic",
    // snes9x_region: "PAL",
    // snes9x_region: "NTSC",
    // snes9x_audio_interpolation: "sinc",
    // snes9x_echo_buffer_hack: "enabled",
    snes9x_block_invalid_vram_access: "disabled",
    snes9x_overclock_superfx: "50%",
  },

  gambatte: {
    gambatte_gb_colorization: "internal",
    gambatte_gb_internal_palette: "Special 1",
    gambatte_turbo_period: "120",
    gambatte_mix_frames: "lcd_ghosting_fast",
    // gambatte_gb_internal_palette: "GBC - Dark Green",
    // gambatte_gb_internal_palette: "GB - Light",
  },

  // pcsx_rearmed: {
  //   pcsx_rearmed_display_fps_v2: "enabled",
  //   pcsx_rearmed_psxclock: "10",
  // },

  // genesis_plus_gx: {
  //   genesis_plus_gx_md_channel_0_volume: "0",
  //   genesis_plus_gx_md_channel_1_volume: "0",
  //   genesis_plus_gx_md_channel_2_volume: "100",
  //   genesis_plus_gx_md_channel_3_volume: "0",
  //   genesis_plus_gx_md_channel_4_volume: "0",
  //   genesis_plus_gx_md_channel_5_volume: "0",
  // },

  vice_x64sc: {
    vice_aspect_ratio: "pal",
    vice_zoom_mode_crop: "4:3",
    vice_zoom_mode: "small",
    // "parallel-n64-cpucore": "pure_interpreter",
    // // "parallel-n64-filtering": "nearest",
    // "parallel-n64-filtering": "N64 3-point",
    // "parallel-n64-polyoffset-factor": "0.0",
    // "parallel-n64-gfxplugin": "angrylion",
    // "parallel-n64-angrylion-vioverlay": "Unfiltered",
    // "parallel-n64-parallel-rdp-upscaling": "8x",
  },
}

function parseGeometry(str, options) {
  let [, width, height, ratio] = str.match(
    /(?:Geometry|SET_GEOMETRY): (\d+)x(\d+), Aspect: (\d+\.?\d*)/,
  )
  width = Number(width)
  height = Number(height)
  ratio = Number(ratio)

  if (options?.rotateOnNegativeRatio && Number(ratio) < 1) {
    const tmp = width
    width = height
    height = tmp
  }

  if (options?.preventWidescreen && width >= height * 2) {
    return { width, height: Math.round(width / ratio), ratio }
  }

  return { width, height, ratio }
}

async function parseCheatFile(url) {
  const source = await os.fs.readText(url)

  const cheats = []

  let currentIndex = 0
  let currentKey

  for (const token of parseINI(source)) {
    if (token.type === "key") {
      currentKey = token.buffer === "cheats" ? undefined : token.buffer
      if (currentKey) {
        currentKey = currentKey.replace("cheat", "")
        currentIndex = Number.parseInt(currentKey)
        currentKey = currentKey.replace(/\d+_*/, "")
      }
    } else if (currentKey && token.type === "value") {
      cheats[currentIndex] ??= {}
      cheats[currentIndex][currentKey] = JSON.parse(token.buffer)
    }
  }

  return cheats
}

// MARK: Shaders
// -------------

export async function loadShader(url) {
  return desktopRealm.sys42.cursor.wrap(
    "progress",
    { overlay: true },
    async () => {
      let source = await os.fs.readText(url)
      const resourcesURLs = []

      source = source.replaceAll(
        /=\s*"?((.*)\.(glsl|png|jpg))"?\n/g,
        (_, resource) => {
          const pathname = decodeURI(
            new URL(resource, "file:///" + url).pathname,
          )
          const name = getBasename(pathname)
          resourcesURLs.push([pathname, name])
          return `= "${name}"\n`
        },
      )

      const resources = await Promise.all(
        resourcesURLs.map(([path, name]) =>
          os.fs.read(path).then((arrayBuffer) => ({
            name,
            value: new Uint8Array(arrayBuffer),
          })),
        ),
      )

      return {
        shader: { value: source },
        resources,
      }
    },
  )
}

export async function setShader(retroarch = {}) {
  const list = []
  let lastDir
  let group

  for (const item of os.fileIndex.glob("**/*.glslp")) {
    const dir = getStemname(getDirname(item))
    if (lastDir !== dir) {
      group = { tag: "optgroup", label: dir, content: [] }
      list.push(group)
    }
    lastDir = dir
    group.content.push([getStemname(item), item])
  }

  const res = await form(
    [
      {
        tag: "select",
        name: "shader",
        aria: { label: "Choose Shader" },
        value: retroarch.config?.shader,
        size: 16,
        content: [["None", ""], ...list],
        on: {
          input: async (e, target) => {
            console.log(target.value)
            retroarch.applyShader(
              target.value //
                ? await loadShader(target.value)
                : undefined,
            )
          },
        },
      },
    ],
    {
      label: `Shader - ${retroarch.name}`,
      picto: retroarch.app?.getIcon("16x16"),
      // resizable: true,
      signal: retroarch.signal,
    },
  )

  return res
}

// MARK: RetroArch
// ---------------

export class RetroArch extends Emitter {
  constructor(app, options = {}) {
    super()

    this.ready = defer()

    this.app = app
    this.name = options.name
    this.signal = options.signal
    this.shell = options.shell
    this.canvas = options.canvas ?? document.querySelector("canvas")
    this.width = this.canvas.width
    this.height = this.canvas.height

    this.core = GENERIC_SYSTEMS[options.core] ?? options.core

    this.rom = options.rom
    this.isURL = typeof this.rom === "string"
    this.fileName = this.isURL
      ? getBasename(this.rom)
      : (this.rom?.name ?? "unknown")

    for (const [reg, val] of ROM_OPTIONS) {
      if (this.fileName.match(reg)) {
        options = { ...options, ...val }
        break
      }
    }

    this.coreURL = new URL(
      `./cores/${this.core}${window.crossOriginIsolated ? "-thread" : ""}-wasm/`,
      import.meta.url,
    )

    this.coreFiles = {}
    this.biosFiles = []
    this.coreConfigPlan = []
    this.quickSaveSlot = 1

    this.useArchive = false

    this.init(options)
  }

  async initConfig(options) {
    this.config = await this.app.initState({
      core: this.core,
      coreConfig: {},

      rewindEnabled: options.rewindEnabled ?? true,
      audioLatency: options.audioLatency ?? 128, // 64
      aspectRatio: options.aspectRatio,
      aspectRatioIndex: options.aspectRatioIndex,

      keyboardEnabled: options.keyboardEnabled,
      mouseEnabled:
        options.mouseEnabled ?? //
        MOUSE_ENABLED.has(this.core),
      fixedGeometry:
        options.fixedGeometry ?? //
        FIXED_GEOMETRY[this.core],
      useSetGeometry:
        options.useSetGeometry ?? //
        USE_SET_GEOMETRY.has(this.core),
      preventWidescreen:
        options.preventWidescreen ?? //
        PREVENT_WIDESCREEN.has(this.core),
      rotateOnNegativeRatio:
        options.rotateOnNegativeRatio ??
        ROTATE_ON_NEGATIVE_RATIO.has(this.core),

      shader: options.shader,

      controls: options.controls ?? DEFAULT_CONTROLLERS,
    })

    this.romConfig = {
      state: options.state,
      save: options.save,
      cheats: [],
    }

    this.controls = normalizeControls(this.config.controls)

    this.debug = options.debug ?? false

    const bios = options.bios ?? BIOS[this.core] ?? this.core
    if (bios) {
      const biosBase = new URL(`./bios/${bios}/`, import.meta.url)
      if (os.fileIndex.has(biosBase.pathname)) {
        for (let path of Object.keys(os.fileIndex.get(biosBase.pathname))) {
          path = new URL(path, biosBase).pathname
          const fileName = getBasename(path)
          this.biosFiles.push(
            os.fs.read(path).then((data) => ({ fileName, data })),
          )
        }
      }
    }

    if (os.fileIndex.isDir(this.coreURL.pathname)) {
      for (const path of os.fileIndex.readDir(this.coreURL.pathname)) {
        this.coreFiles[path] = new URL(path, this.coreURL).pathname
      }
    } else {
      const archivePath = this.coreURL.pathname.slice(0, -1) + ".data"
      if (os.fileIndex.isFile(archivePath)) {
        this.useArchive = true
        for (const item of await sevenZip.extract(archivePath)) {
          this.coreFiles[item.name] = URL.createObjectURL(item.file)
        }
      } else {
        throw new Error(`Unknown RetroArch core: ${this.core}`)
      }
    }

    for (const path of Object.keys(this.coreFiles)) {
      if (path === "core.json") {
        this.coreConfigReady = loadJSON(this.coreFiles[path]).then((json) => {
          const { settings, save } = json

          this.saveExtension = CORE_SAVE[this.core] ?? save ?? "srm"

          const coreConfig = {
            ...CORE_CONFIGS[this.core],
            ...settings,
            ...options.coreOptions,
          }

          for (const [key, val] of Object.entries(coreConfig)) {
            this.config.coreConfig[key] ??= val
          }
        })
      } else if (path.endsWith(".js") && !path.endsWith(".worker.js")) {
        this.script = loadScript(this.coreFiles[path], { async: false })
      }
    }

    if (options.cheatFile) {
      try {
        const cheats = await parseCheatFile(options.cheatFile)
        if (Array.isArray(cheats)) {
          this.romConfig.cheats = cheats
        }
      } catch (err) {
        os.toast(err, { label: "Error loading cheat file" })
      }
    }

    if (options.cheats) {
      if (Array.isArray(options.cheats)) {
        for (const item of options.cheats) {
          if (typeof item === "string") {
            this.romConfig.cheats.push({ enable: true, desc: "", code: item })
          } else if (typeof item?.code === "string") {
            let { desc, enable, code } = item
            enable ??= true
            desc ??= ""
            this.romConfig.cheats.push({ enable, desc, code })
          }
        }
      }
    }

    if (options.cheat) {
      if (typeof options.cheat === "string") {
        this.romConfig.cheats.push({
          enable: true,
          desc: "",
          code: options.cheat,
        })
      }
    }

    this.detectGeometry = this.config.fixedGeometry
      ? noop
      : this.config.useSetGeometry
        ? (msg) => msg.includes("SET_GEOMETRY:")
        : (msg) => msg.includes("Geometry:") || msg.includes("SET_GEOMETRY:")
  }

  async initCore() {
    let debounceId
    let stateCapacityInsufficientLogged

    // @ts-ignore
    const Module = await window.EJS_Runtime({
      // totalDependencies: 0,
      // monitorRunDependencies: () => {},
      // onRuntimeInitialized: null,
      // arguments: [],
      // preRun: [],
      // postRun: [],
      // callbacks: {},
      noInitialRun: true,
      canvas: this.canvas,
      parent: this.canvas.parentElement,
      print: (msg) => {
        if (this.shell) this.shell.stdout.writeln(msg)
        if (this.debug) console.log(msg)
      },
      printErr: (msg) => {
        if (msg === "[ERROR] State capacity insufficient") {
          console.log("--- State capacity insufficient ---")
          if (stateCapacityInsufficientLogged) return
          stateCapacityInsufficientLogged = true
        }

        if (this.shell) this.shell.stderr.writeln(msg)
        if (this.debug) console.log(msg)

        const indexOf = msg.indexOf("game's full name is ")
        if (indexOf > 0) {
          this.setFullName(msg.slice(indexOf + 20).trim())
        }

        if (this.detectGeometry(msg)) {
          const { width, height } = parseGeometry(msg, this.config)
          clearTimeout(debounceId)
          debounceId = setTimeout(() => {
            this.setNativeSize(width, height)
          }, 200)
        }
      },
      locateFile: (fileName) => {
        if (this.debug) console.log(fileName)
        if (fileName in this.coreFiles) return this.coreFiles[fileName]
      },
    })

    this.Module = Module
    this.FS = Module.FS
    this.fs = new EmscriptenFS(Module.FS)

    // Bypass Emscripten ResizeObserver
    // --------------------------------

    // eslint-disable-next-line unicorn/no-this-assignment
    const that = this
    const OriginalResizeObserver = window.ResizeObserver
    window.ResizeObserver = class ResizeObserver extends (
      OriginalResizeObserver
    ) {
      constructor(fn) {
        if (fn.toString().includes("GROWABLE_HEAP_F64")) {
          that.forceCanvasSize = fn
          that.setCanvasSize(that.canvas.width, that.canvas.height)
          super(noop)
        } else {
          super(fn)
        }
      }
    }
    window.addEventListener(
      "resize",
      (e) => e.stopImmediatePropagation(),
      false,
    )

    // Wrappers
    // --------

    // prettier-ignore
    this.functions = {
      restart: Module.cwrap("system_restart", "", []),
      saveStateInfo: Module.cwrap("save_state_info", "string", []),
      loadState: Module.cwrap("load_state", "number", ["string", "number"]),
      screenshot: Module.cwrap("cmd_take_screenshot", "", []),
      simulateInput: Module.cwrap("simulate_input", "null", ["number", "number", "number"]),
      toggleMainLoop: Module.cwrap("toggleMainLoop", "null", ["number"]),
      getCoreOptions: Module.cwrap("get_core_options", "string", []),
      setVariable: Module.cwrap("ejs_set_variable", "null", ["string", "string"]),
      setCheat: Module.cwrap("set_cheat", "null", ["number", "number", "string"]),
      resetCheat: Module.cwrap("reset_cheat", "null", []),
      toggleShader: Module.cwrap("shader_enable", "null", ["number"]),
      getDiskCount: Module.cwrap("get_disk_count", "number", []),
      getCurrentDisk: Module.cwrap("get_current_disk", "number", []),
      setCurrentDisk: Module.cwrap("set_current_disk", "null", ["number"]),
      getSaveFilePath: Module.cwrap("save_file_path", "string", []),
      saveSaveFiles: Module.cwrap("cmd_savefiles", "", []),
      supportsStates: Module.cwrap("supports_states", "number", []),
      loadSaveFiles: Module.cwrap("refresh_save_files", "null", []),
      toggleFastForward: Module.cwrap("toggle_fastforward", "null", ["number"]),
      setFastForwardRatio: Module.cwrap("set_ff_ratio", "null", ["number"]),
      toggleRewind: Module.cwrap("toggle_rewind", "null", ["number"]),
      setRewindGranularity: Module.cwrap("set_rewind_granularity", "null", ["number"]),
      toggleSlowMotion: Module.cwrap("toggle_slow_motion", "null", ["number"]),
      setSlowMotionRatio: Module.cwrap("set_sm_ratio", "null", ["number"]),
      getFrameNum: Module.cwrap("get_current_frame_count", "number", [""]),
      setVSync: Module.cwrap("set_vsync", "null", ["number"]),
      setVideoRoation: Module.cwrap("set_video_rotation", "null", ["number"]),
      setKeyboardEnabled: Module.cwrap("ejs_set_keyboard_enabled", "null", ["number"])
      // main
      // malloc
      // cmd_save_state
      // ejs_set_keyboard_enabled
    }

    const aspectRatio = screen.availWidth / screen.availHeight

    this.fs.writeDir("/shader")
    this.fs.writeDir("/data/saves")
    this.fs.write(
      "/home/web_user/.config/retroarch/retroarch.cfg",
      `\
# video_font_enable = false
# autosave_interval = 0
screenshot_directory = "/"
savefile_directory = "/data/saves"
video_gpu_screenshot = false
audio_latency = ${this.config.audioLatency}
video_aspect_ratio = ${this.config.aspectRatio ?? aspectRatio}
aspect_ratio_index = ${this.config.aspectRatioIndex ?? (this.config.aspectRatio ? 20 : 21)}
video_scale_integer = false
video_scale = 1.0
video_vsync = true
video_smooth = false
fastforward_ratio = 3.0
slowmotion_ratio = 3.0
# input_libretro_device_p1 = 2
${
  this.config.rewindEnabled
    ? `\
rewind_enable = true
# rewind_buffer_size = 10
rewind_granularity = 1`
    : ""
}`,
    )

    this.FS.mount(
      this.FS.filesystems.IDBFS,
      { autoPersist: true },
      "/data/saves",
    )

    await this.coreConfigReady
    const coreConfigEntries = Object.entries(this.config.coreConfig)
    if (coreConfigEntries.length > 0) {
      let output = ""

      for (const [key, val] of coreConfigEntries) {
        output += `${key} = "${val}"\n`
      }

      this.fs.write(
        "/home/web_user/.config/retroarch/retroarch-core-options.cfg",
        output,
      )
    }

    if (this.useArchive) {
      for (const url of Object.values(this.coreFiles)) {
        URL.revokeObjectURL(url)
      }
    }

    return Module
  }

  parseCoreOptions() {
    let coreOpts
    try {
      coreOpts = this.functions.getCoreOptions()
    } catch {}

    if (!coreOpts) return

    const prefixReg = new RegExp(`^${this.core}\\s*`)

    for (const line of coreOpts.split("\n")) {
      const keyVal = line.split("; ")
      const availableOptions = keyVal[1].split("|")

      availableOptions.slice(1, -1)
      if (availableOptions.length === 1) continue

      const nameAndValue = keyVal[0].split("|")
      let [name, value] = nameAndValue

      if (nameAndValue.length > 1 === false) {
        value = availableOptions[0].replace("(Default) ", "")
      }

      const label = this.i18n(
        nameAndValue[0].replaceAll("_", " ").replace(prefixReg, ""),
      )

      const content = []
      for (let i = 0; i < availableOptions.length; i++) {
        content.push([availableOptions[i], this.i18n(availableOptions[i])])
      }

      this.config.coreConfig[name] ??= value

      this.coreConfigPlan.push({ tag: "select", label, name, content })
    }

    // this.setCoreSettings()
  }

  async setCoreSettings() {
    const modified = []

    const res = await form(this.coreConfigPlan, {
      label: `Core Settings - ${this.name}`,
      picto: this.app.getIcon("16x16"),
      data: this.config.coreConfig,
      signal: this.signal,
      on: {
        input: ({ target }) => {
          modified.push([target.name, target.value])
          this.functions.setVariable(target.name, target.value)
        },
      },
    })

    for (const [name, value] of modified) {
      if (res) this.config.coreConfig[name] = value
      else this.functions.setVariable(name, this.config.coreConfig[name])
    }
  }

  async init(options) {
    await this.initConfig(options)

    const [rom, biosFiles] = await Promise.all([
      this.isURL ? os.fs.read(this.rom) : this.rom?.arrayBuffer(),
      Promise.all(this.biosFiles),
      this.script.then(() => this.initCore()),
    ])

    for (const { fileName, data } of biosFiles) {
      this.FS.writeFile(fileName, new Uint8Array(data))
    }

    this.FS.writeFile(this.fileName, new Uint8Array(rom))
    this.Module.callMain(["-v", this.fileName])
    this.parseCoreOptions()

    if (this.config.fixedGeometry) {
      this.setNativeSize(...this.config.fixedGeometry)
    }

    if (this.config.shader) {
      this.applyShader(this.config.shader)
    }

    if (this.romConfig.save) {
      await this.setSaveFile(this.romConfig.save, { init: true })
    }

    if (this.romConfig.state) {
      this.setState(this.romConfig.state)
    }

    if (this.romConfig.cheats.length > 0) {
      this.applyCheats(this.romConfig.cheats)
    }

    // this.applyCheats([
    //   // { code: "CEC-30E-C45" },
    // ])

    // MARK: Keyboard
    // --------------

    if (this.config.keyboardEnabled) {
      this.functions.setKeyboardEnabled(true)
    } else {
      this.functions.setKeyboardEnabled(false)

      this.canvas.addEventListener("keydown", (e) => {
        if (e.code === "F12") return
        e.preventDefault()
        if (e.repeat) return

        if (e.code in this.controls.keyboard) {
          const { player, index, value } = this.controls.keyboard[e.code]
          this.simulateInput(player, index, value)
        }
      })
      this.canvas.addEventListener("keyup", (e) => {
        if (e.code in this.controls.keyboard) {
          const { player, index } = this.controls.keyboard[e.code]
          this.simulateInput(player, index, 0)
        }
      })
    }

    // MARK: Gamepads
    // --------------
    gamepads.on("change", ({ gamepadIndex, label, value }) => {
      const code = `${gamepadIndex}_${label}`
      if (code in this.controls.gamepad) {
        const { player, index, isStick, opposite } = this.controls.gamepad[code]
        if (isStick) {
          if (value > 0) {
            this.simulateInput(player, index, 0x7f_ff * value)
            this.simulateInput(player, opposite, 0)
          } else {
            this.simulateInput(player, opposite, 0x7f_ff * value)
            this.simulateInput(player, index, 0)
          }
        } else {
          this.simulateInput(player, index, value === 0 ? 0 : 1)
        }
      }
    })

    // MARK: Mouse
    // -----------
    if (this.config.mouseEnabled) {
      this.canvas.addEventListener("click", () => {
        if (document.pointerLockElement === this.canvas) return
        this.canvas
          .requestPointerLock({
            unadjustedMovement: true,
          })
          .catch(() => {
            this.canvas.requestPointerLock()
          })
      })
    }

    this.ready.resolve()
  }

  simulateInput(player, index, value) {
    if (SPECIAL_KEYS.has(index)) {
      if (value === 1) {
        if (index === 24) {
          const slot = this.quickSaveSlot
          this.quickSave(slot)
          this.displayMessage(`${this.i18n("SAVED STATE TO SLOT")} ${slot}`)
        }

        if (index === 25) {
          const slot = this.quickSaveSlot
          this.quickLoad(slot)
          this.displayMessage(`${this.i18n("LOADED STATE FROM SLOT")} ${slot}`)
        }

        if (index === 26) {
          this.quickSaveSlot++
          if (this.quickSaveSlot > 9) this.quickSaveSlot = 1
          const slot = this.quickSaveSlot
          this.displayMessage(`${this.i18n("SET SAVE STATE SLOT TO")} ${slot}`)
        }

        if (index === 30) this.togglePause()
      }

      if (index === 27) this.toggleFastForward(value)
      if (index === 29) this.toggleSlowMotion(value)
      if (index === 28) this.toggleRewind(value)

      return
    }

    this.functions.simulateInput(player, index, value)
  }

  displayMessage(msg) {
    this.emit("message", msg)
  }

  i18n(str) {
    return str
  }

  setNativeSize(width, height) {
    if (this.width === width && this.height === height) return

    this.width = width
    this.height = height

    this.setCanvasSize(width, height)
    this.emit("nativeSize", { width, height })
  }

  setFullName(fullName) {
    this.fullName = fullName
    this.emit("fullName", fullName)
  }

  paused = false
  togglePause(force = !this.paused) {
    this.paused = force
    this.functions.toggleMainLoop(this.paused ? 0 : 1)
    this.emit("togglePause", this.paused)
  }

  isSlowMotion = false
  toggleSlowMotion(value = !this.isSlowMotion) {
    if (this.paused) this.togglePause(false)
    this.isSlowMotion = value
    this.functions.toggleSlowMotion(value)
  }

  isFastForward = false
  toggleFastForward(value = !this.isFastForward) {
    if (this.paused) this.togglePause(false)
    this.isFastForward = value
    this.functions.toggleFastForward(value)
  }

  isRewind = false
  toggleRewind(value = !this.isRewind) {
    if (this.config.rewindEnabled) {
      if (this.paused) this.togglePause(false)
      this.isRewind = value
      this.functions.toggleRewind(value)
    }
  }

  restart() {
    this.functions.restart()
  }

  // MARK: Shader
  // ------------

  #unwatchResize
  #shaderActive = false
  async applyShader(name) {
    try {
      this.FS.unlink("/shader/shader.glslp")
    } catch {}

    if (!name) {
      this.#shaderActive = false
      this.#unwatchResize?.()
      this.setCanvasSize(this.width, this.height)
      this.functions.toggleShader(0)
      return
    }

    const glslp = typeof name === "string" ? await loadShader(name) : name

    this.#shaderActive = true

    this.FS.writeFile(
      "/shader/shader.glslp",
      glslp.shader.type === "base64"
        ? atob(glslp.shader.value)
        : glslp.shader.value,
    )

    for (const { name, value, type } of glslp.resources) {
      this.FS.writeFile(
        "/shader/" + name,
        type === "base64" ? atob(value) : value,
      )
    }

    // this.#unwatchResize = watchResize(
    //   this.canvas.parentElement,
    //   { debounce: true, firstCall: true },
    //   ({ width, height }) => {
    //     // this.functions.toggleShader(0)
    //     this.setCanvasSize(width, height)
    //     // this.functions.toggleShader(1)
    //   },
    // )

    const { width, height } = this.canvas.parentElement.getBoundingClientRect()
    this.setCanvasSize(width, height)
    this.functions.toggleShader(1)

    let timerID
    this.#unwatchResize = watchResize(
      this.canvas.parentElement,
      ({ width, height }) => {
        this.functions.toggleShader(0)
        clearTimeout(timerID)
        timerID = setTimeout(() => {
          this.setCanvasSize(width, height)
          timerID = setTimeout(() => {
            this.functions.toggleShader(1)
          }, 100)
        }, 100)
      },
    )
  }

  async setShader() {
    const res = await setShader(this)

    if (res) {
      console.log(res.shader)
      this.config.shader = res.shader
    } else {
      this.applyShader(this.config.shader)
    }
  }

  forceCanvasSize
  setCanvasSize(width, height) {
    this.Module.setCanvasSize(width, height)
    this.forceCanvasSize?.([
      {
        target: this.Module.canvas,
        devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
      },
    ])
  }

  // MARK: State
  // -----------

  getState() {
    const state = this.functions.saveStateInfo().split("|")
    if (state[2] !== "1") {
      console.error(state[0])
      throw new Error(state[0])
    }
    const size = parseInt(state[0])
    const dataStart = parseInt(state[1])
    const data = this.Module.HEAPU8.subarray(dataStart, dataStart + size)
    return new Uint8Array(data)
  }
  async setState(urlOrBuf = this.romConfig.state) {
    let uint8Array
    if (typeof urlOrBuf === "string") {
      try {
        uint8Array = new Uint8Array(await os.fs.read(urlOrBuf))
      } catch {
        this.emit("notif", {
          picto: "error",
          label: "State file not found",
          message: `%md [${shortenFilename(urlOrBuf)}](${encodeURI(urlOrBuf)})`,
        })
        return
      }
    } else {
      uint8Array = urlOrBuf
    }

    try {
      this.FS.unlink("game.state")
    } catch {}

    this.FS.writeFile("/game.state", uint8Array)

    this.functions.loadState("game.state", 0)
    setTimeout(() => {
      try {
        this.FS.unlink("game.state")
      } catch {}
    }, 5000)
  }

  async quickSave(slot = 1) {
    const name = slot + "-quick.state"
    try {
      this.FS.unlink(name)
    } catch {}

    const data = await this.getState()
    this.FS.writeFile("/" + name, data)
  }
  quickLoad(slot = 1) {
    const name = slot + "-quick.state"
    this.functions.loadState(name, 0)
  }

  // MARK: Save File
  // ---------------

  getSaveFile() {
    this.functions.saveSaveFiles()
    const path = this.functions.getSaveFilePath()
    const { exists } = this.FS.analyzePath(path)
    if (!exists) return
    return this.FS.readFile(path)
  }
  async setSaveFile(urlOrBuf, options) {
    let uint8Array
    if (typeof urlOrBuf === "string") {
      try {
        uint8Array = new Uint8Array(await os.fs.read(urlOrBuf))
      } catch {
        this.emit("notif", {
          picto: "error",
          label: "Save file not found",
          message: `%md [${shortenFilename(urlOrBuf)}](${encodeURI(urlOrBuf)})`,
        })
        return
      }
    } else {
      uint8Array = urlOrBuf
    }

    const path = this.functions.getSaveFilePath()
    this.fs.write(path, uint8Array)
    this.functions.loadSaveFiles()
    if (options?.init !== true) this.functions.restart()
  }

  // MARK: Screenshot
  // ----------------

  async screenshot() {
    this.functions.screenshot()

    while (true) {
      try {
        this.FS.stat("/screenshot.png")
        return this.FS.readFile("/screenshot.png")
      } catch {}

      await os.sleep(50)
    }
  }

  // MARK: Cheats
  // ------------

  applyCheats(cheats = this.romConfig.cheats) {
    this.functions.resetCheat()
    for (let i = 0, l = cheats.length; i < l; i++) {
      const { enable, code } = cheats[i]
      if (enable) this.functions.setCheat(i, 1, code)
    }
  }

  async #editCheat(idx) {
    const res = await form(
      [
        {
          tag: "textarea",
          name: "code",
          rows: 3,
          cols: 38,
          enterKeyHint: "done",
        },
        {
          tag: "textarea",
          name: "desc",
          rows: 3,
          cols: 38,
          enterKeyHint: "done",
        },
        {
          tag: "checkbox",
          name: "restart",
          label: "Restart rom",
          // checked: true,
        },
      ],
      {
        label: `Add Cheat - ${this.name}`,
        data: this.romConfig.cheats[idx],
        piled: true,
        // modal: true,
        picto: this.app.getIcon("16x16"),
        signal: this.signal,
      },
    )

    if (res) {
      const { restart } = res
      delete res.restart

      if (idx) {
        Object.assign(this.romConfig.cheats[idx], res)
      } else {
        res.enable = true
        idx = this.romConfig.cheats.push(res) - 1
      }

      // const { enable, code } = this.romConfig.cheats[idx]
      // this.functions.setCheat(idx, enable, code)
      this.applyCheats()

      if (restart) this.restart()

      if (this.cheatGUI) {
        const { scrollTop } = this.cheatGUI
        this.cheatGUI.replaceChildren(
          // TODO: Fix render ui-picto inside element from another realm
          desktopRealm.sys42.render(this.#createCheatsPlan()),
        )
        this.cheatGUI.scrollTop = scrollTop
        const item = this.cheatGUI.children[idx]
        if (item) {
          if (item.scrollIntoViewIfNeeded) item.scrollIntoViewIfNeeded()
          else item.scrollIntoView({ center: true })
          item.firstChild?.focus({ preventScroll: true })
        }
      }

      return idx
    }
  }

  #createCheatsPlan() {
    const plan = []

    for (let i = 0, l = this.romConfig.cheats.length; i < l; i++) {
      const { enable, code, desc } = this.romConfig.cheats[i]
      if (!code) {
        const div = document.createElement("div")
        div.style.display = "none"
        plan.push(div)
        continue
      }

      let lineEl

      plan.push({
        tag: ".cols",
        content: [
          {
            tag: "button",
            picto: "pen",
            action: () => this.#editCheat(i),
          },
          {
            tag: "checkbox",
            checked: enable,
            label: {
              class: "truncate-false",
              content: desc || code,
            },
            action: (e, target) => {
              this.romConfig.cheats[i].enable = target.checked
              // this.functions.setCheat(i, target.checked, code)
              this.applyCheats()
            },
          },
          {
            tag: "button.delete-cheat",
            picto: "trash",
            action: () => {
              this.romConfig.cheats.splice(i, 1)
              // this.functions.setCheat(i, false, code)
              this.applyCheats()
              lineEl.nextElementSibling?.querySelector(".delete-cheat")?.focus()
              lineEl.remove()
            },
          },
        ],
        created: (el) => {
          lineEl = el
        },
      })
    }

    return plan
  }

  async setCheats() {
    const backup = merge([], this.romConfig.cheats)

    const res = await form(
      [
        {
          tag: "em",
          content: "Note that some cheats require a restart",
        },
        {
          tag: ".inset.grow.flex-rows.striped.scroll-y.ma-y-xs",
          content: this.#createCheatsPlan(),
          created: (el) => {
            this.cheatGUI = el
          },
        },
        {
          tag: "button.shrink",
          picto: "plus",
          content: "Add Cheat…",
          action: async () => this.#editCheat(),
        },
      ],
      {
        label: `Cheats - ${this.name}`,
        picto: this.app.getIcon("16x16"),
        signal: this.signal,
        maximizable: true,
        resizable: true,
        height: "18lh",
        width: "65ch",
        piled: true,
      },
    )

    if (res) {
      // console.log("--------------", res)
    } else {
      this.romConfig.cheats = backup
      this.applyCheats()
    }

    this.cheatGUI = undefined
  }

  // MARK: Controls
  // --------------
  async setControls() {
    const res = await setControls(this.name, this.config.controls)
    if (!res) return
    this.config.controls = res
    this.controls = normalizeControls(res)
  }
}

export async function createRetroArch(options) {
  const instance = new RetroArch(options)
  await instance.ready
  return instance
}
