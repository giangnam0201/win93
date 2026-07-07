/* eslint-disable max-depth */
import { Canceller } from "../../../lib/class/Canceller.js"
import { Emitter } from "../../../lib/class/Emitter.js"
import { cssVar } from "../../../lib/cssom/cssVar.js"
import { untilCSSVar } from "../../../lib/cssom/untilCSSVar.js"
import { until } from "../../../lib/event/on.js"
import { getStemname } from "../../../lib/syntax/path/getStemname.js"
import { replaceExtname } from "../../../lib/syntax/path/replaceExtname.js"
import { untilConnected } from "../../../lib/type/element/untilConnected.js"
import { merge } from "../../../lib/type/object/merge.js"
import { defer } from "../../../lib/type/promise/defer.js"
import { configure } from "../../configure.js"
import { fileIndex } from "../../fileIndex.js"
import { fs } from "../../fs.js"
import { normalizeFilename } from "../../fs/normalizeFilename.js"
import {
  applyCursorPolyfill,
  resetCursorPolyfill,
} from "../../gui/applyCursorPolyfill.js"
import { loadText } from "../../load/loadText.js"
import { ConfigFile } from "../ConfigFile.js"
import { pixelFontFix } from "./themesManager/pixelFontFix.js"
import {
  getThemeSlot,
  normalizeThemeOverrides,
  pickPreservedThemeSlotProperties,
} from "./themesManager/slots.js"

/** @import { FolderComponent } from "../../../ui/media/folder.js" */

const _EVENTS = Symbol.for("Emitter.EVENTS")

const DEFAULTS = globalThis.sys42?.options?.themes ?? {}

const isSWControlled = Boolean(globalThis.navigator?.serviceWorker?.controller)

export const WALLPAPER_STYLES = {
  Center: "no-repeat 50% 50% / auto",
  Tile: "repeat 0% 0% / auto",
  Stretch: "no-repeat 50% 50% / 100% 100%",
  Fit: "no-repeat 50% 50% / contain",
  Fill: "no-repeat 50% 50% / cover",
}

// MARK: Theme
// -----------

class Theme extends Emitter {
  /**
   * @param {ThemesManager} manager
   * @param {string} path
   * @param {any} options
   * @param {Record<string, string>} [preservedProperties]
   */
  constructor(manager, path, options, preservedProperties) {
    super()
    if (!fileIndex.has(path)) {
      throw new Error(`Theme stylesheet missing: ${path}`)
    }
    this.path = path
    this.manager = manager
    this.name = getStemname(this.path).replace(".theme", "")
    this.themeClass = `theme--${this.name}`
    this.modulePath = replaceExtname(this.path, ".js")
    this.hasModule = fileIndex.has(this.modulePath)
    this.moduleMissing = false
    this.ready = defer()
    this.init(options, preservedProperties)
  }

  async init(options, preservedProperties) {
    this.config = this.manager.getThemeConfig(
      this.name,
      options,
      preservedProperties,
    )
    this.properties = { ...this.config.properties }
    return this.ready
  }

  async importModule() {
    if (this.module || !fileIndex.has(this.modulePath)) return
    try {
      this.module = await import(this.modulePath)
      this.hasModule = true
    } catch (cause) {
      throw new Error(`Theme module error: ${this.modulePath}`, { cause })
    }
  }

  generateCSS() {
    return `\
${this.manager.prefix}
/* <theme> */

@import url("${this.path}");
${this.generateProperties()}
/* </theme> */
${this.manager.suffix}`
  }

  getThemePlans() {
    return this.module?.getThemePlans?.(this)
  }

  generateProperties() {
    if (!this.properties) return ""
    const entries = Object.entries(this.properties)
    if (entries.length === 0) return ""
    let out = `:root:not(.themed), :root.themed {\n`
    for (const [key, val] of entries) {
      out += `  ${key}: ${val};\n`
    }
    out += `}\n`
    return out
  }

  async refreshTheme() {
    if (this.module?.refreshTheme) {
      await this.module?.refreshTheme(this)
      this.propertiesStyleEl.textContent = this.generateProperties()
    }
  }

