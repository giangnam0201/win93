import { Hit } from "./Hit.js"
import { Scene } from "./Scene.js"

/**
 * @import {Viewport} from "./Viewport.js"
 */

let idCounter = 0

/**
 * Layer constructor.
 * @param {object} config
 * @param {number} [config.x]
 * @param {number} [config.y]
 * @param {number} [config.width] - Viewport width in pixels.
 * @param {number} [config.height] - Viewport height in pixels.
 */

export class Layer {
  /** @type {Viewport} */
  viewport

  constructor(config = {}) {
    this.x = 0
    this.y = 0
    this.width = 0
    this.height = 0
    this.visible = true
    this.id = idCounter++
    this.hit = new Hit({
      contextType: config.contextType,
    })
    this.scene = new Scene({
      contextType: config.contextType,
    })

    if (config.x && config.y) {
      this.setPosition(config.x, config.y)
    }

    if (config.width && config.height) {
      this.setSize(config.width, config.height)
    }
  }

  /**
   * Set layer position.
   * @param {number} x
   * @param {number} y
   * @returns {Layer}
   */
  setPosition(x, y) {
    this.x = x
    this.y = y
    return this
  }

  /**
   * Set layer size.
   * @param {number} width
   * @param {number} height
   * @returns {Layer}
   */
  setSize(width, height) {
    this.width = width
    this.height = height
    this.scene.setSize(width, height)
    this.hit.setSize(width, height)
    return this
  }

  /**
   * Move up.
   * @returns {Layer}
   */
  moveUp() {
    const index = this.getIndex()
    const { layers } = this.viewport

    if (index < layers.length - 1) {
      // swap
      layers[index] = layers[index + 1]
      layers[index + 1] = this
    }

    return this
  }

  /**
   * Move down.
   * @returns {Layer}
   */
  moveDown() {
    const index = this.getIndex()
    const { layers } = this.viewport

    if (index > 0) {
      // swap
      layers[index] = layers[index - 1]
      layers[index - 1] = this
    }

    return this
  }

  /**
   * Move to top.
   * @returns {Layer}
   */
  moveToTop() {
    const index = this.getIndex()
    const { layers } = this.viewport

    layers.splice(index, 1)
    layers.push(this)

    return this
  }

  /**
   * Move to bottom.
   * @returns {Layer}
   */
  moveToBottom() {
    const index = this.getIndex()
    const { layers } = this.viewport

    layers.splice(index, 1)
    layers.unshift(this)

    return this
  }

  /**
   * Get layer index from viewport layers.
   * @returns {number | null}
   */
  getIndex() {
    const { layers } = this.viewport
    const len = layers.length
    let n = 0
    let layer

    for (n = 0; n < len; n++) {
      layer = layers[n]
      if (this.id === layer.id) {
        return n
      }
    }

    return null
  }

  destroy() {
    // remove self from layers array
    this.viewport.layers.splice(this.getIndex(), 1)
  }
}
