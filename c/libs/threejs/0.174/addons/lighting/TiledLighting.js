/* eslint-disable */

//! Copyright (c) mrdoob. MIT License.
// three - 0.174.0 - https://threejs.org/

import { Lighting } from "three/webgpu"
import { tiledLights } from "../tsl/lighting/TiledLightsNode.js"

export class TiledLighting extends Lighting {
  constructor() {
    super()
  }

  createNode(lights = []) {
    return tiledLights().setLights(lights)
  }
}
