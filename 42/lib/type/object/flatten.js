/**
 * @param {any} obj
 * @param {string | {array?: boolean, delimiter?: string}} [options]
 * @param {string} [prefix]
 */
export function flatten(obj, options, prefix = "") {
  const out = /** @type {[string, any][]} */ ([])

  if (typeof options === "string") options = { delimiter: options }
  const delimiter = options?.delimiter ?? "."

  for (const [key, val] of Object.entries(obj)) {
    const pre = prefix.length > 0 ? prefix + delimiter : ""

    if (
      val &&
      typeof val === "object" &&
      (options?.array === true ? true : !Array.isArray(val))
    ) {
      const res = flatten(val, options, pre + key)
      if (res.length > 0) {
        out.push(...res)
        continue
      }
    }

    out.push([pre + key, val])
  }

  return out
}

flatten.entries = (obj, delimiter = ".", cb, prefix = "", out = []) => {
  const pre = prefix.length > 0 ? prefix + delimiter : ""

  if (!cb) {
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const prevLen = out.length
        flatten.entries(val, delimiter, cb, pre + key, out)
        if (out.length > prevLen) continue
      }

      out.push([pre + key, val])
    }

    return out
  }

  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const prevLen = out.length
      flatten.entries(val, delimiter, cb, pre + key, out)
      if (out.length > prevLen) continue
    }

    cb(key, val, obj, pre)
  }
}

flatten.keys = (obj, delimiter = ".", cb, prefix = "", out = []) => {
  const pre = prefix.length > 0 ? prefix + delimiter : ""

  if (!cb) {
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const prevLen = out.length
        flatten.keys(val, delimiter, cb, pre + key, out)
        if (out.length > prevLen) continue
      }

      out.push(pre + key)
    }

    return out
  }

  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const prevLen = out.length
      flatten.keys(val, delimiter, cb, pre + key, out)
      if (out.length > prevLen) continue
    }

    cb(key, val, obj, pre)
  }
}
