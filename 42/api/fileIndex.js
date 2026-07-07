import { system } from "./system.js"
import { FileIndex } from "./fs/FileIndex.js"
import { loadCBOR } from "./load/loadCBOR.js"

const base = (() => {
  let p = location.pathname;
  if (!p.endsWith("/")) {
    p = p.substring(p.lastIndexOf("/") + 1).includes(".") ? p.substring(0, p.lastIndexOf("/") + 1) : p + "/";
  }
  return p;
})();
const populate = async (options) => loadCBOR(base + "files.cbor", options)

/** @type {FileIndex} */
export let fileIndex

if (system.fileIndex) fileIndex = system.fileIndex
else {
  fileIndex = new FileIndex({}, { populate })
  await fileIndex.init()
  system.fileIndex = fileIndex
}
