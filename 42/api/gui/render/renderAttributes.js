/* eslint-disable complexity */
import { setAttribute } from "../../../lib/type/element/setAttributes.js"
import { setStyle } from "../../../lib/type/element/setStyles.js"
import {
  isNumericInput,
  setControlData,
  setFractionProp,
} from "../../../lib/type/element/setControlData.js"
import { toKebabCase } from "../../../lib/type/string/transform.js"
import { Component } from "../Component.js"
import { isPromiseLike } from "../../../lib/type/any/isPromiseLike.js"

/** @import { NumericInput } from "../../../lib/type/element/setControlData.js" */

function renderClasses(el, classes, stage) {
  if (Array.isArray(classes)) {
    return void el.setAttribute("class", classes.join(" "))
  }

  if (stage?.reactive) {
    for (const [keys, val] of Object.entries(classes)) {
      stage.reactive.register(el, val, (val) => {
        const op = val ? "add" : "remove"
        for (const key of keys.split(" ")) el.classList[op](key)
      })
    }
  } else {
    for (const [keys, val] of Object.entries(classes)) {
      const op = val ? "add" : "remove"
      for (const key of keys.split(" ")) el.classList[op](key)
    }
  }
}

function renderStyles(el, styles, stage) {
  const type = typeof styles
  if (type === "string") {
    if (stage?.reactive) {
      stage.reactive.register(el, styles, (val) => (el.style = val))
    } else el.style = styles
  } else {
    for (const [key, val] of Object.entries(styles)) {
      setStyle(el, key, "unset") // placeholder to keep style order
      if (stage?.reactive) {
        stage.reactive.register(el, val, (val) => setStyle(el, key, val))
      } else setStyle(el, key, val)
    }
  }
}

const logical = {
  width: "inlineSize",
  height: "blockSize",
}

function applySize(attrs, key) {
  const val = attrs[key]
  delete attrs[key]

  if (val == null) return

  attrs.style ??= {}
  attrs.style[logical[key] ?? key] = val
}

function applyPos(el, attrs, key) {
  const val = attrs[key]
  delete attrs[key]

  if (val == null) return

  if (key in el) el[key] = val
  else el.style.setProperty(`--${key}`, Number.isFinite(val) ? `${val}px` : val)
}

/**
 * @param {HTMLElement | SVGElement | NumericInput} el
 * @param {object} attrs
 * @param {any} [stage]
 * @param {string} [prefix]
 */
export function renderAttributes(el, attrs, stage, prefix = "") {
  if ("x" in attrs) applyPos(el, attrs, "x")
  if ("y" in attrs) applyPos(el, attrs, "y")
  if ("height" in attrs && "height" in el === false) applySize(attrs, "height")
  if ("width" in attrs && "width" in el === false) applySize(attrs, "width")

  if ("value" in attrs) {
    // always set "value" after "min" or "max" (for input[type="range"] and input[type="number"])
    const { value } = attrs
    delete attrs.value
    attrs.value = value

    if ("checked" in attrs) {
      // always set "checked" after "value" (for input[type="radio"] and input[type="checkbox"])
      const { checked } = attrs
      delete attrs.checked
      attrs.checked = checked
    }
  } else if (isNumericInput(el)) {
    setFractionProp(el)
  }

  for (let [key, val] of Object.entries(attrs)) {
    if (val == null) {
      // @ts-ignore
      if (!(el.type === "checkbox" && key === "value")) continue
    }

    if (
      typeof val === "function" &&
      key !== "action" &&
      !key.startsWith("on")
    ) {
      if (
        Component.isComponent(el) &&
        key in el &&
        typeof el[key] === "function"
      ) {
        el[key] = val
        continue
      } else {
        val = val(el, stage)
      }
    }

    if (isPromiseLike(val)) {
      void (async () => {
        renderKeyVal(el, key, await val, stage, prefix)
      })()

      continue
    }

    renderKeyVal(el, key, val, stage, prefix)
  }
}

function renderKeyVal(el, key, val, stage, prefix) {
  if (key === "autofocus") key = "data-autofocus" // prevent use of restricted autofocus attribute

  if (key === "dataset") renderAttributes(el, val, stage, "data-")
  else if (key === "aria") renderAttributes(el, val, stage, "aria-")
  else if (key === "style") renderStyles(el, val, stage)
  else if (key === "class" && val && typeof val === "object") {
    renderClasses(el, val, stage)
  } else if (key === "value" && "value" in el && "form" in el) {
    if (el.type === "radio") {
      el.value = val
    } else if (stage?.reactive) {
      stage.reactive.register(el, val, (val) => setControlData(el, val))
    } else setControlData(el, val)
  } else {
    const isDataset = prefix === "data-"
    if (isDataset) val = String(val)
    key = prefix + (isDataset ? toKebabCase(key) : key)

    if (Component.isComponent(el) && key in el) {
      el[key] = val
      return
    }

    if (stage?.reactive) {
      stage.reactive.register(el, val, (val) => setAttribute(el, key, val))
    } else setAttribute(el, key, val)
  }
}
