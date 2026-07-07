import { locate } from "../../lib/type/object/locate.js"

export function expandEnvVariables(str, env, status = 0) {
  return str
    .replaceAll(/^~/g, () => env.HOME)
    .replaceAll(/\$(\?|[\w.]+)|\${([^}]+)}/g, (_, a, b) => {
      const name = a || b

      if (name in env) return env[name]

      switch (name) {
        case "?":
          return status
        default:
          return locate(env, name) ?? ""
      }
    })
}
