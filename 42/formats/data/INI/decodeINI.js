import { configure } from "../../../api/configure.js"
import { arrify } from "../../../lib/type/any/arrify.js"
import { locate } from "../../../lib/type/object/locate.js"
import { allocate } from "../../../lib/type/object/allocate.js"
import { parseINI } from "./parseINI.js"

const DEFAULT = {
  parseValue: JSON.parse,
  delimiters: [".", "\\"],
  formatKey: false,
  formatSection: false,
}

export function decodeINI(str, options) {
  const config = configure(DEFAULT, options)
  const { parseValue } = config
  const out = {}

  const sectionOptions = { delimiters: config.delimiters }
  const keyOptions = { delimiters: "" }
  const delimiters = /** @type {string[]} */ (arrify(config.delimiters))

  let key
  let array
  let current = out

  for (const { type, buffer } of parseINI(str, delimiters)) {
    if (key || array) {
      if (type === "value") {
        let val
        try {
          val = parseValue(buffer)
        } catch {
          val = buffer
        }

        if (array) array.push(val)
        else {
          allocate(current, key, val, keyOptions)
          key = undefined
        }

        continue
      } else if (key) {
        allocate(current, key, true, keyOptions)
      }
    }

    if (type === "key") {
      if (array) array = undefined
      key = config.formatKey ? config.formatKey(buffer) : buffer
      continue
    }

    if (type === "section") {
      let sectionName = config.formatSection
        ? config.formatSection(buffer)
        : buffer
      sectionName = sectionName.replaceAll(".__proto__", "")
      current = locate(out, sectionName, delimiters) ?? {}
      allocate(out, sectionName, current, sectionOptions)
      continue
    }

    if (type === "array") {
      array = locate(current, buffer, delimiters) ?? []
      if (!Array.isArray(array)) array = [array]
      allocate(current, buffer, array, keyOptions)
      continue
    }
  }

  if (key) {
    allocate(current, key, true, keyOptions)
  }

  return out
}
