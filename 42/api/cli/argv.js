/* eslint-disable complexity */
import { configure } from "../configure.js"
import { allocate } from "../../lib/type/object/allocate.js"
import { locate } from "../../lib/type/object/locate.js"
import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { parseCommand } from "./parseCommand.js"
import { exists } from "../../lib/type/object/exists.js"

/**
 * @typedef {Partial<DEFAULTS>} ArgvOptions
 */

const DEFAULTS = {
  /** @type {keyof PRESETS} */
  preset: undefined,

  argsKey: "_",
  negateToBoolean: true,
  splitSmallOption: true,
  autoBoolean: true,
  autocast: true,

  /** @type {Function} */
  parseValue: JSON.parse,
  /** @type {string[] | Record<string, string[]>} */
  subcommands: undefined,

  aliases: {},
  presets: {},
  schema: {},
  count: [],
  globalOptions: [],
  typesDefaults: {
    array: [],
    boolean: true,
    integer: 0,
    null: null,
    number: 0,
    object: {},
    string: "",
  },
}

const PRESETS = {
  gnu: {
    schema: {
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
    aliases: { h: "help" },
    subcommands: {
      output: ["--version", "--help"],
    },
  },
  log: {
    schema: { verbose: { type: "number" } },
    count: ["verbose"],
    globalOptions: ["quiet"],
    aliases: { v: "verbose", q: "quiet" },
    presets: { quiet: { verbose: 0 } },
  },
}

export const _undefined = Symbol("argv.undefined")

const isType = Object.freeze({
  null: (val) => val === null,
  boolean: (val) => typeof val === "boolean",
  string: (val) => typeof val === "string",
  number: (val) => Number.isFinite(val),
  integer: (val) => Number.isInteger(val),
  array: (val) => Array.isArray(val),
  object: (val) =>
    val !== null && typeof val === "object" && !Array.isArray(val),
})

function castNumber(n) {
  if (Number.isNaN(n)) return 0
  return n
}

const castType = Object.freeze({
  null: () => null,
  boolean: (val) => (val == null ? true : Boolean(val)),
  string: (val) => (val == null ? "" : String(val)),
  number: (val) => castNumber(Number.parseFloat(val)),
  integer: (val) => castNumber(Number.parseInt(val)),
  array: (val) => val?.split(/\s*,\s*/) ?? [],
  object: (val) => {
    const out = {}
    for (const item of castType.array(val)) out[item] = true
    return out
  },
})

function autocast(config, val) {
  if (config.autocast && val) {
    if (val === "undefined") return _undefined

    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      const unquoted = val.slice(1, -1)
      try {
        return config.parseValue(unquoted)
      } catch {
        return unquoted
      }
    }

    try {
      return config.parseValue(val)
    } catch {}
  }

  return val
}

/**
 * Command line argument parsing.
 *
 * @param {string | string[]} args
 * @param {ArgvOptions} [options]
 * @returns {object}
 */
