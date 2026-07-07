import { uid } from "../../api/uid.js"

let id = 0

export class Scene {
  constructor(config) {
    this.id = id++
    this.type = config?.type ?? "2d"
    this.name = config?.name ?? uid()

    /** @type {HTMLCanvasElement} */
    this.canvas = config?.canvas ?? document.createElement("canvas")

    this.canvas.width =
      config?.width ??
      (this.canvas.clientWidth || (globalThis.window?.innerWidth ?? 100))

    this.canvas.height =
      config?.height ??
      (this.canvas.clientHeight || (globalThis.window?.innerHeight ?? 100))

    this.context = this.canvas.getContext(this.type, {
      alpha: config?.alpha ?? true,
      willReadFrequently: config?.willReadFrequently,
    })

    if (!config) return

    for (const [key, val] of Object.entries(config)) {
      if (key in this.context) this.context[key] = val
    }
  }

  get width() {
    return this.canvas.width
  }

  get height() {
    return this.canvas.height
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  setSize(width, height) {
    this.canvas.width = width
    this.canvas.height = height
  }

  clear() {
    const { context } = this
    if (this.type === "2d") {
      context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    } else {
      // @ts-ignore
      context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT)
    }
  }

  async getImage(config) {
    const type = config?.type ?? "image/png"
    const img = new Image()
    img.src = this.canvas.toDataURL(type, config?.quality)
    await img.decode()
    return img
  }

  async getFile(config) {
    const type = config?.type ?? "image/png"
    const name = config?.name ?? this.name
    return new Promise((resolve) =>
      this.canvas.toBlob(
        (blob) => resolve(new File([blob], name, { type })),
        type,
        config?.quality,
      ),
    )
  }
}
