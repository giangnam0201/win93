// @read https://github.com/kriszyp/cbor-x
// @read https://github.com/hildjj/cbor-wasm
// @read https://github.com/rvagg/cborg

// @src https://github.com/rinq/cbor-js
//! Copyright (c) 2018 Patrick Gansterer <paroga@paroga.com>. MIT License.

import { encodeCBOR as encode } from "./CBOR/encodeCBOR.js"
import { decodeCBOR as decode } from "./CBOR/decodeCBOR.js"

export const CBOR = { encode, decode }