export function argv(args, options) {
  const config = configure.preset(PRESETS, DEFAULTS, options)

  if (!Array.isArray(args)) args = parseCommand(args)

  const {
    aliases,
    count,
    argsKey,
    negateToBoolean,
    presets,
    schema,
    splitSmallOption,
    typesDefaults,
  } = config

  const subcommands = []
  const cmdHashMap = {}

  if (Array.isArray(config.subcommands)) {
    subcommands.push(...config.subcommands)
  } else if (isHashmapLike(config.subcommands)) {
    for (const [key, val] of Object.entries(config.subcommands)) {
      for (let item of val) {
        if (item.startsWith("--")) item = item.slice(2)
        cmdHashMap[item] = !key || key === "." ? item : `${key}.${item}`
      }

      subcommands.push(...val)
    }
  }

  config.subcommands = subcommands

  for (const item of Object.keys(cmdHashMap)) {
    for (const [key, val] of Object.entries(aliases)) {
      if (val === item) subcommands.push((key.length > 1 ? "--" : "-") + key)
    }
  }

  const out = {}
  let obj = out
  obj[argsKey] = []

  function addOption(obj, key, value) {
    if (config.globalOptions.includes(key)) obj = out

    if (key in presets) {
      Object.assign(obj, presets[key])
      return
    }

    const isCount = count.includes(key)

    if (isCount && value === undefined) {
      const previous = locate(obj, key)
      value = previous === undefined ? 1 : previous + 1
    }

    if (key in schema) {
      const schemaType = schema[key]?.type

      if (value === undefined) {
        if (schema[key].default) {
          value = schema[key].default
        } else if (
          typesDefaults &&
          typeof typesDefaults === "object" &&
          schema[key].type &&
          schema[key].type in typesDefaults
        ) {
          value = typesDefaults[schema[key].type]
        }
      } else if (config.autocast && !isType[schemaType](value)) {
        value = castType[schemaType](value)
      }
    }

    if (config.autoBoolean && value === undefined) value = true
    if (value === _undefined) value = undefined

    if (!isCount && exists(obj, key)) {
      let previous = locate(obj, key)
      if (!Array.isArray(previous)) previous = [previous]
      previous.push(value)
      allocate(obj, key, previous)
    } else {
      allocate(obj, key, value)
    }
  }

  function addInput(arg) {
    let value = autocast(config, arg)
    if (config.autoBoolean && value === undefined) value = true
    if (value === _undefined) value = undefined
    obj[argsKey].push(value)
  }

  for (let i = 0, l = args.length; i < l; i++) {
    let arg = String(args[i])

    if (arg === "--" && args[i + 1]) {
      while (args[i + 1]) addInput(args[++i])
    } else if (subcommands.includes(arg)) {
      if (arg.startsWith("--")) arg = arg.slice(2)
      if (arg.startsWith("-")) arg = arg.slice(1)
      if (arg in aliases) arg = aliases[arg]

      if (arg in schema && schema[arg].type) {
        const value = castType[schema[arg].type]()
        if (arg in cmdHashMap) {
          allocate(out, cmdHashMap[arg], value)
        } else {
          out[arg] = value
        }
      } else {
        const value = { [argsKey]: [] }
        if (arg in cmdHashMap) {
          obj = locate(out, cmdHashMap[arg]) || value
          allocate(out, cmdHashMap[arg], obj)
        } else {
          obj = value
          out[arg] = obj
        }
      }
    } else if (arg.startsWith("-")) {
      let isLong = arg.startsWith("--")
      arg = arg.slice(isLong ? 2 : 1)

      if (!arg) {
        if (!isLong) addInput("-")
        continue
      }

      if (arg in aliases) {
        arg = aliases[arg]
        isLong = arg.length > 1
      }

      const eq = arg.indexOf("=")

      if (
        splitSmallOption &&
        !isLong &&
        arg.length > 1 &&
        arg.includes(".") === false
      ) {
        const isKeyValuePair = eq !== -1
        const list = (isKeyValuePair ? arg.slice(0, eq) : arg).split("")

        const value = isKeyValuePair
          ? autocast(config, arg.slice(eq + 1))
          : undefined

        for (let i = 0, l = list.length - 1; i < l; i++) {
          let item = list[i]
          if (item in aliases) item = aliases[item]
          addOption(obj, item)
        }

        let key = list.at(-1)
        if (key in aliases) key = aliases[key]

        if (isKeyValuePair || args[i + 1]?.startsWith("-")) {
          addOption(obj, key, value)
        } else {
          addOption(obj, key, autocast(config, args[i + 1]))
          i++
        }
        continue
      }

      if (eq === -1) {
        let value
        if (isLong && negateToBoolean && arg.startsWith("no-")) {
          value = false
          arg = arg.slice(3)
        } else if (schema[arg]?.type === "boolean") {
          value = true
        } else if (
          args[i + 1]?.startsWith("-") ||
          subcommands.includes(args[i + 1]) ||
          count.includes(arg)
        ) {
          value = undefined
        } else {
          i += 1
          value = autocast(config, args[i])
        }

        addOption(obj, arg, value)
      } else {
        addOption(obj, arg.slice(0, eq), autocast(config, arg.slice(eq + 1)))
      }
    } else {
      addInput(arg)
    }
  }

  return out
}
