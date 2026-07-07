// https://stackoverflow.com/a/16599668/1289275
// https://www.npmjs.com/package/text-dimensions

export class FontMetrics {
  constructor(font = "") {
    if ("OffscreenCanvas" in window && typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(1000, 1000)
      this.ctx = canvas.getContext("2d")
    } else {
      this.canvasEl = document.createElement("canvas")
      document.body.append(this.canvasEl)
      this.ctx = this.canvasEl.getContext("2d")
      this.ctx.canvas.width = 1000
      this.ctx.canvas.height = 1000
    }

    this.font = font
    this.ctx.font = font
  }

  measure(text, font = this.font) {
    this.ctx.font = font

    const {
      width, //
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
    } = this.ctx.measureText(text)

    const height = actualBoundingBoxAscent + actualBoundingBoxDescent

    return {
      width: Math.round(width),
      height: Math.round(height),
    }
  }

  getLines(text, maxWidth, font = this.font) {
    this.ctx.font = font

    const lines = []

    let buffer = ""

    for (const char of text) {
      const tmp = buffer + char

      const { width } = this.ctx.measureText(tmp)

      //
      if (width > maxWidth) {
        const index = Math.max(
          tmp.lastIndexOf(" "), //
          tmp.lastIndexOf("\u200B"),
        )

        let pre
        let post
        if (index > 0) {
          pre = buffer.slice(0, index)
          post = buffer.slice(index) + char
        } else {
          pre = buffer
          post = char
        }

        lines.push(pre)
        buffer = post.trimStart()
      } else {
        buffer += char
      }
    }

    // Prevent line with single char
    if (buffer.trim().length === 1 && lines.length > 0) {
      const prev = lines.at(-1)
      const half = Math.ceil(prev.length / 2)
      const pre = prev.slice(0, half)
      const post = prev.slice(half)
      lines[lines.length - 1] = pre
      buffer = post + buffer
    }

    lines.push(buffer)
    return lines
  }

  async measureAsync(text, font = this.font) {
    await document.fonts.load(font)
    return this.measure(text, font)
  }

  async getLinesAsync(text, maxWidth, font = this.font) {
    await document.fonts.load(font)
    return this.getLines(text, maxWidth, font)
  }

  destroy() {
    this.canvasEl?.remove()
  }
}
