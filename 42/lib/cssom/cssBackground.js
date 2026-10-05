/*!
 * https://github.com/gilmoreorless/css-background-parser
 * Copyright © 2015 Gilmore Davidson under the MIT license: http://gilmoreorless.mit-license.org/
 */

export class BackgroundList extends Array {
  [Symbol.toPrimitive]() {
    return this.join(",\n")
  }

  toString() {
    return this[Symbol.toPrimitive]()
  }
}

export class Background {
  // http://www.w3.org/TR/css3-background/#backgrounds
  color = ""
  image = "none"
  attachment = "scroll"
  clip = "border-box"
  origin = "padding-box"
  position = "0% 0%"
  repeat = "repeat"
  size = "auto"

  constructor(props) {
    Object.assign(this, props)
  }

  [Symbol.toPrimitive]() {
    const list = [
      this.image,
      this.repeat,
      this.attachment,
      this.position + " / " + this.size,
      this.origin,
      this.clip,
    ]
    if (this.color) {
      list.push(this.color)
    }
    return list.join(" ")
  }

  toString() {
    return this[Symbol.toPrimitive]()
  }
}

function parseImages(cssText) {
  const images = []
  const tokens = /[(),]/
  let parens = 0
  let buffer = ""

  if (cssText == null) {
    return images
  }

  while (cssText.length > 0) {
    const match = tokens.exec(cssText)
    if (!match) {
      break
    }
    const char = match[0]
    let ignoreChar = false
    switch (char) {
      case ",":
        if (!parens) {
          images.push(buffer.trim())
          buffer = ""
          ignoreChar = true
        }
        break
      case "(":
        parens++
        break
      case ")":
        parens--
        break
    }

    const index = match.index + 1
    buffer += cssText.slice(0, ignoreChar ? index - 1 : index)
    cssText = cssText.slice(index)
  }

  if (buffer.length > 0 || cssText.length > 0) {
    images.push((buffer + cssText).trim())
  }

  return images
}

// Helper for .map()
const trim = (str) => str.trim()
const parseSimpleList = (cssText = "") => cssText.split(",").map(trim)

export function cssBackground(styleObject) {
  const list = new BackgroundList()

  if (styleObject == null) return list

  const bgImage = parseImages(styleObject.backgroundImage)
  const bgColor = styleObject.backgroundColor
  const bgAttachment = parseSimpleList(styleObject.backgroundAttachment)
  const bgClip = parseSimpleList(styleObject.backgroundClip)
  const bgOrigin = parseSimpleList(styleObject.backgroundOrigin)
  const bgPosition = parseSimpleList(styleObject.backgroundPosition)
  const bgRepeat = parseSimpleList(styleObject.backgroundRepeat)
  const bgSize = parseSimpleList(styleObject.backgroundSize)

  let background
  for (let i = 0, l = bgImage.length; i < l; i++) {
    background = new Background({
      image: bgImage[i],
      attachment: bgAttachment[i % bgAttachment.length],
      clip: bgClip[i % bgClip.length],
      origin: bgOrigin[i % bgOrigin.length],
      position: bgPosition[i % bgPosition.length],
      repeat: bgRepeat[i % bgRepeat.length],
      size: bgSize[i % bgSize.length],
    })
    if (i === l - 1) {
      background.color = bgColor
    }
    list.push(background)
  }

  return list
}
