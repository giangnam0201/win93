const resolveStyleEl = document.createElement("div")
resolveStyleEl.id = "resolve-style"
resolveStyleEl.style.cssText = `position: absolute; pointer-events: none; opacity: 0;`
document.body.append(resolveStyleEl)
const resolveStyleElStyle = getComputedStyle(resolveStyleEl)

export const THEME_OVERRIDE_DEFAULTS = {
  wallpaper: true,
  colors: true,
  cursors: true,
  sounds: true,
}

/**
 * @param {string} property
 * @returns {"wallpaper" | "colors" | "cursors" | null}
 */
export function getThemeSlot(property) {
  if (property === "--desktop-bg") return "wallpaper"
  if (property.startsWith("--cursor-")) return "cursors"
  if (!property.startsWith("--")) return null
  return "colors"
}

/**
 * @param {Record<string, boolean> | undefined} overrides
 * @returns {Record<string, boolean>}
 */
export function normalizeThemeOverrides(overrides) {
  return {
    wallpaper: overrides?.wallpaper !== false,
    colors: overrides?.colors !== false,
    cursors: overrides?.cursors !== false,
    sounds: overrides?.sounds !== false,
  }
}

/**
 * @param {Record<string, string> | undefined} properties
 * @param {Record<string, boolean> | undefined} overrides
 * @returns {Record<string, string>}
 */
export function pickPreservedThemeSlotProperties(properties, overrides) {
  /** @type {Record<string, string>} */
  const out = {}

  if (!properties) return out

  overrides = normalizeThemeOverrides(overrides)

  const slots = []

  for (const [key, val] of Object.entries(properties)) {
    const slot = getThemeSlot(key)
    if (!slot) continue
    if (overrides[slot] === false) {
      slots.push(slot)
      if (slot === "wallpaper") {
        resolveStyleEl.style.cssText = `background: ${val}`
        out[key] = resolveStyleElStyle.background
      } else if (slot === "colors") {
        resolveStyleEl.style.cssText = `color: ${val}`
        out[key] = resolveStyleElStyle.color
      } else if (slot === "cursors") {
        resolveStyleEl.style.cssText = `cursor: ${val}`
        out[key] = resolveStyleElStyle.cursor
      } else {
        out[key] = val
      }
    }
  }

  for (const [key, val] of Object.entries(overrides)) {
    if (val === false && !slots.includes(key)) {
      if (key === "wallpaper") {
        resolveStyleEl.style.cssText = `background: var(--desktop-bg)`
        out["--desktop-bg"] = resolveStyleElStyle.background
      }
      // TODO: find solutions for colors and cursors
    }
  }

  return out
}

/**
 * @param {Record<string, string> | undefined} themeProperties
 * @param {Record<string, string> | undefined} preservedProperties
 * @param {Record<string, boolean> | undefined} overrides
 * @returns {Record<string, string>}
 */
export function mergeThemeSlotProperties(
  themeProperties,
  preservedProperties,
  overrides,
) {
  const out = {
    ...themeProperties,
  }

  if (!preservedProperties) return out

  const normalized = normalizeThemeOverrides(overrides)

  for (const key of Object.keys(out)) {
    const slot = getThemeSlot(key)
    if (!slot) continue
    if (normalized[slot] === false && key in preservedProperties) {
      out[key] = preservedProperties[key]
    }
  }

  for (const [key, val] of Object.entries(preservedProperties)) {
    const slot = getThemeSlot(key)
    if (!slot) continue
    if (normalized[slot] === false && !(key in out)) {
      out[key] = val
    }
  }

  return out
}
