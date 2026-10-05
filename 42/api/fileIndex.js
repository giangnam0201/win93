import { system } from "./system.js"
import { FileIndex } from "./fs/FileIndex.js"
import { loadCBOR } from "./load/loadCBOR.js"

const populate = async (options) => loadCBOR("/files.cbor", options)

/** @type {FileIndex} */
export let fileIndex

if (system.fileIndex) fileIndex = system.fileIndex
else {
  fileIndex = new FileIndex({}, { populate })
  await fileIndex.init()
  system.fileIndex = fileIndex
}
