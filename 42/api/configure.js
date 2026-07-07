import { isHashmapLike } from "../lib/type/any/isHashmapLike.js"
import { mergeWalk } from "../lib/type/object/merge.js"

/**
 * @template {Record<string, any>} T
 * @param {T[]} optionsList
 * @returns {Partial<T>}
 */
export function configure(...optionsList) {
  const config = {}
  if (optionsList.length === 0) return config

  const seen = new WeakMap()

  for (const options of optionsList) {
    if (isHashmapLike(options)) {
      seen.set(options, config)
      mergeWalk(config, options, seen)
    } else if (!(options == null || typeof options === "boolean")) {
      throw new TypeError(
        `Arguments must be objects, boolean or nullish: ${typeof options}`,
      )
    }
  }

  return config
}

/**
 * @template {Record<string, any>} T
 * @param {Record<string, any>} presets
 * @param {T[]} optionsList
 * @returns {Partial<T>}
 */
configure.preset = (presets, ...optionsList) =>
  configure(
    ...optionsList.map((options) => {
      if (typeof options === "string") {
        if (options in presets) return presets[options]
        throw new TypeError(`Unknown preset: ${options}`)
      } else if (isHashmapLike(options) && "preset" in options) {
        const { preset, ...rest } = options

        if (Array.isArray(preset)) {
          return configure(...preset.map((p) => presets[p]), rest)
        }

        return configure(presets[preset], rest)
      }

      return options
    }),
  )
