import { Emittable } from "../../lib/class/mixin/Emittable.js"
import { Storable } from "../../lib/class/Storable.js"
import { Locator } from "../../lib/class/Locator.js"
import { exists } from "../../lib/type/object/exists.js"
import { FileSystemError } from "./FileSystemError.js"
import { configure } from "../configure.js"
import { sortPath } from "../../lib/syntax/path/sortPath.js"
import { isDirDescriptor } from "./isDirDescriptor.js"
import { isGlob } from "../../lib/syntax/glob/isGlob.js"
import { glob, Glob } from "../../lib/syntax/glob.js"
import { normalizeDirname, normalizeFilename } from "./normalizeFilename.js"
import { flatten } from "../../lib/type/object/flatten.js"
import { inDesktopRealm } from "../env/realm/inDesktopRealm.js"
import { locate } from "../../lib/type/object/locate.js"
import { updateCache } from "../../lib/browser/updateCache.js"
import { arrify } from "../../lib/type/any/arrify.js"
// import { StorableEntries } from "../../lib/class/StorableEntries.js"

const DEFAULTS = {
  name: "fileindex",
  delimiter: "/",
  // durability: "relaxed",
}

const BaseStore = Storable
// const BaseStore = StorableEntries

const BaseLocator = /** @type {typeof Storable} */ (
  inDesktopRealm ? BaseStore : Locator
)

export class FileLocator extends Emittable(BaseLocator) {
  constructor(value, options) {
    super(value, configure(DEFAULTS, options))
  }

  async init() {
    if (inDesktopRealm) return super.init()
  }

  /**
   * @param {string | string[]} dirnames
   * @returns {Promise<void>}
   */
  async upgrade(dirnames) {
    if (!inDesktopRealm) throw new Error("fileIndex.upgrade not available")

    dirnames = arrify(dirnames).map((dirname) => normalizeDirname(dirname))

    const undones = []
    undones.push(this.config.populate({ fresh: true }))

    for (const dirname of dirnames) {
      const oldDir = locate(this.value, dirname, this.delimiter)

      if (oldDir) {
        const paths = flatten
          .keys(oldDir, this.delimiter)
          .map((key) => dirname + key)
        undones.push(updateCache(paths, { delete: true }))
      }
    }

    const [files] = await Promise.all(undones)

    let hasChanges = false
    for (const dirname of dirnames) {
      const newDir = locate(files, dirname, this.delimiter)

      if (newDir) {
        for (const [key, val] of flatten.entries(newDir, this.delimiter)) {
          Locator.prototype.set.call(this, dirname + key, val)
          hasChanges = true
        }
      }
    }

    if (hasChanges && this.store) {
      await this.store.set("value", this.value)
    }
  }

  get(path) {
    try {
      path = decodeURIComponent(path)
    } catch {}
    const desc = super.get(path)

    // if (typeof desc === "string") {
    //   const seen = new Set([path])
    //   let lookup = desc
    //   while (typeof lookup === "string") {
    //     if (seen.has(lookup)) {
    //       throw new FileSystemError(
    //         FileSystemError.ELOOP,
    //         path,
    //         "circular link",
    //       )
    //     }
    //     seen.add(lookup)
    //     lookup = super.get(lookup)
    //   }
    // }

    return desc
  }

  async set(path, inode, options) {
    let changes

    if (options?.silent !== true) {
      changes = []

      const segments = exists.segmentize(path, this.delimiter)

      if (segments.pop() === ".directory") {
        const path = `/${segments.join("/")}/`
        changes.push(path)
      }

      while (segments.length > 0) {
        if (!exists.run(this.value, segments)) {
          const path = `/${segments.join("/")}/`
          changes.push(path)
        }

        segments.pop()
      }
    }

    await super.set(path, inode)

    if (isDirDescriptor(inode)) path += "/"

    if (changes) {
      for (let i = changes.length - 1; i >= 0; i--) {
        if (options?.changeId === undefined) {
          this.emit("change", changes[i], "set")
        } else {
          this.emit("change", changes[i], "set", undefined, options.changeId)
        }
      }

      if (options?.changeId === undefined) {
        this.emit("change", path, "set", inode)
      } else {
        this.emit("change", path, "set", inode, options.changeId)
      }
    }
  }

