/* eslint-disable complexity */
/* eslint-disable max-depth */
import { ConfigFile } from "../ConfigFile.js"
import { parseMimetype } from "../../../lib/syntax/mimetype/parseMimetype.js"
import { getExtname } from "../../../lib/syntax/path/getExtname.js"
import { getBasename } from "../../../lib/syntax/path/getBasename.js"
import { arrify } from "../../../lib/type/any/arrify.js"
import { assertPath } from "../../../lib/syntax/path/assertPath.js"
import { removeItem } from "../../../lib/type/array/removeItem.js"
import { uniq } from "../../../lib/type/array/uniq.js"

class MimetypesManager extends ConfigFile {
  async populate() {
    return import("../../../lib/constant/FILE_TYPES.js") //
      .then(({ mimetypes }) => mimetypes)
  }

  async postload() {
    this.mimetypes = this.value
    this.extnames = {}
    this.basenames = {}
    for (const type in this.mimetypes) {
      if (Object.hasOwn(this.mimetypes, type)) {
        for (const subtype in this.mimetypes[type]) {
          if (Object.hasOwn(this.mimetypes[type], subtype)) {
            const target = this.mimetypes[type][subtype]
            target.extnames?.forEach((item) => (this.extnames[item] = target))
            target.basenames?.forEach((item) => (this.basenames[item] = target))
          }
        }
      }
    }
  }

  ensureReady(methodName) {
    if (this.ready.isPending) {
      throw new Error(
        `Called ${methodName ? `sync method "${methodName}"` : "a sync method"} on MimetypesManager before waiting for MimetypesManager.ready`,
      )
    }
  }

  #normalize(mimetype, extnames, options) {
    this.ensureReady("normalize")
    const { type, subtype } = parseMimetype(mimetype)

    this.mimetypes[type] ??= {}

    const out = {}
    let exts = []

    for (const item of arrify(extnames)) {
      if (!item) continue
      exts.push((item.startsWith(".") ? item : `.${item}`).toLowerCase())
    }

    if (subtype === "*") {
      if (options?.expandExtnames !== false) {
        for (const key in this.mimetypes[type]) {
          if (key === "*") continue
          if (Object.hasOwn(this.mimetypes[type], key)) {
            const { extnames } = this.mimetypes[type][key]
            if (extnames) {
              if (options?.expandSubtype) {
                out[`${type}/${key}`] = uniq(exts.concat(extnames))
              } else {
                exts = exts.concat(extnames)
              }
            }
          }
        }
      }

      if (options?.expandSubtype !== true || Object.keys(out).length === 0) {
        out[`${type}/${subtype}`] = uniq(exts)
      }
    } else if (
      subtype in this.mimetypes[type] &&
      options?.expandExtnames !== false
    ) {
      const extnames = this.mimetypes[type]?.[subtype]?.extnames
      if (extnames) exts.push(...extnames)
      out[`${type}/${subtype}`] = uniq(exts)
    } else {
      out[`${type}/${subtype}`] = exts
    }

