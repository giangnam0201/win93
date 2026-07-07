// @ts-nocheck

import { UAParser } from "./env/parseUserAgent.js"
import { languages } from "./i18n/languages.js"
import { runtime } from "./env/runtime.js"
import { getGPU } from "./env/getGPU.js"
import { realm } from "./env/realm.js"
import { pointer } from "./env/device/pointer.js"
import { reuse } from "../lib/type/function/reuse.js"

const getUAData = reuse(() => new UAParser())
const getGPUData = reuse(() => getGPU())
const enumerable = true

const properties = {
  browser: {
    enumerable,
    get() {
      const browser = getUAData().getBrowser()
      const name = /** @type {string} */ (browser.name?.toLowerCase() ?? "")
      let version = browser.major
      version = Number.parseInt(version, 10)
      if (Number.isNaN(version)) version = 0
      return Object.freeze({
        name,
        /** @type {number} */ version,
        semver: /** @type {string} */ (browser.version),
        isChrome: name.startsWith("chrom"),
        isEdge: name.startsWith("edge"),
        isFirefox: name.startsWith("firefox"),
        isIE: name.startsWith("ie"),
        isOpera: name.startsWith("opera"),
        isSafari: name.startsWith("safari"),
      })
    },
  },

  engine: {
    enumerable,
    get() {
      const engine = getUAData().getEngine()
      const name = /** @type {string} */ (engine.name?.toLowerCase() ?? "")
      let version = Number.parseInt(engine.version, 10)
      if (Number.isNaN(version)) version = 0
      return Object.freeze({
        name,
        /** @type {number} */ version,
        semver: /** @type {string} */ (engine.version),
        isBlink: name.startsWith("blink"),
        isGecko: name.startsWith("gecko"),
        isWebkit: name.startsWith("webkit"),
      })
    },
  },

  os: {
    enumerable,
    get: () => Object.freeze(getUAData().getOS()),
  },

  device: {
    enumerable,
    get() {
      const device = getUAData().getDevice()
      device.type =
        device.type ||
        (globalThis.navigator?.userAgentData
          ? globalThis.navigator?.userAgentData.mobile
            ? "mobile"
            : "desktop"
          : runtime.inFrontend
            ? "desktop"
            : undefined)
      return Object.freeze(device)
    },
  },

  memory: {
    enumerable,
    get: () => Object.freeze({ gigabytes: globalThis.navigator?.deviceMemory }),
  },

  cpu: {
    enumerable,
    get: () =>
      Object.freeze({
        ...getUAData().getCPU(),
        cores: globalThis.navigator?.hardwareConcurrency,
      }),
  },

  gpu: {
    enumerable,
    get: () => Object.freeze(getGPUData()),
  },

  network: {
    enumerable,
    get: () =>
      Object.freeze({
        get online() {
          return globalThis.navigator?.onLine
        },
        get type() {
          return globalThis.navigator?.connection?.type
        },
        get effectiveType() {
          return globalThis.navigator?.connection?.effectiveType
        },
      }),
  },

  languages: {
    enumerable,
    get: () => languages,
  },

  pointer: {
    enumerable,
    get: () => pointer,
  },
}

class Env {
  constructor() {
    this.realm = realm
    this.runtime = runtime
    Object.defineProperties(this, properties)
    Object.freeze(this)
  }

  [Symbol.toPrimitive]() {
    const { browser: b, os: o, device: d } = this
    let out = `${b.name ?? ""}${b.major ? ` ${b.major}` : ""}`
    if (d.type) out += ` (${d.type})`
    if (o.name) out += ` on ${o.name}${o.version ? ` ${o.version}` : ""}`
    if (d.vendor) out += `, ${d.vendor}${d.model ? ` ${d.model}` : ""}`
    return out
  }

  toString() {
    return this[Symbol.toPrimitive]()
  }

  toJSON() {
    return this
  }
}

export const env = /** @type {any} */ (new Env())
