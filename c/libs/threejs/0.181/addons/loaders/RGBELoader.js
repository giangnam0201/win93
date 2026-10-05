/* eslint-disable */

//! Copyright (c) mrdoob. MIT License.
// three - 0.181.2 - https://threejs.org/

import { HDRLoader } from "./HDRLoader.js"

// @deprecated, r180

class RGBELoader extends HDRLoader {
  constructor(manager) {
    console.warn(
      "RGBELoader has been deprecated. Please use HDRLoader instead.",
    )
    super(manager)
  }
}

export { RGBELoader }
