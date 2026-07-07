/* eslint-disable */

//! Copyright (c) mrdoob. MIT License.
// three - 0.174.0 - https://threejs.org/

class Transpiler {
  constructor(decoder, encoder) {
    this.decoder = decoder
    this.encoder = encoder
  }

  parse(source) {
    return this.encoder.emit(this.decoder.parse(source))
  }
}

export default Transpiler
