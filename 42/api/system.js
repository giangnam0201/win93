import { Emitter } from "../lib/class/Emitter.js"
import { getDesktopRealm } from "./env/realm/getDesktopRealm.js"
import { inDesktopRealm } from "./env/realm/inDesktopRealm.js"
import { merge } from "../lib/type/object/merge.js"
import config from "../../42.system.js"

/**
 * @import { env } from "./env.js"
 * @import { fileIndex } from "./fileIndex.js"
 * @import { WorkspacesComponent } from "../ui/desktop/workspaces.js"
 */

export class System extends Emitter {
  config = {}

  /** @type {any} */ bios
  /** @type {any} */ kernel
  /** @type {any} */ desktop

  /** @type {fileIndex} */ fileIndex
  /** @type {env} */ env

  /** @type {any} */ transfer

  polyfills = []

  dev = globalThis.dev
}

/** @type {System} */
export let system

if (inDesktopRealm) {
  globalThis.sys42 ??= {}
  merge(globalThis.sys42, merge(config, globalThis.sys42))
} else {
  globalThis.sys42 = getDesktopRealm().sys42
}

if (globalThis.sys42 && globalThis.sys42 instanceof System) {
  system = globalThis.sys42
} else {
  system = new System()
  if (globalThis.sys42) {
    const { env, ...rest } = globalThis.sys42
    Object.assign(system, rest)
    system.env = assignEnv(env)
  } else {
    system.env = assignEnv()
  }

  globalThis.sys42 = system
}

export function assignEnv(...args) {
  const out = {
    PWD: "/",
    USER: "anonymous",
    USERS_DIR: "/users",
  }

  for (const item of args) {
    Object.assign(out, item)
  }

  Object.defineProperty(out, "HOME", {
    get() {
      return `${this.USERS_DIR}/${this.USER}`
    },
  })

  return out
}

export function cwd() {
  return system.env.PWD
}
