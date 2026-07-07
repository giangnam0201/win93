/* eslint-disable complexity */
import "../../ui/media/picto.js"
import { autoAnchor } from "../../lib/dom/autoAnchor.js"
import { listenEventMap } from "../../lib/event/on.js"
import { getDesktopRealm } from "../env/realm/getDesktopRealm.js"
import { inApple } from "../env/browser/inApple.js"
import { initCursorPolyfill } from "./applyCursorPolyfill.js"
import {
  setFractionProp,
  stepsNumericValue,
} from "../../lib/type/element/setControlData.js"

/** @import { Os } from "../os.js" */

autoAnchor()

// MARK: Shortcuts
// ---------------

// TODO: add options to core.js to disable palette
// TODO: add options to core.js to disable dialog close

/** @type {Os} */
let os
const ctrlKey = inApple ? "metaKey" : "ctrlKey"

document.addEventListener(
  "keydown",
  (e) => {
    const key = e.key.toLowerCase()

    if (e.altKey && key === "tab") {
      e.preventDefault()
      os ??= getDesktopRealm().sys42
      if (!os) return
      return void os.workspaces?.current?.cycleDialogUp()
    }

    if (e.metaKey && e.altKey) {
      e.preventDefault()
      os ??= getDesktopRealm().sys42
      if (!os) return
      return void os?.showCommandPalette?.({
        mode: "apps",
      })
    }

    if (e[ctrlKey]) {
      if (key === "p") {
        e.preventDefault()
        os ??= getDesktopRealm().sys42
        if (!os) return
        return void os?.showCommandPalette?.({
          mode: e.shiftKey ? "apps" : "files",
        })
      }
    }

    if (
      e.ctrlKey &&
      (key === "q" || key === "k") /* ||
      (e.altKey && key === "w") */
    ) {
      e.preventDefault()
      os ??= getDesktopRealm().sys42
      if (!os) return
      for (const dialogEl of os.dialog.tracker) {
        if (dialogEl.active) return void dialogEl.close()
      }
    }
  },
  { capture: true },
)

// MARK: CSS polyfills
// -------------------

if (document.readyState === "complete") initCursorPolyfill()
else window.addEventListener("load", initCursorPolyfill)

// MARK: Controls
// --------------

let forgetWheel
// let forgetMotionless
// let motionlessTimerId

const numericSelector = 'input:is([type="range"],[type="number"])'

listenEventMap(
  // Add range css prop
  {
    "load || ui.update"() {
      for (const target of /** @type {NodeListOf<HTMLInputElement>} */ (
        document.querySelectorAll(numericSelector)
      )) {
        setFractionProp(target)
      }
    },
  },
  {
    selector: numericSelector,
    capture: true,
    input(e, target) {
      setFractionProp(target)
    },
  },

  // // Disable css transition while changing numeric inputs
  // // Usefull for focusring, tooltip...
  // {
  //   selector: numericSelector + ":not([data-preserve-transition])",
  //   input() {
  //     forgetMotionless ??= setTemp(document.documentElement, {
  //       class: { "transition-false": true },
  //     })
  //     clearTimeout(motionlessTimerId)
  //     motionlessTimerId = setTimeout(() => {
  //       forgetMotionless()
  //       forgetMotionless = undefined
  //     }, 300)
  //   },
  // },

  // Add increment/decrement on mousewheel
  {
    "selector": numericSelector,
    "capture": true,
    "blur"() {
      forgetWheel?.()
    },
    "focus"(e, target) {
      forgetWheel = listenEventMap({
        passive: false,
        wheel({ deltaY }) {
          if (target === document.activeElement && target.matches(":hover")) {
            stepsNumericValue(target, -deltaY)
            return false
          }
        },
      })
    },

    // Add reset to default actions
    // TODO: debug "Delete" not working
    "dblclick || contextmenu || Delete"(e, target) {
      const { resetable } = target.dataset
      if (
        target.type === "number" ||
        resetable === "false" ||
        target.dataset.audioParam
      ) {
        return
      }
      if (resetable && resetable !== e.type) return
      const value = target.getAttribute("value")
      if (value === "" || value === null) return
      const number = Number(value)
      if (!Number.isFinite(number)) return
      target.valueAsNumber = number
      target.dispatchEvent(new Event("input", { bubbles: true }))
      target.dispatchEvent(new Event("change", { bubbles: true }))
      return false
    },
  },

  // Prevent label selection on double click
  // @src https://stackoverflow.com/a/43321596
  {
    selector: "label",
    mousedown(e) {
      if (e.detail > 1) e.preventDefault()
    },
  },
)
