/* eslint-disable unicorn/consistent-function-scoping */
const enumerable = true

export const pointer = {
  /** @type {boolean} */ isTouch: undefined,
  /** @type {boolean} */ isStylus: undefined,
  /** @type {boolean} */ isController: undefined,
  /** @type {boolean} */ isMouse: undefined,
  /** @type {boolean} */ isFine: undefined,
  /** @type {boolean} */ canHover: undefined,
  /** @type {string} */ type: undefined,
}

const listeners = new Set()
let mediaQuery
let changeHandler

Object.defineProperties(pointer, {
  on: {
    enumerable: false,
    get: () => (event, fn, options) => {
      if (event !== "change" || typeof fn !== "function") return
      listeners.add(fn)
      if (!mediaQuery) {
        const signal = options?.signal
        signal?.addEventListener("abort", () => listeners.delete(fn))
        mediaQuery = matchMedia("(hover: none) and (pointer: coarse)")
        changeHandler = () => {
          for (const fn of listeners) fn(pointer)
        }

        mediaQuery.addEventListener("change", changeHandler, { signal })
      }
    },
  },
  off: {
    enumerable: false,
    get: () => (event, fn) => {
      if (event !== "change") return

      if (!event) listeners.clear()
      else if (fn) listeners.delete(fn)
      else listeners.clear()

      if (listeners.size === 0 && mediaQuery) {
        mediaQuery.removeEventListener("change", changeHandler)
        mediaQuery = undefined
        changeHandler = undefined
      }
    },
  },

  isTouch: {
    enumerable,
    get: () => matchMedia("(hover: none) and (pointer: coarse)").matches,
  },
  isStylus: {
    enumerable,
    get: () => matchMedia("(hover: none) and (pointer: fine)").matches,
  },
  isController: {
    enumerable,
    get: () => matchMedia("(hover: hover) and (pointer: coarse)").matches,
  },
  isMouse: {
    enumerable,
    get: () => matchMedia("(hover: hover) and (pointer: fine)").matches,
  },

  isFine: {
    enumerable,
    get: () => matchMedia("(pointer: fine)").matches,
  },
  canHover: {
    enumerable,
    get: () => matchMedia("(hover: hover)").matches,
  },

  type: {
    enumerable,
    get: () => {
      if (pointer.isMouse) return "mouse"
      if (pointer.isStylus) return "stylus"
      if (pointer.isTouch) return "touch"
      if (pointer.isController) return "controller"
      return "mouse"
    },
  },
})