  async delete(path, options) {
    let changes
    if (options?.silent !== true) {
      if (this.isDir(path)) {
        changes ??= []
        this.readDir(path, { absolute: true, recursive: true }, (path) =>
          changes.push(path),
        )
        changes.push(path)
      } else {
        changes ??= []
        changes.push(path)
      }
    }
    await super.delete(path)
    if (changes) {
      for (const path of changes) {
        this.emit("change", path, "delete", options?.changeId)
      }
    }
  }

  async clear(options) {
    let changes
    if (options?.silent !== true) {
      changes ??= []
      this.readDir("/", { absolute: true, recursive: true }, (path) =>
        changes.push(path),
      )
    }
    await super.clear()
    if (changes) {
      for (const path of changes) {
        this.emit("change", path, "delete", options?.changeId)
      }
    }
  }

  copy(from, to, options) {
    const inode = this.get(from)

    if (inode === 0) {
      if (options?.delete) this.delete(from, options)
      this.set(to, location.origin + from)
      return
    }
    if (typeof inode === "string") {
      if (options?.delete) this.delete(from, options)
      this.set(to, inode)
      return
    }

    if (options?.delete) this.delete(from, options)
    this.set(to, inode)
  }

  move(from, to, options) {
    this.copy(from, to, { delete: true, ...options })
  }

  watch(pattern, options, fn) {
    pattern = normalizeFilename(pattern)
    if (typeof options === "function") fn = options
    const signal = options?.signal

    if (isGlob(pattern)) {
      const glob = new Glob(pattern)
      return this.on("change", { signal, off: true }, (path, type, inode) => {
        if (glob.test(path)) fn(path, type, inode)
      })
    }

    return this.on("change", { signal, off: true }, (path, type, inode) => {
      if (path === pattern) fn(path, type, inode)
    })
  }

  glob(patterns, options) {
    patterns = arrify(patterns)
    patterns.push("!/trash/**")
    const paths = glob.locate(this.value, patterns, options)
    return options?.sort === false ? paths : sortPath(paths, options?.sort)
  }

  isDir(path) {
    return isDirDescriptor(this.get(path))
  }

  isFile(path) {
    const desc = this.get(path)
    return Array.isArray(desc) || desc === 0 || typeof desc === "string"
  }

  isLink(path) {
    const desc = this.get(path)
    return typeof desc === "string"
  }

  link(from, to) {
    from = normalizeFilename(from)
    to = normalizeFilename(to)
    if (from === to) {
      throw new FileSystemError(
        FileSystemError.ELOOP,
        from,
        `symbolic link refer to itself`,
      )
    }

    const seen = new Set([to])
    let lookup = from
    while (typeof lookup === "string") {
      if (seen.has(lookup)) {
        throw new FileSystemError(FileSystemError.ELOOP, from, "circular link")
      }
      seen.add(lookup)
      lookup = super.get(lookup)
    }

    const desc = this.get(from)
    if (desc === undefined) {
      throw new FileSystemError(FileSystemError.ENOENT, from)
    }

    this.set(to, from)
  }

  /**
   * @param {string} path
   * @param {{recursive?: true, absolute?: true, sort?: false }} [options]
   * @param {(path: string) => void} [cb]
   */
  readDir(path, options = {}, cb) {
    const { recursive, absolute } = options
    const dir = this.get(path)

    if (dir === undefined) {
      throw new FileSystemError(FileSystemError.ENOENT, path)
    } else if (!isDirDescriptor(dir)) {
      throw new FileSystemError(FileSystemError.ENOTDIR, path)
    }

    if (path !== "/") {
      if (!path.startsWith("/")) path = "/" + path
      if (!path.endsWith("/")) path += "/"
    }

    const root = absolute ? path : ""

    let names

    if (!cb) {
      names = []
      cb = names.push.bind(names)
    }

    if (recursive) {
      const recurse = (currentDir, parentPath) => {
        for (const [key, desc] of Object.entries(currentDir)) {
          if (isDirDescriptor(desc)) {
            const path = `${parentPath}${key}/`
            if (Object.keys(desc).length === 0) cb(`${root}${path}`)
            else recurse(desc, path)
          } else {
            cb(`${root}${parentPath}${key}`)
          }
        }
      }
      recurse(dir, "")
    } else if (absolute) {
      for (const [key, desc] of Object.entries(dir)) {
        cb(isDirDescriptor(desc) ? `${root}${key}/` : `${root}${key}`)
      }
    } else {
      for (const [key, desc] of Object.entries(dir)) {
        cb(isDirDescriptor(desc) ? `${key}/` : key)
      }
    }

    if (names) return options.sort === false ? names : sortPath(names)
  }
}