  async applyProperties() {
    if (!this.propertiesStyleEl) {
      this.propertiesStyleEl = document.createElement("style")
      this.propertiesStyleEl.className = `system-theme system-theme--${this.name}--properties`
      this.manager.endPlaceholder.after(this.propertiesStyleEl)
    }

    if (
      this.manager.value.overrides.wallpaper &&
      this.properties &&
      "--desktop-bg" in this.properties
    ) {
      cssVar.set("--desktop-bg", false)
    }

    if (this.module?.refreshTheme) await this.module?.refreshTheme(this)
    this.propertiesStyleEl.textContent = this.generateProperties()
    resetCursorPolyfill()
    requestIdleCallback(() => applyCursorPolyfill(), { timeout: 5000 })

    this.emit("change")

    // const keys = Object.keys(this.properties) //
    //   .filter((key) => key.startsWith("--icon"))

    for (const folderEl of /** @type {NodeListOf<FolderComponent>} */ (
      document.querySelectorAll("ui-folder")
    )) {
      folderEl.refresh()
    }
  }

  async #importProperties() {
    const props = await this.module.configureTheme(this)
    this.moduleProperties = props ? { ...props } : {}
    if (props) {
      const { overrides } = this.manager.value

      // Preserve current values for override-false slots
      const preserved = {}
      for (const [key, val] of Object.entries(this.properties)) {
        const slot = getThemeSlot(key)
        if (slot && overrides[slot] === false) {
          preserved[key] = val
        }
      }

      // Slot values are managed globally by themesManager.value.slotValues
      const configProps = {}
      if (this.config.properties) {
        for (const [key, val] of Object.entries(this.config.properties)) {
          const slot = getThemeSlot(key)
          if (!slot) {
            configProps[key] = val
          }
        }
      }

      this.properties = Object.assign(props, configProps, preserved)
    }
  }

  async configure(options) {
    if (options) merge(this.config, options)
    if (this.loaded) {
      if (this.module?.configureTheme) {
        await this.#importProperties()
        if (this.properties) await this.applyProperties()
      }
    } else {
      await this.load()
    }
  }

  loaded = false
  async load(el = document.documentElement) {
    const { cancel, signal } = new Canceller()
    this.cancel = cancel

    await this.importModule()
    if (signal.aborted) return false
    if (this.module?.configureTheme) {
      await this.#importProperties()
      if (signal.aborted) return false
    }

    await this.applyProperties()
    if (signal.aborted) return false

    const styleEl = document.createElement("link")
    styleEl.rel = "stylesheet"
    styleEl.className = `system-theme system-theme--${this.name}`
    styleEl.href = this.path
    this.styleEl = styleEl

    this.manager.endPlaceholder.before(styleEl)

    el.classList.toggle("themed", true)
    el.classList.toggle(this.themeClass, false)
    el.classList.toggle(this.themeClass, true)

    // console.log(1, this.name, el.className)

    try {
      const res = await untilCSSVar("--theme", this.name, {
        signal,
        element: el,
      })
      if (res === false) {
        // console.log("--------", this.name, el.className)
        this.unload(el)
        return false
      }
    } catch (err) {
      console.log(err)
      // console.log("xxxxxxxx", this.name, el.className)
      this.unload(el)
      return false
    }

    pixelFontFix.font = undefined

    this.loaded = true
    this.ready.resolve()
    return true
  }

  unload(el = document.documentElement, options) {
    // console.warn("-- unload --", this.name)
    this.cancel?.()
    this.styleEl?.remove()
    this.propertiesStyleEl?.remove()
    if (options?.keepClassName !== true) {
      el.classList.toggle(`theme--${this.name}`, false)
    }
  }

  destroy(options) {
    this.unload(undefined, options)
    if (_EVENTS in this) {
      // @ts-ignore
      this.emit("destroy", this).off("*")
      delete this[_EVENTS]
    }
  }
}

// MARK: ThemesManager
// -------------------

