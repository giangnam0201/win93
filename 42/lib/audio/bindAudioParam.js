/* eslint-disable complexity */
import { debounce } from "../timing/debounce.js"
import { gainToDb, dbToGain } from "./algo/audioConversions.js"
import { exponentialScale, logarithmicScale } from "../type/number/math.js"
import {
  audioParamTargets,
  audioParamBindings,
  notifyAudioParamTargets,
} from "./audioParamTargets.js"

const MAX_FLOATING_POINT = 3.402_823_466_385_288_6e+38

/**
 * @param {import("../type/element/setControlData.js").NumericInput} el
 * @param {AudioParam} audioParam
 * @param {{
 *   signal?: AbortSignal;
 *   scale?: string;
 *   unit?: string;
 *   step?: number;
 *   max?: number;
 *   min?: number;
 *   value?: number;
 *   defaultValue?: number;
 *   transition?: number;
 *   watchAutomations?: boolean;
 * }} options
 */
export function bindAudioParam(el, audioParam, options) {
  let useDecibel = false
  let useLog = false

  let minDb

  // @ts-ignore
  let unit = ` ${options?.unit ?? el.unit ?? el.dataset.unit ?? ""}`
  if (unit === " ") unit = ""

  // @ts-ignore
  const scale = options?.scale ?? el.scale ?? el.dataset.scale

  if (scale === "log") {
    useLog = true
  } else if (scale === "dB") {
    unit = " dB"
    useDecibel = true
    options.step ??= 0.1
    options.min ??= -60
    options.max ??= 6

    if (options.min === -Infinity) {
      options.min = -60 - options.step
      minDb = options.min
    }
  }

  el.step ||= "0.001"
  el.min ||=
    audioParam.minValue === -MAX_FLOATING_POINT
      ? "0"
      : String(audioParam.minValue)
  el.max ||=
    audioParam.maxValue === MAX_FLOATING_POINT
      ? "1"
      : String(audioParam.maxValue)

  if (options?.step !== undefined) el.step = String(options?.step)
  if (options?.max !== undefined) el.max = String(options?.max)
  if (options?.min !== undefined) el.min = String(options?.min)

  const min = Number(el.min)
  const max = Number(el.max)

  const defaultValue =
    options?.defaultValue ??
    (useDecibel
      ? Math.max(gainToDb(audioParam.defaultValue), min)
      : useLog
        ? logarithmicScale(audioParam.defaultValue, min, max)
        : audioParam.defaultValue)

  if (options?.value !== undefined) audioParam.value = options?.value
  el.valueAsNumber = useDecibel
    ? Math.max(gainToDb(audioParam.value), min)
    : useLog
      ? logarithmicScale(audioParam.value, min, max)
      : audioParam.value

  el.dataset.defaultValue = String(defaultValue)
  el.dataset.audioParam = "true"
  const binding = {
    min,
    max,
    scale,
    minDb,
    modulation: undefined,
    baseValue: audioParam.value,
    drawModulation(fraction) {
      if (fraction === undefined) {
        el.style.removeProperty("--modulation-fraction")
        el.removeAttribute("modulated")
      } else {
        el.style.setProperty("--modulation-fraction", String(fraction))
        el.setAttribute("modulated", "")
      }
    },
  }
  audioParamBindings.set(audioParam, binding)
  const currentParam = () => binding.modulation?.node.base ?? audioParam
  audioParamTargets.set(el, audioParam)
  notifyAudioParamTargets()
  options?.signal?.addEventListener(
    "abort",
    () => {
      for (const source of binding.modulation?.cables.keys() ?? []) {
        source.disconnect(audioParam)
      }
      audioParamBindings.delete(audioParam)
      audioParamTargets.delete(el)
      notifyAudioParamTargets()
    },
    { once: true },
  )

  const transition = options?.transition ?? 0.015

  const signal = options?.signal

  let rafId
  let isWatching = false

  const watchAutomations = () => {
    if (isWatching || signal?.aborted) return
    isWatching = true

    let prev = currentParam().value

    const loop = useDecibel
      ? () => {
          if (prev !== currentParam().value) {
            el.valueAsNumber = Math.max(gainToDb(currentParam().value), min)
            el.title = `${el.value} ${unit}`
            prev = currentParam().value
          }

          rafId = requestAnimationFrame(loop)
        }
      : useLog
        ? () => {
            if (prev !== currentParam().value) {
              const val = logarithmicScale(currentParam().value, min, max)
              el.valueAsNumber = val
              el.title = `${val} ${unit}`
              prev = currentParam().value
            }

            rafId = requestAnimationFrame(loop)
          }
        : () => {
            if (prev !== currentParam().value) {
              el.valueAsNumber = currentParam().value
              el.title = `${el.value} ${unit}`
              prev = currentParam().value
            }

            rafId = requestAnimationFrame(loop)
          }

    loop()
  }

  const unwatchAutomations = () => {
    cancelAnimationFrame(rafId)
    isWatching = false
  }

  signal?.addEventListener("abort", () => unwatchAutomations())

  if (options?.watchAutomations) {
    watchAutomations()

    el.addEventListener(
      "change",
      debounce(() => watchAutomations()),
      { signal },
    )
  }

  const resetValue = () => {
    el.valueAsNumber = defaultValue
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }

  el.addEventListener("dblclick", resetValue, { signal })
  el.addEventListener("contextmenu", resetValue, { signal })
  el.addEventListener(
    "keydown",
    ({ type, code }) => {
      if (type === "keydown" && code !== "Delete") return
      resetValue()
    },
    { signal },
  )

  const setValue = useDecibel
    ? () => {
        unwatchAutomations()
        let gain
        let title

        if (minDb && el.valueAsNumber === minDb) {
          gain = 0
          title = "-Infinity dB"
        } else {
          gain = dbToGain(el.valueAsNumber)
          title = `${el.value} dB`
        }

        currentParam().cancelScheduledValues(0)
        binding.baseValue = gain
        currentParam().setTargetAtTime(gain, 0, transition)
        el.title = title
      }
    : () => {
        unwatchAutomations()
        currentParam().cancelScheduledValues(0)

        if (useLog) {
          const val = exponentialScale(el.valueAsNumber, min, max)
          binding.baseValue = val
          currentParam().setTargetAtTime(val, 0, transition)
          el.title = `${val}${unit}`
        } else {
          binding.baseValue = el.valueAsNumber
          currentParam().setTargetAtTime(el.valueAsNumber, 0, transition)
          el.title = `${el.value}${unit}`
        }
      }

  el.addEventListener("input", () => setValue(), { signal })
  el.title = `${el.value}${unit}`

  return { watchAutomations, unwatchAutomations }
}
