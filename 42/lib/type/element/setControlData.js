import { round } from "../number/precision.js"

/**
 * @typedef {HTMLElement & {
 *   form: HTMLFormElement;
 *   type: string;
 *   name: string;
 *   step: string;
 *   min: string;
 *   max: string;
 *   value: string;
 *   valueAsNumber: number
 * }} NumericInput
 *
 * @typedef { HTMLInputElement |
 *   HTMLSelectElement |
 *   HTMLTextAreaElement |
 *   NumericInput |
 *   HTMLElement & {
 *     form: HTMLFormElement;
 *     name: string;
 *     type: string;
 *     value: string;
 *   }
 * } HTMLFormControl
 */

/**
 * @param {any} el
 * @returns {el is NumericInput}
 */
export function isNumericInput(el) {
  return el && "valueAsNumber" in el
}

/** @param {NumericInput} target */
export function getNumericRange(target) {
  const min = target.min === "" ? 0 : Number(target.min)
  const max = target.max === "" ? 100 : Number(target.max)
  return { min, max }
}

/** @param {NumericInput} target */
export function getNumericMin(target) {
  return target.min === "" ? 0 : Number(target.min)
}

/** @param {NumericInput} target */
export function getNumericMax(target) {
  return target.max === "" ? 100 : Number(target.max)
}

/** @param {NumericInput} target */
export function getNumericStep(target) {
  return target.step === "" ? 1 : Number(target.step)
}

/** @param {NumericInput} target */
export function getNumericValueAsFraction(target) {
  const min = target.min === "" ? 0 : Number(target.min)
  const max = target.max === "" ? 100 : Number(target.max)
  return (target.valueAsNumber - min) / (max - min)
}

/** @param {NumericInput} target */
export function setFractionProp(target) {
  target.style.setProperty(
    "--fraction",
    String(getNumericValueAsFraction(target)),
  )
}

/**
 * @typedef {{
 *   fast?: boolean;
 *   slow?: boolean;
 *   dispatch?: boolean;
 *   dispatchInput?: boolean;
 *   dispatchChange?: boolean;
 * }} SetNumericValueOptions
 */

/**
 * @param {NumericInput} target
 * @param {number} dir
 * @param {SetNumericValueOptions} [options]
 */
export function stepsNumericValue(target, dir, options) {
  // TODO: use stepUp/stepDown https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/stepUp
  const step = getNumericStep(target)

  // let addend = step
  let addend

  if (options?.fast) {
    const { max } = getNumericRange(target)
    const tenPercent = max / 10
    addend = Math.max(step * 2, tenPercent)
  } else if (options?.slow) {
    addend = step
  } else {
    const { max } = getNumericRange(target)
    const onePercent = max / 100
    addend = Math.max(step, onePercent)
  }

  const { valueAsNumber } = target
  const value = target.valueAsNumber + (dir > 0 ? addend : -addend)
  setValidNumericValue(target, value, step)
  if (valueAsNumber === target.valueAsNumber) return

  if (options?.dispatch === false) return

  if (options?.dispatchInput !== false) {
    target.dispatchEvent(new Event("input", { bubbles: true }))
  }

  if (options?.dispatchChange !== false) {
    target.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

export function setValidNumericValue(target, value, step) {
  step ??= getNumericStep(target)
  const { min, max } = getNumericRange(target)

  if (value > max) value = max
  else if (value < min) value = min

  const indexOfDecimnal = target.step.indexOf(".")
  if (indexOfDecimnal === -1) {
    target.valueAsNumber = value
  } else {
    const decimals = target.step.length - indexOfDecimnal - 1
    const modulo = round(value % step, decimals)
    if (Math.abs(modulo) !== step) value -= modulo
    target.valueAsNumber = round(value, decimals)
  }
}

/**
 * @param {NumericInput} target
 * @param {SetNumericValueOptions} [options]
 */
export function incrementNumericValue(target, options) {
  stepsNumericValue(target, 1, options)
}

/**
 * @param {NumericInput} target
 * @param {SetNumericValueOptions} [options]
 */
export function decrementNumericValue(target, options) {
  stepsNumericValue(target, -1, options)
}

// @src https://stackoverflow.com/a/55111246
function setSelectionRange(el, selectionStart, selectionEnd) {
  const { value, clientHeight } = el
  el.value = value.slice(0, Math.max(0, selectionEnd))
  const { scrollHeight } = el
  el.value = value
  el.scrollTop =
    scrollHeight > clientHeight ? scrollHeight - clientHeight / 2 : 0
  el.setSelectionRange(selectionStart, selectionEnd)
}

/**
 * @param {HTMLFormControl} el
 * @param {string | number | void | string[]} val
 */
export function setControlData(el, val) {
  switch (el.type) {
    case "checkbox":
      if (val == null) el.indeterminate = true
      else {
        el.indeterminate = false
        el.checked = Boolean(val)
      }
      break

    case "radio":
      el.checked = el.value === val
      break

    case "select-one":
      if (Array.isArray(val)) val = val[0]
      if (el.options.length > 0) {
        for (const opt of el.options) {
          if (opt.value === val) {
            opt.selected = true
            break
          }
        }
      } else {
        el.dataset.value = String(val)
      }
      break

    case "select-multiple":
      val ??= []
      if (!Array.isArray(val)) val = [val].flat()
      for (const opt of el.options) opt.selected = val.includes(opt.value)
      break

    case "range":
    case "number":
      // `el.value` isn't working correctly for type range (?)
      el.setAttribute("value", String(val ?? ""))
      setFractionProp(el)
      break

    case "textarea": {
      const { selectionStart, selectionEnd } = el
      el.value = String(val ?? "")
      if (document.activeElement === el) {
        setSelectionRange(el, selectionStart, selectionEnd)
      }
      break
    }

    default:
      // @ts-ignore
      el.value = val ?? ""
  }
}
