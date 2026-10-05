import { distribute } from "../type/object/distribute.js"
import { ensureElement } from "../type/element/ensureElement.js"
import { Canceller } from "../class/Canceller.js"
import { ensureScopeSelector } from "../dom/ensureScopeSelector.js"
import { queueTask } from "../timing/queueTask.js"
import { ensureFocusable } from "../dom/isFocusable.js"
import { keyboard } from "../../api/env/device/keyboard.js"

/**
 * Appends an event listener for the `target` and returns a function that remove the listener.
 *
 * @param {EventTarget} target
 * @param {string} eventName
 * @param {EventListenerOrEventListenerObject} callback
 * @param {AddEventListenerOptions} [options]
 */
export function listen(target, eventName, callback, options) {
  target.addEventListener(eventName, callback, options)
  return () => target.removeEventListener(eventName, callback, options)
}

/**
 * Appends an event listener for the `target` and returns a Promise that resolves once the event has fired.
 *
 * @param {EventTarget} target
 * @param {string} eventName
 * @param {EventListener | AddEventListenerOptions} [callback]
 * @param {AddEventListenerOptions} [options]
 */
export function until(target, eventName, callback, options) {
  if (typeof callback !== "function") {
    options = callback
    callback = undefined
  }

  return new Promise((resolve) => {
    target.addEventListener(
      eventName,
      async (e) => {
        // @ts-ignore
        const res = await callback?.(e)
        if (res !== false) resolve(e)
      },
      { ...options, once: true },
    )
  })
}

/**
 * Stop event propagation and default actions.
 *
 * @param {Event} e
 */
export function stopEvent(e) {
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
}

export function normalizeEventOptions(options) {
  if (options.prevent || options.disrupt) {
    options.preventDefault = true
  }

  if (options.stop || options.disrupt) {
    options.stopPropagation = true
    options.stopImmediatePropagation = true
  }

  return options
}

export function runCleanup(e, options) {
  if (options.preventDefault) e.preventDefault()
  if (options.stopPropagation) e.stopPropagation()
  if (options.stopImmediatePropagation) e.stopImmediatePropagation()
}

export function cleanupEvent(e, options) {
  if (!options) return
  runCleanup(e, normalizeEventOptions(options))
}

cleanupEvent.run = runCleanup
cleanupEvent.normalize = normalizeEventOptions

export const SPLIT_REGEX = /\s*\|\|\s*/

const EVENT_DEFAULTS = {
  capture: false,
  once: false,
  passive: undefined,
  signal: undefined,
}

const ITEM_DEFAULTS = {
  selector: undefined,
  returnForget: true,
  repeatable: false,
  disrupt: false,
  stop: false,
  prevent: false,
  preventDefault: false,
  stopPropagation: false,
  stopImmediatePropagation: false,
  // ignoreScrollbar: false,
}

// if (item.ignoreScrollbar) {
//   if (
//     e.offsetX > e.target.clientWidth ||
//     e.offsetY > e.target.clientHeight
//   ) {
//     return
//   }
// }

const DEFAULTS_KEYS = Object.keys(EVENT_DEFAULTS)
const ITEM_KEYS = Object.keys(ITEM_DEFAULTS)

const validEventTypes = new Set(["string", "function", "object"])
const falsyKeys = new Set(["undefined", "null", "false"])

function normalizeEvents(events) {
  const out = {}

  for (const key in events) {
    if (!falsyKeys.has(key) && Object.hasOwn(events, key)) {
      const value = events[key]

      if (!value) {
        if (value === false) out[key] = () => false
        continue
      }

      const type = typeof value
      if (!(value && validEventTypes.has(type))) {
        throw Object.assign(new TypeError(`"${key}" is not a valid event`), {
          value,
        })
      }

      out[key] = value
    }
  }

  return out
}