class ThemesManager extends ConfigFile {
  async setup() {
    const base = location.pathname.endsWith('/') ? location.pathname : location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
    let [originalCSS, userCSS, styleEl] = await Promise.all([
      loadText(base + "style.css?original"),
      isSWControlled ? loadText(base + "style.css") : undefined,
      /** @type {HTMLLinkElement} */ (
        /** @type {unknown} */ (untilConnected(`link[href^='${base}style.css']`))
      ),
    ])

    userCSS ??= originalCSS

    const prefixIdx = originalCSS.indexOf("/* <theme> */")
    const prefix = originalCSS.slice(0, prefixIdx)
    const suffixIdx = userCSS.indexOf("/* </theme> */")
    const suffix = suffixIdx === -1 ? "" : userCSS.slice(suffixIdx + 14)

    this.prefix = prefix
    this.suffix = suffix
    this.styleEl = styleEl
    this.styleEl.className = "system-theme"

    this.startPlaceholder = document.createComment(" <theme> ")
    this.styleEl.before(this.startPlaceholder)
    this.endPlaceholder = document.createComment(" </theme> ")
    this.styleEl.after(this.endPlaceholder)

    this.value.overrides = normalizeThemeOverrides(this.value.overrides)
    if (
      this.value.slotValues == null ||
      typeof this.value.slotValues !== "object"
    ) {
      this.value.slotValues = {}
    }

    if (!isSWControlled && this.value.current) {
      if (!this.styleEl.sheet) await until(styleEl, "load")
      await this.preview(this.value.current, undefined, true)
    }
  }

  #addPrefixAndSuffix() {
    const prefixStyleEl = document.createElement("style")
    prefixStyleEl.className = "system-theme--prefix"
    prefixStyleEl.textContent = this.prefix

    const suffixStyleEl = document.createElement("style")
    suffixStyleEl.className = "system-theme--suffix"
    suffixStyleEl.textContent = this.suffix

    this.startPlaceholder.before(prefixStyleEl)
    this.endPlaceholder.after(suffixStyleEl)

