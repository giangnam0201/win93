//! Copyright (c) 2020 Eric Rowell @ericdrowell. MIT license.
// @src https://github.com/ericdrowell/concrete

import { Scene } from "./Scene.js"

/** @import { Layer } from "./Layer.js" */

let idCounter = 0

const viewports = []

// svg export https://css-tricks.com/accessible-svgs/#aa-2-lets-make-it-accessible

/**
 * Viewport constructor.
 * @param {object} config
 * @param {number} config.width - Viewport width in pixels.
 * @param {number} config.height - Viewport height in pixels.
 */
export class Viewport {
  constructor(config = {}) {
    this.container = config.container
    this.layers = []
    this.id = idCounter++
    this.scene = new Scene()

    this.setSize(config.width || 0, config.height || 0)

    // clear container
    config.container.innerHTML = ""
    config.container.append(this.scene.canvas)

    viewports.push(this)
  }

  /**
   * Add layer.
   * @param {Layer} layer
   * @returns {Viewport}
   */
  add(layer) {
    this.layers.push(layer)
    layer.setSize(layer.width || this.width, layer.height || this.height)
    layer.viewport = this
    return this
  }

  /**
   * Set viewport size.
   * @param {number} width - Viewport width in pixels.
   * @param {number} height - Viewport height in pixels.
   * @returns {Viewport}
   */
  setSize(width, height) {
    this.width = width
    this.height = height
    this.scene.setSize(width, height)

    for (const layer of this.layers) {
      layer.setSize(width, height)
    }

    return this
  }

  /**
   * Get key associated to coordinate.  This can be used for mouse interactivity.
   * @param {number} x
   * @param {number} y
   * @returns {number} Integer - returns -1 if no pixel is there.
   */
  getIntersection(x, y) {
    const { layers } = this
    const len = layers.length
    let n
    let layer
    let key

    for (n = len - 1; n >= 0; n--) {
      layer = layers[n]
      key = layer.hit.getIntersection(x, y)
      if (key >= 0) {
        return key
      }
    }

    return -1
  }

  /**
   * Get viewport index from all Concrete viewports.
   * @returns {number}
   */
  getIndex() {
    const len = viewports.length
    let n = 0
    let viewport

    for (n = 0; n < len; n++) {
      viewport = viewports[n]
      if (this.id === viewport.id) {
        return n
      }
    }

    return null
  }

  /**
   * Destroy viewport.
   */
  destroy() {
    // destroy layers
    for (const layer of this.layers) {
      layer.destroy()
    }

    // clear dom
    this.container.innerHTML = ""

    // remove self from viewports array
    viewports.splice(this.getIndex(), 1)
  }

  /**
   * Composite all layers onto visible canvas.
   */
  render() {
    const { scene } = this

    scene.clear()

    for (const layer of this.layers) {
      if (layer.visible) {
        scene.context.drawImage(
          layer.scene.canvas,
          0,
          0,
          layer.width,
          layer.height,
        )
      }
    }
  }
}