export function normalizeListen(args, config) {
  const itemKeys = config?.itemKeys ?? ITEM_KEYS
  const optionsKeys = config?.optionsKeys ?? DEFAULTS_KEYS
  const getEvents = config?.getEvents ?? ((x) => x)
  let returnForget = config?.returnForget ?? true

  const list = []
  let globalOptions

  let current = { el: undefined, selector: undefined, listeners: [] }

  for (let arg of args.flat()) {
    if (!arg) continue

    let selector
    if (typeof arg === "string") {
      selector = arg
      arg = ensureElement(arg)
    }

    if ("addEventListener" in arg) {
      if (current.listeners.length > 0) {
        current.el ??= globalThis
        list.push(current)
      }

      current = { el: arg, selector, listeners: [] }
    } else {
      const [events, item, options] = distribute(arg, itemKeys, optionsKeys)

      if (Object.keys(events).length === 0 && Object.keys(options).length > 0) {
        if ("returnForget" in item) returnForget = item.returnForget
        globalOptions = globalOptions
          ? Object.assign(globalOptions, options)
          : options
        continue
      }

      item.events = getEvents(normalizeEvents(events), item, options)
      item.options = options
      current.listeners.push(item)
    }
  }

  current.el ??= globalThis
  list.push(current)

  const cancels = returnForget ? [] : undefined

  for (const { listeners } of list) {
    for (const item of listeners) {
      item.options = { ...globalOptions, ...item.options }

      if (returnForget) {
        const { cancel, signal } = new Canceller(item.options.signal)
        item.options.signal = signal
        cancels.push(cancel)
      }
    }
  }

  return { list, cancels }
}

export function makeHandler({ selector, ...options }, fn, el) {
  if (selector?.includes(":scope")) {
    selector = ensureScopeSelector(selector, el)
  }

  options = cleanupEvent.normalize(options)

  return selector
    ? (e) => {
        const target = e.target.closest?.(selector)
        if (target) {
          if (fn(e, target, el) === false) stopEvent(e)
          else cleanupEvent.run(e, options)
        }
      }
    : (e) => {
        if (fn(e, el) === false) stopEvent(e)
        else cleanupEvent.run(e, options)
      }
}

// TODO: implement swipe, tap, doubletap, longtap

export function registerEvents(list) {
  for (const { el, listeners } of list) {
    for (const { events, options, ...item } of listeners) {
      for (let [key, fn] of Object.entries(events)) {
        fn = makeHandler(item, fn, el)
        for (const event of key.split(SPLIT_REGEX)) {
          el.addEventListener(event, fn, options)
        }
      }
    }
  }
}

export function listenEventMap(...args) {
  const { list, cancels } = normalizeListen(args)
  registerEvents(list)
  if (cancels) {
    const forget = () => {
      for (const cancel of cancels) cancel()
      list.length = 0
      cancels.length = 0
    }

    forget.destroy = forget
    return forget
  }
}

/* MARK: Keyboard Shortcuts
=========================== */

const aliases = {
  Ctrl: "Control",
  Down: "ArrowDown",
  Left: "ArrowLeft",
  Right: "ArrowRight",
  Up: "ArrowUp",
  AltGr: "AltGraph",
  Del: "Delete",
  Esc: "Escape",
}

const codes = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "Space",
  "Semicolon",
  "Equal",
  "Comma",
  "Minus",
  "Period",
  "Slash",
  "Backquote",
  "BracketLeft",
  "Backslash",
  "BracketRight",
  "Quote",
])

export function parseShortcut(source) {
  let buffer = ""
  let current = 0

  const tokens = [[[]]]

  let or = 0
  let sequence = 0

  const flush = () => {
    if (!buffer) return
    tokens[or] ??= []
    tokens[or][sequence] ??= []

    if (
      buffer.length > 1 &&
      (buffer.toLowerCase() === buffer || buffer === "DOMContentLoaded")
    ) {
      tokens[or][sequence].push({ event: buffer })
    } else {
      if (buffer in aliases) buffer = aliases[buffer]
      const item = { event: "keydown" }

      if (buffer === "Enter") item.key = "enter"
      else if (buffer === "Return") {
        item.key = "enter"
        item.code = "Enter"
      } else if (
        codes.has(buffer) ||
        buffer.startsWith("Key") ||
        buffer.startsWith("Digit") ||
        buffer.startsWith("Numpad")
      ) {
        item.code = buffer
      } else {
        item.key = buffer.toLocaleLowerCase()
      }

      tokens[or][sequence].push(item)
    }

    buffer = ""
  }

  while (current < source.length) {
    const char = source[current]

    if (char === " ") {
      let advance = 1
      let next = source[current + advance]
      while (next === " ") {
        advance++
        next = source[current + advance]
      }

      if (!(next === "|" && source[current + advance + 1] === "|")) {
        flush()
        sequence++
      }

      current += advance
      continue
    }

    if (char === "|" && source[current + 1] === "|") {
      let advance = 2
      let next = source[current + advance]
      while (next === " ") {
        advance++
        next = source[current + advance]
      }

      flush()
      or++
      current += advance
      continue
    }

    if (char === "+") {
      if (!buffer) buffer = "+"
      flush()
      current++

      if (source[current] === "+") {
        buffer = "+"
        current++
      }

      continue
    }

    buffer += char
    current++
  }

  flush()

  return tokens
}

