import { JSON5 } from "../../formats/data/JSON5.js"
import { isGlob } from "../../lib/syntax/glob/isGlob.js"
import { argv } from "../cli/argv.js"
import { configure } from "../configure.js"
import { normalizeFilename } from "../fs/normalizeFilename.js"
import { decodeDesktopEntry } from "./decodeDesktopEntry.js"
import { expandEnvVariables } from "./expandEnvVariables.js"

/** @import { Os } from "../os.js" */

/** @type {Os} */
let os

export async function parseExec(command, globalOptions) {
  if (!command) throw new Error(`Invalid empty command`)

  os ??= (await import("../os.js")).os

  command = expandEnvVariables(command.trim(), os.env)

  const { _: posarg, ...commandFlags } = argv(command, {
    parseValue: JSON5.parse,
    schema: {
      inset: { type: "boolean" },
      clear: { type: "boolean" },
      resizable: { type: "boolean" },
      maximizable: { type: "boolean" },
      minimizable: { type: "boolean" },
      maximized: { type: "boolean" },
      dockable: { type: "boolean" },
      x: { type: "number" },
      y: { type: "number" },
      play: { type: "boolean" },
    },
    aliases: {
      w: "width",
      h: "height",
      p: "play",
    },
  })

  let [program, ..._] = posarg

  const builtins = globalOptions?.builtins
  const aliases = globalOptions?.aliases
  const shell = globalOptions?.shell
  const cwd = globalOptions?.cwd ?? shell?.cwd

  const flags = configure(commandFlags, globalOptions)
  delete flags.builtins
  delete flags.aliases

  // MARK: Programs
  // --------------

  if (aliases && program in aliases) program = aliases[program]

  if (builtins) {
    let cli
    if (program in builtins) cli = program
    else if (command in builtins) cli = command
    if (cli) {
      return {
        type: "builtin",
        _,
        flags,
        command,
        program: cli,
        run: (options) => builtins[cli]({ ...flags, _, cwd, ...options }),
      }
    }
  }

  await os.apps.ready
  const manifest = os.apps.getManifest(program)
  if (manifest) {
    return {
      type: "app",
      _,
      flags,
      manifest,
      get icon() {
        return os.apps.getAppIcon(manifest)
      },
      run: (options) =>
        os.apps.launch(manifest.name, { ...flags, _, cwd, ...options }),
    }
  }

  // MARK: Files
  // -----------

  let possiblePath = [program].concat(_).join(" ")
  if (!command.includes(possiblePath)) possiblePath = command

  if (possiblePath) {
    const path = normalizeFilename(possiblePath, {
      expandEnvVariables: false,
      preserveDir: true,
      cwd,
    })

    if (os.fileIndex.has(path)) {
      const run = path.endsWith(".desktop")
        ? async (options) => {
            const config = { ...flags, ...options }
            const ini = await decodeDesktopEntry(path)
            if (ini.Exec) return exec(ini.Exec, config)
            return os.apps.open(path, config)
          }
        : async (options) => os.apps.open(path, { ...flags, _, ...options })

      return {
        type: "path",
        _,
        flags,
        path,
        run,
      }
    }

    if (isGlob(path)) {
      const paths = os.fileIndex.glob(path)
      return {
        type: "paths",
        _,
        flags,
        paths,
        run: (options) => os.apps.open(paths, { ...flags, _, ...options }),
      }
    }
  }

  throw new Error(`Invalid command: ${command}`)
}

export async function exec(command, options) {
  const { run } = await parseExec(command, options)
  return run()
}

exec.parse = parseExec
