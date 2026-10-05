import extend from "../extend.js"
import { image } from "../load.js"

export default class Spritesheet {
  constructor(data) {
    extend(this, data)
    this.image = new Image()
    this.image.src = this.src
    this.cache = new Map()
  }

  createRegion(pos) {
    const posKey = String(pos)
    if (this.cache.has(posKey)) return this.cache.get(posKey)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    canvas.height = pos.pop()
    canvas.width = pos.pop()
    ctx.drawImage(this.image, ...pos, pos[2], pos[3])
    this.cache.set(posKey, canvas)
    return canvas
  }

  createLayers(layers, meta = {}) {
    const data = {
      childs: [],
    }
    if (meta) {
      data.meta = {}
      Object.entries(meta).forEach(([key, val]) => {
        data.meta[key] = val.split(" ").map((meta) => {
          if (meta.startsWith("#")) {
            return { type: "anim", value: meta.slice(1) }
          } else if (meta.startsWith("$")) {
            return { type: "global", value: meta.slice(1) }
          } else if (meta.startsWith(">")) {
            return { type: "sfx", value: meta.slice(1) }
          }
          return { type: "meta", value: meta }
        })
      })
    }

    let len
    if (layers[0].frames.length > 1) {
      len = layers[0].frames.length
      data.duration = 0
      data.durations = []
      layers[0].frames.forEach(([duration]) => {
        data.duration += duration
        data.durations.push(duration / 1000)
      })
    }

    layers.reduce((acc, { name, frames }) => {
      let layer
      if (frames.length === 1) {
        layer = { name, canvas: this.createRegion(frames[0][1]) }
      } else {
        layer = { name, frames: [] }
        frames.forEach((f) => {
          if (f) {
            const [, frames] = f
            layer.frames.push(this.createRegion(frames))
          } else {
            layer.frames.push(false)
          }
        })
        if (layer.frames.length < len) layer.frames.length = len
      }
      acc.push(layer)
      return acc
    }, data.childs)
    return data
  }

  createSprite(name, spriteData) {
    if (Array.isArray(spriteData))
      return {
        name,
        canvas: this.createRegion(spriteData),
      }

    const sprite = { name }

    if (spriteData.tags) {
      sprite.tags = {}
      Object.entries(spriteData.tags).forEach(([key, tag]) => {
        const layers = tag.layers ? tag.layers : [{ frames: tag.frames }]
        sprite.tags[key] = this.createLayers(layers, tag.meta)
      })
    } else if (spriteData.layers) {
      Object.assign(sprite, this.createLayers(spriteData.layers))
    }
    return sprite
  }

  init() {
    Object.values(this.sprites).forEach((namespace) => {
      Object.entries(namespace).forEach(([name, spriteData]) => {
        namespace[name] = this.createSprite(name, spriteData)
      })
    })
    return this
  }

  async load() {
    await image(this.image)
    return this.init()
  }
}