export function registerShortcutsAndEvents(list) {
  const registry = {
    chordCalled: false,
    seqIndex: 0,
  }

  for (const { el, listeners } of list) {
    for (const item of listeners) {
      const sorted = Object.entries(item.events).sort(([a], [b]) =>
        a.length === b.length ? 0 : a.length > b.length ? -1 : 1,
      )
      for (let [key, fn] of sorted) {
        fn = makeHandler(item, fn, el)
        for (const seq of parseShortcut(key)) {
          handleSeq(seq, fn, el, item, registry)
        }
      }
    }
  }
}

function handleSeq(seq, fn, el, { repeatable, options }, registry) {
  if (seq.length > 1) {
    const run = fn
    fn = (e) => {
      queueTask(() => {
        if (++registry.seqIndex === seq.length) {
          run(e)
          registry.seqIndex = 0
        }
      })
    }
  }

  for (let idx = 0, l = seq.length; idx < l; idx++) {
    const chords = seq[idx]
    const events = {}
    const chordCalls = []
    const eventOptions = { ...options }
    const ensureFocusableOptions = {
      signal: options.signal,
      tabIndex: -1,
      checkIfVisible: false,
    }

    // [1] Prevent events from input's datalist selection
    // (Chrome dispatch theses events using Event instead of KeyboardEvent)

    for (const { event, key, code } of chords) {
      if (event in events === false) {
        if (key || code) keyboard.listen(options.signal)
        if (chords.length > 1) {
          ensureFocusable(el, ensureFocusableOptions)
          eventOptions.capture = true
          events[event] = (e) => {
            if (event === "keydown" && e instanceof KeyboardEvent === false) {
              return // [1]
            }

            if (chordCalls.length === 0) {
              for (const key in keyboard.keys) {
                if (Object.hasOwn(keyboard.keys, key)) {
                  chordCalls.push({ type: "keydown", key })
                }
              }

              // const codes = Object.keys(keyboard.codes)
              // for (let i = 0, l = codes.length; i < l; i++) {
              //   chordCalls[i].code = codes[i]
              // }
            }

            if (registry.seqIndex !== idx) return
            if (registry.chordCalled) return
            if (e.repeat && repeatable !== true) return

            for (let i = 0, l = chordCalls.length; i < l; i++) {
              if (
                chordCalls[i].key === undefined ||
                chordCalls[i].key in keyboard.keys === false
              ) {
                chordCalls.length = i
                break
              }
            }

            chordCalls.push({
              type: e.type,
              code: e.code,
              key: e.key?.toLocaleLowerCase(),
            })

            for (let i = 0, l = chords.length; i < l; i++) {
              const chord = chords[i]
              if (
                i in chordCalls === false ||
                chordCalls[i].type !== chord.event ||
                ("key" in chord && chordCalls[i].key !== chord.key) ||
                ("code" in chord && chordCalls[i].code !== chord.code)
              ) {
                chordCalls.length = i
                registry.seqIndex = 0
                return
              }
            }

            registry.chordCalled = true

            queueTask(() => {
              registry.chordCalled = false
            })

            fn(e)
          }
        } else if (key || code) {
          ensureFocusable(el, ensureFocusableOptions)
          events[event] = (e) => {
            if (e instanceof KeyboardEvent === false) return // [1]
            chordCalls.length = 0
            if (registry.seqIndex !== idx) return
            if (registry.chordCalled) return
            if (e.repeat && repeatable !== true) return
            if (e.code === code || e.key.toLocaleLowerCase() === key) fn(e)
            else registry.seqIndex = 0
          }
        } else {
          events[event] = (e) => {
            chordCalls.length = 0
            if (registry.seqIndex !== idx) return
            if (registry.chordCalled) return
            fn(e)
          }
        }
      }
    }

    for (const [event, fn] of Object.entries(events)) {
      el.addEventListener(event, fn, eventOptions)
    }
  }
}

export function on(...args) {
  const { list, cancels } = normalizeListen(args)
  registerShortcutsAndEvents(list)
  if (cancels) {
    const forget = () => {
      for (const cancel of cancels) cancel()
    }

    forget.destroy = forget
    return forget
  }
}
