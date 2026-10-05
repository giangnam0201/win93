import { font } from "../load.js"

export default class Font {
  constructor(font, color, bgColor) {
    this.font = font
    this.color = color
    this.bgColor = bgColor
  }

  write(ctx, text, color = this.color, bgColor = this.bgColor) {
    measureEl.style.font = this.font
    measureEl.textContent = text
    let { width, height } = measureEl.getBoundingClientRect()
    width = Math.max(1, width)
    height = Math.max(1, height)
    ctx.canvas.height = height
    ctx.canvas.width = width
    ctx.canvas.height = height
    ctx.font = this.font
    ctx.textBaseline = "alphabetic"
    if (bgColor) {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, width, height)
    }
    ctx.fillStyle = color || "#000"
    ctx.fillText(text, 0, height / 1.15)
  }

  async load() {
    await font(this.font)
  }
}

const contEl = document.createElement("div")
const measureEl = document.createElement("span")
contEl.appendChild(measureEl)
contEl.style.cssText = `
  display: block !important;
  position: absolute !important;`
measureEl.style.cssText = `
  all: initial !important;
  visibility: hidden !important;
  pointer-events: none !important;
  line-height: 1.15 !important;`
document.body.appendChild(contEl)

if (window.hmr) window.hmr.dispose(() => document.body.removeChild(contEl))
