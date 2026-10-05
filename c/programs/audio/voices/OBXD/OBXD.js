// OBXD WAM Controller
// Jari Kleimola 2017-2018 (jari@webaudiomodules.org)

import { WAMController } from "./libs/WamController.js"

export class OBXD extends WAMController {
  static title = "webOBXD"

  constructor(actx, options) {
    options = options || {}
    options.numberOfInputs = 0
    options.numberOfOutputs = 1
    options.outputChannelCount = [2]
    // options.ioConfiguration = { outputs:[1] };

    super(actx, "OBXD", options)
    this.patches = []
    this.bank = []
    this.ipatch = 0
  }

  // -- scripts need to be loaded first, and in order
  //
  static async importScripts(actx) {
    await actx.audioWorklet.addModule("worklet/obxd.wasm.js")
    await actx.audioWorklet.addModule("worklet/obxd.emsc.js")
    await actx.audioWorklet.addModule("libs/wam-processor.js")
    await actx.audioWorklet.addModule("worklet/obxd-awp.js")
  }

  // -- gui is implemented as a web component
  // -- and currently imported using HTML imports
  // -- skin is a relative folder name, containing pngs
  //
  loadGUI(skin) {
    return new Promise((resolve) => {
      const link = document.createElement("link")
      link.rel = "import"
      link.href = "obxd.html"
      link.onload = () => {
        this._gui = document.createElement("wam-obxd")
        this._gui.plug = this
        this._gui.skin = skin || "skin"
        resolve(this._gui)
      }

      document.head.append(link)
    })
  }

  // -- url gives the filename to an fxb format bank of presets
  //
  loadBank(url) {
    return new Promise((resolve) => {
      fetch(url).then((resp) => {
        resp.arrayBuffer().then((data) => {
          this.patches = []
          this.bank = []
          this.bank.url = url
          this.bank.name = url.slice(url.lastIndexOf("/") + 1)
          const arr = new Uint8Array(data)

          const s = new TextDecoder("utf-8").decode(arr.subarray(168, -1))

          const programs = new DOMParser()
            .parseFromString(s, "text/html")
            .querySelectorAll("program")

          for (const program of programs) {
            this.patches.push(program.getAttribute("programname"))
            program.removeAttribute("programname")
            const patch = []
            for (let i = 0, l = program.attributes.length; i < l; i++) {
              const attrName = String(i)
              if (program.hasAttribute(attrName)) {
                patch.push(Number.parseFloat(program.getAttribute(attrName)))
              }
            }

            this.bank.push(patch)
          }

          resolve(this.patches)
        })
      })
    })
  }

  // -- select patch from current bank
  //
  selectPatch(ipatch) {
    const patch = this.bank[ipatch]
    if (patch) {
      this.ipatch = ipatch
      this.setPatch(patch)
    }
  }

  // -- set patch from data
  //
  setPatch(patch) {
    this.patch = patch
    super.setPatch(Float32Array.from(patch).buffer)
    if (this._gui) this._gui.setPatch(patch)
  }

  // -- get current state
  //
  getState() {
    const state = { bank: this.bank.url, patchIndex: this.ipatch }
    state.data = this.patch
    const blob = new Blob([JSON.stringify(state)], { type: "application/json" })
    return Promise.resolve(blob)
  }

  // -- restore current state
  //
  setState(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener("loadend", async () => {
        const state = JSON.parse(reader.result)
        await this.loadBank(state.bank)
        this.selectPatch(state.patchIndex)
        this.setPatch(state.data)
        resolve()
      })
      if (blob.type === "application/json") {
        reader.readAsText(blob)
      } else reject()
    })
  }

  // -- gui calls this method when tweaking a knob/toggle
  // -- update current patch state, and pass to DSP
  //
  setParam(key, value) {
    this.patch[key] = value
    super.setParam(key, value)
  }
}