    return out
  }

  normalize(mimetypes, options) {
    const out = {}

    if (typeof mimetypes === "string") mimetypes = [mimetypes]

    if (Array.isArray(mimetypes)) {
      for (const item of mimetypes) {
        Object.assign(out, this.#normalize(item, undefined, options))
      }
    } else {
      for (const key in mimetypes) {
        if (Object.hasOwn(mimetypes, key)) {
          Object.assign(out, this.#normalize(key, mimetypes[key], options))
        }
      }
    }

    return out
  }

  setDefaultApp(mimetype, appName, _nested) {
    this.ensureReady("setDefaultApp")
    const { type, subtype } = parseMimetype(mimetype)
    this.mimetypes[type] ??= {}
    this.mimetypes[type][subtype] ??= { mimetype }
    const target = this.mimetypes[type][subtype]

    if (_nested && !target.apps) return

    target.apps ??= []

    if (target.apps[0] !== appName) {
      removeItem(target.apps, appName)
      target.apps.unshift(appName)
    }

    if (_nested !== true) {
      if (subtype === "*") {
        for (const key in this.mimetypes[type]) {
          if (Object.hasOwn(this.mimetypes[type], key)) {
            if (key === "*") continue
            this.setDefaultApp(
              this.mimetypes[type][key].mimetype,
              appName,
              true,
            )
          }
        }
      }

      return this.save()
    }
  }

  async add(mimetypes, appName, options) {
    await this.ready
    mimetypes = this.normalize(mimetypes, { expandSubtype: true })

    for (const mimetype in mimetypes) {
      if (Object.hasOwn(mimetypes, mimetype)) {
        const { extnames, basenames } = Object.groupBy(
          mimetypes[mimetype],
          (item) => (item.startsWith(".") ? "extnames" : "basenames"),
        )

        const { type, subtype } = parseMimetype(mimetype)

        this.mimetypes[type] ??= {}
        this.mimetypes[type][subtype] ??= { mimetype }
        const target = this.mimetypes[type][subtype]

        const registeredExtnames = []

        if (extnames) {
          target.extnames ??= []
          for (const ext of extnames) {
            if (!target.extnames.includes(ext)) {
              registeredExtnames.push(ext)
              target.extnames.push(ext)
            }

            this.extnames[ext] ??= target
          }
        }

        if (basenames) {
          target.basenames ??= []
          for (const bn of basenames) {
            if (!target.basenames.includes(bn)) target.basenames.push(bn)
            this.basenames[bn] ??= target
          }
        }

        if (appName) {
          target.apps ??= []

          if (registeredExtnames.length > 0) {
            target.openers ??= {}
            for (const item of registeredExtnames) {
              target.openers[item] = appName
            }
          }

          if (!target.apps.includes(appName)) {
            target.apps[
              options?.defaultApp //
                ? "unshift"
                : "push"
            ](appName)
          }
        }
      }
    }

    return this.save()
  }

  /**
   * @param {string} mimetype
   * @param {{ withApps?: boolean; }} [options]
   */
  list(mimetype, options) {
    this.ensureReady("list")
    const { type, subtype } = parseMimetype(mimetype)
    const arr = []

    for (const key in this.mimetypes) {
      if (
        Object.hasOwn(this.mimetypes, key) &&
        (key === type || type === "*")
      ) {
        const object = this.mimetypes[key]
        for (const key in object) {
          if (
            Object.hasOwn(object, key) &&
            (key === subtype || subtype === "*") &&
            (options?.withApps ? Boolean(object[key].apps) : true)
          ) {
            arr.push(object[key])
          }
        }
      }
    }

    return arr
  }

  /**
   * @param {string} path
   */
  lookup(path) {
    this.ensureReady("lookup")
    assertPath(path)

    path = path.toLowerCase()

    const out = structuredClone(
      this.extnames[getExtname(path)] ??
        this.basenames[getBasename(path)] ??
        {},
    )

    let appList = new Set(out.apps)

    if (out.mimetype) {
      const { type } = parseMimetype(out.mimetype)
      const apps = this.mimetypes[type]?.["*"]?.apps
      if (apps) appList = appList.union(new Set(apps))
    }

    const apps = this.mimetypes["*"]?.["*"]?.apps
    if (apps) appList = appList.union(new Set(apps))

    out.apps = Array.from(appList)

    if (out.openers) {
      for (const [key, val] of Object.entries(out.openers)) {
        if (path.endsWith(key)) {
          removeItem(out.apps, val)
          out.apps.unshift(val)
          break
        }
      }
    }

    return out
  }

  getExtnames(mimetype, options) {
    this.ensureReady("getExtnames")
    const out = []

    for (const item of this.list(mimetype, options)) {
      if (item.extnames) out.push(...item.extnames)
    }

    return out
  }

  parse(mimetype) {
    return parseMimetype(mimetype)
  }
}

export const mimetypesManager = new MimetypesManager("config/mimetypes.json5")
mimetypesManager.init()
