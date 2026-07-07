import { system } from "./system.js"
import { FileIndex } from "./fs/FileIndex.js"
import { loadCBOR } from "./load/loadCBOR.js"

const base = location.pathname.endsWith('/') ? location.pathname : location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
const populate = async (options) => loadCBOR(base + "files.cbor", options)

/** @type {FileIndex} */
export let fileIndex

if (system.fileIndex) fileIndex = system.fileIndex
else {
  fileIndex = new FileIndex({}, { populate })
  await fileIndex.init()
  system.fileIndex = fileIndex
}
