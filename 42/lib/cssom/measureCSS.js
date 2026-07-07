import { STYLES_CACHE } from "./cssVar.js"

let measureEl
const cssVariableCache = new Map()

function resolveElementValue(element, propertyName) {
  if (typeof propertyName !== "string") return
  const styles = STYLES_CACHE.has(element)
    ? STYLES_CACHE.get(element)
    : getComputedStyle(element)
  if (!STYLES_CACHE.has(element)) STYLES_CACHE.set(element, styles)
  const value = propertyName.startsWith("--")
    ? styles.getPropertyValue(propertyName)
    : styles[propertyName]
  return { value, id: propertyName }
}

function resolveVariableValue(name, root) {
  const variable = name.startsWith("--") ? name : `--${name}`
  return {
    value: `var(${variable})`,
    cacheKey: `${variable}|${root.localName}`,
    id: variable.slice(2),
  }
}

function normalizeArgs(name, optionsOrProperty, options) {
  const isEl = name instanceof Element
  const isPropStr = typeof optionsOrProperty === "string"
  return {
    element: isEl ? name : undefined,
    propertyName: isEl ? (isPropStr ? optionsOrProperty : undefined) : name,
    config: isEl && isPropStr ? (options ?? {}) : optionsOrProperty,
  }
}

/**
 * @typedef {{
 *   live?: boolean
 *   signal?: AbortSignal
 *   cache?: boolean
 *   root?: Element
 * }} MeasureCSSOptions
 *
 * @typedef {{
 *   element: HTMLDivElement,
 *   value: number,
 *   forget: () => void
 * }} MeasureCSSLiveResult
 */

/**
 * @overload
 * @param {Element} nameOrElement
 * @param {string} optionsOrProperty
 * @param {MeasureCSSOptions & {live: true}} options
 * @returns {MeasureCSSLiveResult}
 */
/**
 * @overload
 * @param {Element} nameOrElement
 * @param {string} optionsOrProperty
 * @param {MeasureCSSOptions} [options]
 * @returns {number}
 */
/**
 * @overload
 * @param {string} nameOrElement
 * @param {MeasureCSSOptions & {live: true}} optionsOrProperty
 * @returns {MeasureCSSLiveResult}
 */
/**
 * @overload
 * @param {string} nameOrElement
 * @param {MeasureCSSOptions} [optionsOrProperty]
 * @returns {number}
 */
/**
 * Resolves CSS variable or property with optional caching and numeric parsing.
 *
 * @param {Element | string} nameOrElement
 * @param {string | MeasureCSSOptions} [optionsOrProperty]
 * @param {MeasureCSSOptions} [options]
 * @returns {number | MeasureCSSLiveResult}
 */
export function measureCSS(nameOrElement, optionsOrProperty = {}, options) {
  const { element, propertyName, config } = normalizeArgs(
    nameOrElement,
    optionsOrProperty,
    options,
  )

  if (!measureEl && !config.root) {
    measureEl = document.createElement("div")
    measureEl.id = "measures"
    measureEl.style.cssText = `position:absolute;inset:0;opacity:0;pointer-events:none;`
    document.documentElement.append(measureEl)
  }

  const { cache = true, live = false, root = measureEl } = config

  const res = element
    ? resolveElementValue(element, propertyName)
    : resolveVariableValue(propertyName, root)

  if (!res || res.value === undefined) return

  if (!live && cache && res.cacheKey && cssVariableCache.has(res.cacheKey)) {
    const cached = cssVariableCache.get(res.cacheKey)
    return Number.parseFloat(cached)
  }

  const temp = document.createElement("div")
  if (live) temp.id = `measure--${res.id}`
  temp.style.cssText = `position:absolute;opacity:0;pointer-events:none;width:${res.value};`
  root.append(temp)

  const styles = STYLES_CACHE.has(temp)
    ? STYLES_CACHE.get(temp)
    : getComputedStyle(temp)
  if (!STYLES_CACHE.has(temp)) STYLES_CACHE.set(temp, styles)

  config.signal?.addEventListener("abort", () => {
    STYLES_CACHE.delete(temp)
    temp.remove()
  })

  if (live) {
    return {
      element: temp,
      get value() {
        return Number.parseFloat(styles.width)
      },
      forget: () => {
        STYLES_CACHE.delete(temp)
        temp.remove()
      },
    }
  }

  const finalValue = styles.width
  temp.remove()
  if (cache && res.cacheKey) cssVariableCache.set(res.cacheKey, finalValue)
  return Number.parseFloat(finalValue)
}
