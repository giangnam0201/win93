import { DatabaseError } from "./DatabaseError.js"
import { ObjectStore } from "./ObjectStore.js"
import { configure } from "../configure.js"
import { defer } from "../../lib/type/promise/defer.js"

const DEFAULTS = {
  name: "database",
  version: 1,
  stores: {},
  durability: "default",
  persistent: true,
  retries: 10,

  /** @type {Function} */
  populate: undefined,
  /** @type {Function} */
  downgrade: undefined,
  /** @type {Function} */
  upgrade: undefined,
}

/**
 * @typedef {Partial<DEFAULTS>} DatabaseOptions
 */

const debug = 0

export class Database {
  #config
  #obsolete = false

  /** @type {ObjectStore} */
  store

  static async list() {
    return indexedDB.databases()
  }

  static async open(name, version, options) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version)

      if (options?.blocked) req.onblocked = options?.blocked

      let pending

      req.onupgradeneeded = ({ oldVersion, newVersion }) => {
        if (debug) console.log("db onupgradeneeded", name)
        if (options?.upgrade) {
          pending = options
            .upgrade(req.result, {
              oldVersion,
              newVersion,
              transaction: req.transaction,
            })
            .catch(reject)
        }
      }

      req.onerror = async () => {
        if (options?.downgrade && req.error.name === "VersionError") {
          try {
            const db = await Database.open(name)
            await options.downgrade(db, {
              oldVersion: db.version,
              newVersion: version,
              transaction: req.transaction,
            })
            resolve(await Database.open(name, version))
          } catch (err) {
            reject(err)
          }
        } else {
          reject(new DatabaseError(req.error))
        }
      }

      req.onsuccess = async () => {
        if (pending) await pending
        resolve(req.result)
      }
    })
  }

  static async delete(name, options) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name)
      if (options?.blocked) req.onblocked = options.blocked
      req.onsuccess = //
        () => resolve()

      req.onerror = //
        () => reject(new DatabaseError(`Couldn't delete database ${name}`))
    })
  }

  /**
   * @overload
   * @param {string} name
   * @param {DatabaseOptions} [options]
   */
  /**
   * @overload
   * @param {DatabaseOptions} options
   */
  /**
   * @param {string | DatabaseOptions} name
   * @param {DatabaseOptions} [options]
   */
  constructor(name, options = {}) {
    if (typeof name === "string") options.name = name
    else options = name ?? {}

    if ("stores" in options === false) options.stores = { store: {} }

    this.#config = configure(DEFAULTS, options)

    this.ready = defer()

    this.indexedDB = undefined
    this.name = this.#config.name
    this.durability = this.#config.durability
    this.range = IDBKeyRange
    this.stores = {}

    Object.keys(this.#config.stores).forEach((name) =>
      this.#registerStore(name),
    )
  }

  #registerStore(name) {
    const descriptor = { get: () => new ObjectStore(this, name) }
    if (this[name] === undefined) Object.defineProperty(this, name, descriptor)
    Object.defineProperty(this.stores, name, descriptor)
  }

  #registerDB(db) {
    db.addEventListener("close", () => {
      if (debug) console.log("db close")
      this.indexedDB = undefined
    })
    db.addEventListener("versionchange", () => {
      if (debug) console.log("db versionchange")
      db.close()
      this.#obsolete = true
      this.indexedDB = undefined
    })
    return db
  }

  async #downgrade(db, arg) {
    if (this.#config.downgrade) {
      const res = await this.#config.downgrade(this, db, arg)
      if (res === false) return
    }

    db.close()
    await Database.delete(db.name)
  }

  async #upgrade(db, arg) {
    let { stores } = this.#config

    const initReady = this.#initReady
    this.#initReady = undefined

    if (this.#config.upgrade) {
      const res = await this.#config.upgrade(this, db, arg)
      if (res === false) return
      if (typeof res === "object") stores = res
    }

    for (const [name, schema] of Object.entries(stores)) {
      if (db.objectStoreNames.contains(name)) {
        db.deleteObjectStore(name)
      }

      const storeConfig = {}
      const indexes = []

      for (const [key, desc] of Object.entries(schema)) {
        if (desc.autoIncrement) {
          storeConfig.autoIncrement = desc.autoIncrement
        }

        if (desc.keyPath) {
          if (typeof storeConfig.keyPath === "string") {
            storeConfig.keyPath = [storeConfig.keyPath, key]
          } else if (Array.isArray(storeConfig.keyPath)) {
            storeConfig.keyPath.push(key)
          } else {
            storeConfig.keyPath = key
          }
        }

        if ("unique" in desc || "index" in desc) {
          indexes.push([key, { unique: Boolean(desc.unique) }])
        }
      }

      if (
        "keyPath" in storeConfig === false &&
        "autoIncrement" in storeConfig === false
      ) {
        storeConfig.autoIncrement = true
      }

      const store = db.createObjectStore(name, storeConfig)
      indexes.forEach(([key, config]) => store.createIndex(key, key, config))
    }

    if (this.#config.populate) {
      if (debug) console.time(`db populate (${this.name})`)
      await this.#config.populate(this, db, arg)
      if (debug) console.timeEnd(`db populate (${this.name})`)
    }

    this.#initReady = initReady
  }

  #initReady
  async init() {
    if (this.indexedDB) return this.indexedDB

    if (this.#obsolete) {
      throw new DatabaseError("Database is obsolete")
    }

    if (debug) console.log("db init", this.#config.name)

    if (this.#initReady?.isPending) return this.#initReady
    this.#initReady = defer()

    const { name, version /* , persistent */ } = this.#config

    // if ((persistent, navigator.storage && navigator.storage.persist)) {
    //   // TODO: check Storage Buckets API https://developer.chrome.com/blog/storage-buckets/
    //   this.persistent =
    //     (await navigator.storage.persisted()) ||
    //     (await navigator.storage.persist())
    // }

    const RETRIES = this.#config.retries
    let retries = RETRIES + 1

    const openOptions = {
      upgrade: async (...args) => this.#upgrade(...args),
      downgrade: async (...args) => this.#downgrade(...args),
    }

    const tryOpen = async () => {
      try {
        this.indexedDB = await Database.open(name, version, openOptions)

        let missingStore = false
        for (const storeName of Object.keys(this.#config.stores)) {
          if (!this.indexedDB.objectStoreNames.contains(storeName)) {
            missingStore = true
            break
          }
        }

        if (missingStore) {
          this.indexedDB.close()
          await Database.delete(name)
          throw new DatabaseError(
            `Missing object store in database ${name}, recreating...`,
          )
        }
      } catch (err) {
        if (--retries) {
          console.groupCollapsed(
            `Database opening fail (${err.name}), retry ${
              RETRIES - retries + 1
            }/${RETRIES}`,
          )
          console.warn(err)
          console.groupEnd()
          await tryOpen()
        } else {
          this.#initReady.reject(this.indexedDB)
          throw err
        }
      }
    }

    await tryOpen()

    this.#registerDB(this.indexedDB)

    this.ready.resolve()
    this.#initReady?.resolve(this.indexedDB)

    return this.indexedDB
  }

  then(resolve, reject) {
    this.init().then(resolve, reject)
  }

  async destroy(arg) {
    this.indexedDB?.close()
    await Database.delete(this.#config.name, arg)
  }
}
