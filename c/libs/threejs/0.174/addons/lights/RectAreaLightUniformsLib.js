/* eslint-disable */

//! Copyright (c) mrdoob. MIT License.
// three - 0.174.0 - https://threejs.org/

import { UniformsLib } from "/c/libs/threejs/0.174/three.js"
import { RectAreaLightTexturesLib } from "./RectAreaLightTexturesLib.js"

class RectAreaLightUniformsLib {
  static init() {
    RectAreaLightTexturesLib.init()

    const { LTC_FLOAT_1, LTC_FLOAT_2, LTC_HALF_1, LTC_HALF_2 } =
      RectAreaLightTexturesLib

    // data textures

    UniformsLib.LTC_FLOAT_1 = LTC_FLOAT_1
    UniformsLib.LTC_FLOAT_2 = LTC_FLOAT_2

    UniformsLib.LTC_HALF_1 = LTC_HALF_1
    UniformsLib.LTC_HALF_2 = LTC_HALF_2
  }
}

export { RectAreaLightUniformsLib }
