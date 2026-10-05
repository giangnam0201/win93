/* eslint-disable */

//! Copyright (c) mrdoob. MIT License.
// three - 0.174.0 - https://threejs.org/

import { WireframeGeometry } from "/c/libs/threejs/0.174/three.js"
import { LineSegmentsGeometry } from "../lines/LineSegmentsGeometry.js"

class WireframeGeometry2 extends LineSegmentsGeometry {
  constructor(geometry) {
    super()

    this.isWireframeGeometry2 = true

    this.type = "WireframeGeometry2"

    this.fromWireframeGeometry(new WireframeGeometry(geometry))

    // set colors, maybe
  }
}

export { WireframeGeometry2 }
