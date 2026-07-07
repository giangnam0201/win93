/**
 * Set the classes on an element.
 *
 * @template {HTMLElement | SVGElement} T
 * @param {T} el
 * @param {string | string[] | { [key: string]: boolean }} val
 * @param {object} [options]
 * @param {boolean} [options.replaceClass]
 * @returns {T}
 */
export function setClasses(el, val, options) {
  if (Array.isArray(val)) {
    if (options?.replaceClass === false) el.classList.add(...val)
    else el.setAttribute("class", val.join(" "))
  } else if (typeof val === "string") {
    if (options?.replaceClass === false) el.classList.add(val)
    else el.setAttribute("class", val)
  } else {
    for (const [keys, value] of Object.entries(val)) {
      const op = value ? "add" : "remove"
      for (const key of keys.split(" ")) el.classList[op](key)
    }
  }

  return el
}
