/* eslint-disable max-depth */
/* eslint-disable complexity */

import { noop } from "../../lib/type/function/noop.js"

class BitmapGlyph {
  char = ""
  code = 0
  bytes = []
  bitmap = []
  scalableWidthX = 0
  scalableWidthY = 0
  deviceWidthX = 0
  deviceWidthY = 0
  boundingBox = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }
  constructor(name) {
    this.name = name
  }
}

export class BDF {
  meta = {}
  glyphs = {}
  #currentChar
  #declarationStack = []

  decode(source) {
    this.decodeLines(source.split(/\r?\n/))
  }

  decodeLines(lines, cb = noop) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const data = line.split(/\s+/)
      const declaration = data[0]

      switch (declaration) {
        case "STARTFONT":
          this.#declarationStack.push(declaration)
          this.meta.version = data[1]
          break
        case "FONT":
          this.meta.name = line.slice(data[0].length).trim()
          break
        case "SIZE":
          this.meta.size = {
            points: Number(data[1]),
            resolutionX: Number(data[2]),
            resolutionY: Number(data[3]),
          }
          break
        case "FONTBOUNDINGBOX":
          this.meta.boundingBox = {
            width: Number(data[1]),
            height: Number(data[2]),
            x: Number(data[3]),
            y: Number(data[4]),
          }
          break
        case "STARTPROPERTIES":
          this.#declarationStack.push(declaration)
          this.meta.properties = {}
          break
        case "FONT_DESCENT":
          this.meta.properties.fontDescent = Number(data[1])
          break
        case "FONT_ASCENT":
          this.meta.properties.fontAscent = Number(data[1])
          break
        case "DEFAULT_CHAR":
          this.meta.properties.defaultChar = Number(data[1])
          break
        case "ENDPROPERTIES":
          this.#declarationStack.pop()
          break
        case "CHARS":
          this.meta.totalChars = Number(data[1])
          break
        case "STARTCHAR":
          this.#declarationStack.push(declaration)
          this.#currentChar = new BitmapGlyph(data[1])
          break
        case "ENCODING":
          this.#currentChar.code = Number(data[1])
          this.#currentChar.char = String.fromCodePoint(Number(data[1]))
          break
        case "SWIDTH":
          this.#currentChar.scalableWidthX = Number(data[1])
          this.#currentChar.scalableWidthY = Number(data[2])
          break
        case "DWIDTH":
          this.#currentChar.deviceWidthX = Number(data[1])
          this.#currentChar.deviceWidthY = Number(data[2])
          break
        case "BBX":
          this.#currentChar.boundingBox.y = Number(data[4])
          this.#currentChar.boundingBox.x = Number(data[3])
          this.#currentChar.boundingBox.width = Number(data[1])
          this.#currentChar.boundingBox.height = Number(data[2])
          break
        // case "BITMAP":
        //   for (let row = 0; row < this.meta.size.points; row++, i++) {
        //     const byte = Number.parseInt(lines[i + 1], 16)
        //     this.#currentChar.bytes.push(byte)
        //     this.#currentChar.bitmap[row] = []
        //     for (let bit = 7; bit >= 0; bit--) {
        //       this.#currentChar.bitmap[row][7 - bit] = byte & (1 << bit) ? 1 : 0
        //     }
        //   }

        //   break
        case "BITMAP": {
          const bytesPerLine = Math.ceil(
            this.#currentChar.boundingBox.width / 8,
          )

          for (
            let row = 0;
            row < this.#currentChar.boundingBox.height;
            row++, i++
          ) {
            const bytesLine = lines[i + 1]
            this.#currentChar.bitmap[row] = []
            for (let byteIndex = 0; byteIndex < bytesPerLine; byteIndex++) {
              const byteString = bytesLine.slice(
                byteIndex * 2,
                byteIndex * 2 + 2,
              )
              const byte = Number.parseInt(byteString, 16)
              this.#currentChar.bytes.push(byte)
              for (let bit = 7; bit >= 0; bit--) {
                this.#currentChar.bitmap[row][byteIndex * 8 + (7 - bit)] =
                  byte & (1 << bit) ? 1 : 0
              }
            }
          }

          break
        }

        case "ENDCHAR":
          this.#declarationStack.pop()
          this.glyphs[this.#currentChar.code] = this.#currentChar
          cb(this.#currentChar)
          this.#currentChar = null
          break
        case "ENDFONT":
          this.#declarationStack.pop()
          break

        default:
      }
    }
  }
}
