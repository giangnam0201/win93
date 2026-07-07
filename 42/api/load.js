import { loadArrayBuffer } from "./load/loadArrayBuffer.js"
import { loadBlob } from "./load/loadBlob.js"
import { loadFile } from "./load/loadFile.js"
import { loadDataURL } from "./load/loadDataURL.js"
import { loadBinaryString } from "./load/loadBinaryString.js"

import { loadScript } from "./load/loadScript.js"
import { loadCSS } from "./load/loadCSS.js"
import { loadHTML } from "./load/loadHTML.js"
import { loadJSON } from "./load/loadJSON.js"
import { loadCBOR } from "./load/loadCBOR.js"
import { loadSVG } from "./load/loadSVG.js"
import { loadXML } from "./load/loadXML.js"
import { loadText } from "./load/loadText.js"
import { loadImage } from "./load/loadImage.js"
import { loadAudio } from "./load/loadAudio.js"
import { loadFont } from "./load/loadFont.js"
import { loadWorker } from "./load/loadWorker.js"

import { preload } from "./load/preload.js"

export const load = {
  arrayBuffer: loadArrayBuffer,
  blob: loadBlob,
  file: loadFile,
  dataURL: loadDataURL,
  binaryString: loadBinaryString,

  script: loadScript,
  css: loadCSS,
  html: loadHTML,
  json: loadJSON,
  cbor: loadCBOR,
  svg: loadSVG,
  xml: loadXML,
  text: loadText,
  image: loadImage,
  audio: loadAudio,
  font: loadFont,
  worker: loadWorker,

  preload,
}

export { preload }
