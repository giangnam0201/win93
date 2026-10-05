import { EmscriptenFS } from "../../../api/fs/class/EmscriptenFS.js"
import { loadArrayBuffer } from "../../../api/load/loadArrayBuffer.js"
import { loadText } from "../../../api/load/loadText.js"

const code = `\
${await loadText("../../../../c/libs/js-dos/8.3/emulators/wlibzip.js")}
export { WLIBZIP }`
const blob = new Blob([code], { type: "text/javascript" })
const { WLIBZIP } = await import(URL.createObjectURL(blob))

const wlibzip = await WLIBZIP({
  wasmBinary: await loadArrayBuffer(
    "/c/libs/js-dos/8.3/emulators/wlibzip.wasm",
  ),
})

export class LibZip {
  constructor(module, home = "/home/web_user") {
    this.module = module
    this.home = home
    this.module.callMain([])
    this.module.FS.ignorePermissions = true
    this.chdirToHome()
  }

  zipFromFs(changedAfterMs = -1) {
    this.chdirToHome()
    const ptr = this.module._zip_from_fs(changedAfterMs)
    if (ptr === 0) {
      return Promise.reject(
        new Error("Can't create zip, see more info in logs"),
      )
    }
    const length = this.module.HEAPU32[ptr / 4]
    const memory = this.module.HEAPU8
    const archive = memory.slice(ptr + 4, ptr + 4 + length)
    this.module._free(ptr)
    return Promise.resolve(archive)
  }

  zipToFs(zipArchive, path = "/", filter) {
    const Module = this.module
    path = this.normalizeFilename(path)
    const pathParts = this.normalizeFilename(path).split("/")
    this.createPath(pathParts, 0, pathParts.length)
    this.chdir(path)
    const withFilter = filter !== undefined && filter.length > 0
    let filterBuffer = 0
    if (withFilter) {
      const filterLength = Module.lengthBytesUTF8(filter) + 1
      filterBuffer = Module._malloc(filterLength)
      Module.stringToUTF8(filter, filterBuffer, filterLength)
    }
    const bytes = new Uint8Array(zipArchive)
    const buffer = Module._malloc(bytes.length)
    Module.HEAPU8.set(bytes, buffer)
    const retcode = Module._zip_to_fs(buffer, bytes.length, filterBuffer)
    Module._free(buffer)
    this.chdirToHome()
    if (withFilter) {
      Module._free(filterBuffer)
    }
    if (retcode === 0) {
      return Promise.resolve()
    }

    return Promise.reject(
      new Error(
        "Can't extract zip, retcode " + retcode + ", see more info in logs",
      ),
    )
  }

  writeFile(file, body) {
    // Allow to create file in FS, it will be created relatively cwd
    // All directories will be created
    //
    // windows style path are also valid, but **drive letter is ignored**
    // if you pass only filename, then file will be writed in cwd
    //
    // body can be string or ArrayBuffer or Uint8Array
    file = this.normalizeFilename(file)
    if (body instanceof ArrayBuffer) {
      body = new Uint8Array(body)
    }
    const parts = file.split("/")
    if (parts.length === 0) {
      throw new Error(
        "Can't create file '" + file + "', because it's not valid file path",
      )
    }
    const filename = parts[parts.length - 1].trim()
    if (filename.length === 0) {
      throw new Error(
        "Can't create file '" + file + "', because file name is empty",
      )
    }
    /* i < parts.length - 1, because last part is file name */
    const path = this.createPath(parts, 0, parts.length - 1)
    this.module.FS.writeFile(path + "/" + filename, body)
  }

  async readFile(file, encoding = "utf8") {
    file = this.normalizeFilename(file)
    return this.module.FS.readFile(file, { encoding })
  }

  exists(file) {
    file = this.normalizeFilename(file)
    try {
      this.module.FS.lookupPath(file)
      return true
    } catch {
      return false
    }
  }

  destroy() {
    try {
      this.module._libzip_destroy()
    } catch (err) {
      return err
    }
  }

  normalizeFilename(file) {
    file = file.replace(/^[A-z]+:/, "").replaceAll("\\", "/")
    while (file[0] === "/") {
      file = file.slice(1)
    }
    return file
  }

  createPath(parts, begin, end) {
    let path = "."
    for (let i = begin; i < end; ++i) {
      const part = parts[i].trim()
      if (part.length === 0) {
        continue
      }
      this.module.FS.createPath(path, part, true, true)
      path = path + "/" + part
    }
    return path
  }

  chdirToHome() {
    this.module.FS.chdir(this.home)
  }
  chdir(path) {
    this.module.FS.chdir(this.home + "/" + path)
  }

  async zipAddFile(archive, file) {
    const Module = this.module
    const archiveLength = Module.lengthBytesUTF8(archive) + 1
    const archiveBuffer = Module._malloc(archiveLength)
    Module.stringToUTF8(archive, archiveBuffer, archiveLength)
    const fileLength = Module.lengthBytesUTF8(file) + 1
    const fileBuffer = Module._malloc(fileLength)
    Module.stringToUTF8(file, fileBuffer, fileLength)
    const ret = this.module._zipfile_add(archiveBuffer, fileBuffer, fileBuffer)
    Module._free(archiveBuffer)
    Module._free(fileBuffer)
    if (ret !== 0) {
      throw new Error("Unable to add " + file + " into " + archive)
    }
  }
}

export const libzip = new LibZip(wlibzip)
const fs = new EmscriptenFS(libzip.module.FS)

export async function extract(src) {
  let arrBuf = src
  if (typeof src === "string") {
    arrBuf = await loadArrayBuffer(src)
  }

  await libzip.zipToFs(new Uint8Array(arrBuf))

  const items = []
  const names = fs.readDir("/home/web_user")
  const contents = await Promise.all(
    names.map((name) => libzip.readFile(name, "binary")),
  )

  for (let i = 0, l = contents.length; i < l; i++) {
    const file = new File([contents[i]], names[i])
    items.push({
      name: names[i],
      size: file.size,
      file,
    })
  }

  return items
}