    setTimeout(() => requestIdleCallback(() => this.styleEl.remove()), 1000)
  }

  #removeCurrent() {
    for (const theme of this.#pendingThemes) theme.cancel()
    this.current?.cancel?.()
    const el = document.documentElement
    if (this.current) {
      for (const item of el.classList) {
        if (item.startsWith("theme--") && item !== this.current.themeClass) {
          el.classList.remove(item)
        }
      }
    }
  }

  /** @type {Theme} */
  current
  /** @type {Set<Theme>} */
  #pendingThemes = new Set()
  #generated = false
  #appearanceSession

  getThemeConfig(name, options, preservedProperties) {
    return configure(
      this.value.options?.[name],
      { properties: preservedProperties },
      options,
    )
  }

  getPreservedPreviewProperties(sourceProperties = this.current?.properties) {
    const preserved = pickPreservedThemeSlotProperties(
      sourceProperties,
      this.value.overrides,
    )
    for (const [slot, val] of Object.entries(this.value.slotValues ?? {})) {
      if (this.value.overrides?.[slot] !== false) continue
      if (typeof val !== "object" || val == null) continue
      for (const [key, item] of Object.entries(val)) {
        if (getThemeSlot(key) !== slot) continue
        preserved[key] = item
      }
    }
    return preserved
  }

  setOverrides(overrides) {
    const prev = this.value.overrides
    this.value.overrides = normalizeThemeOverrides(overrides)

    const theme = this.current
    if (!theme?.loaded) return

    let changed = false

    for (const slot of Object.keys(this.value.overrides)) {
      const nowTrue = this.value.overrides[slot]
      const wasTrue = prev[slot]
      if (nowTrue === wasTrue) continue

      if (nowTrue) {
        if (slot === "wallpaper") cssVar.set("--desktop-bg", false)
        // false → true: switch to theme module values
        for (const key of Object.keys(theme.properties)) {
          if (getThemeSlot(key) !== slot) continue
          if (theme.moduleProperties?.[key] === undefined) {
            delete theme.properties[key]
          } else {
            theme.properties[key] = theme.moduleProperties[key]
          }
          changed = true
        }
      } else {
        this.value.slotValues ??= {}
        this.value.slotValues[slot] ??= {}

        const slotValues = this.value.slotValues[slot]
        let restored = false

        for (const [key, val] of Object.entries(slotValues)) {
          if (getThemeSlot(key) !== slot) continue
          theme.properties[key] = val
          changed = true
          restored = true
        }

        if (!restored) {
          for (const [key, val] of Object.entries(theme.properties)) {
            if (getThemeSlot(key) !== slot) continue
            slotValues[key] = val
            changed = true
            restored = true
          }
        }

        if (!restored && slot === "wallpaper") {
          const value = cssVar.get("--desktop-bg")
          if (value != null) {
            slotValues["--desktop-bg"] = value
            theme.properties["--desktop-bg"] = value
            changed = true
          }
        }
      }
    }

    if (changed) theme.applyProperties()
  }

  updateCurrentProperty(property, value) {
    const theme = this.current
    if (!theme) return
    theme.properties[property] = value
    const slot = getThemeSlot(property)
    if (slot) {
      this.value.slotValues ??= {}
      this.value.slotValues[slot] ??= {}
      this.value.slotValues[slot][property] = value
      if (theme.config.properties) {
        delete theme.config.properties[property]
        if (Object.keys(theme.config.properties).length === 0) {
          delete theme.config.properties
        }
      }
    } else {
      theme.config.properties ??= {}
      theme.config.properties[property] = value
    }
    return theme
  }

  beginAppearanceSession() {
    this.#appearanceSession = {
      current: this.value.current,
      overrides: { ...this.value.overrides },
      options: configure(this.value.options),
      slotValues: configure(this.value.slotValues),
    }
  }

  async applyAppearanceSession() {
    await this.apply()
    this.#appearanceSession = undefined
  }

  async cancelAppearanceSession() {
    const session = this.#appearanceSession
    this.#appearanceSession = undefined
    if (!session) return this.revert()
    this.value.current = session.current
    this.value.options = session.options
    this.value.slotValues = session.slotValues
    this.value.overrides = normalizeThemeOverrides(session.overrides)
    await this.revert()
  }

  async preview(path, options, init) {
    if (!init) await this.ready
    path = normalizeFilename(path)
    // console.log(`*************** ${path.split("/").pop()} ***************`)

    if (this.value.overrides.wallpaper) {
      cssVar.set("--desktop-bg", false)
    }

    const preservedProperties = this.getPreservedPreviewProperties()

    this.#removeCurrent()

    if (this.current?.path === path) {
      this.#pendingThemes.add(this.current)
      await this.current.init(options, preservedProperties)
      await this.current.configure()
      await this.current.applyProperties()
      /*  */
      document.documentElement.classList.toggle("themed", true)
      document.documentElement.classList.toggle(this.current.themeClass, false)
      document.documentElement.classList.toggle(this.current.themeClass, true)
      /*  */
      this.#pendingThemes.delete(this.current)
      return this.current
    }

    const theme = new Theme(this, path, options, preservedProperties)
    this.#pendingThemes.add(theme)
    const res = await theme.load()
    this.#pendingThemes.delete(theme)
    if (res === false) return false

    this.current?.destroy?.({
      keepClassName: this.current?.name === theme.name,
    })

    if (this.#generated === false) {
      this.#addPrefixAndSuffix()
      this.#generated = true
    }

    this.current = theme
    return theme
  }

  async setElement(el, path, options) {
    await this.ready
    path = normalizeFilename(path)
    const theme = new Theme(this, path, options)
    console.log(el)
    await theme.load(el)
  }

  async apply(path, options) {
    if (path) await this.preview(path, options)
    if (this.current?.path) {
      this.value.current = this.current.path
      this.value.options ??= {}
      const config = configure(this.current.config)
      if (config.properties) {
        for (const key of Object.keys(config.properties)) {
          if (getThemeSlot(key)) delete config.properties[key]
        }
        if (Object.keys(config.properties).length === 0) {
          delete config.properties
        }
      }
      this.value.options[this.current.name] = config
      const generatedCSS = await this.current.generateCSS()
      await Promise.all([
        this.save(),
        fs
          .writeText("~/config/style.css", generatedCSS)
          .then(() => fs.link("~/config/style.css", "/style.css")),
      ])
    }
  }

  async revert() {
    const properties = this.current?.config?.properties
    if (properties) {
      for (const key of Object.keys(properties)) cssVar.set(key, false)
    }
    await this.preview(this.value.current)
  }
}

export const themesManager = new ThemesManager("config/themes.json5", DEFAULTS)
themesManager.init()
