export function appendCSS(cssText, options) {
  if (cssText && typeof cssText !== "string") {
    options = cssText
    cssText = ""
  }

  const el = document.createElement("style")
  el.className = "js-loaded"
  if (options?.id) el.id = options.id
  el.textContent = options?.disabled ? "" : cssText
  document.head.append(el)

  const out = {
    el,
    update(val) {
      cssText = val
      el.textContent = cssText
      return this
    },
    enable() {
      el.textContent = cssText
      return this
    },
    disable() {
      el.textContent = ""
      return this
    },
    destroy() {
      el.remove()
      options?.signal?.removeEventlistener?.("abort", out.destroy)
      return this
    },
  }

  options?.signal?.addEventListener?.("abort", out.destroy)

  return out
}

export function css(strings, ...substitutions) {
  let out = strings[0]
  for (let i = 0, l = substitutions.length; i < l; i++) {
    console.log(substitutions[i])
    out += substitutions[i] + strings[i + 1]
  }

  return appendCSS(out)
}
