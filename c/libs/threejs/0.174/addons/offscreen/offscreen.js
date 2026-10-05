/* eslint-disable */

//! Copyright (c) mrdoob. MIT License.
// three - 0.174.0 - https://threejs.org/

import init from "./scene.js"

self.onmessage = function (message) {
  const data = message.data
  init(data.drawingSurface, data.width, data.height, data.pixelRatio, data.path)
}
