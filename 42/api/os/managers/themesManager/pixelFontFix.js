import { FontMetrics } from "../../../../lib/graphic/typography/FontMetrics.js"
import { untilIdle } from "../../../../lib/timing/untilIdle.js"

/** @import { IconComponent } from "../../../../ui/media/icon.js" */

const fontMetrics = new FontMetrics()

export class PixelFontFix {
  font
  textWidth = 60 // 64
  paused = false

  async renderLines(
    /** @type {HTMLElement} */ el,
    /** @type {IconComponent} */ icon,
  ) {
    if (this.paused) return
    await untilIdle()
    if (icon.signal.aborted) return

    if (!this.font) {
      const style = getComputedStyle(el)

      this.textWidth =
        icon.offsetWidth - Number.parseInt(style.paddingInline) * 2

      this.font = String(style.font)

      if (this.font) {
        await document.fonts.load(this.font)
        if (!this.font) return

        this.textWidth =
          icon.offsetWidth - Number.parseInt(style.paddingInline) * 2
      }

      // console.log(
      //   sys42.themes?.current?.name,
      //   this.textWidth,
      //   icon.offsetWidth,
      //   this.font.slice(0, 100),
      // )
    }

    if (this.textWidth > 1) {
      const text = el.textContent
      el.textContent = ""
      el.classList.toggle("ui-icon__label--pixelfix", true)
      const lines = fontMetrics.getLines(text, this.textWidth, this.font)
      for (const item of lines) {
        const span = document.createElement("span")
        span.textContent = item
        el.append(span, document.createElement("br"))
      }
    }
  }
}

export const pixelFontFix = new PixelFontFix()
