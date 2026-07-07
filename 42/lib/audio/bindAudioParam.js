/* eslint-disable complexity */
import { debounce } from "../timing/debounce.js"
import { gainToDb, dbToGain } from "./algo/audioConversions.js"
import { exponentialScale, logarithmicScale } from "../type/number/math.js"

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
    (options?.defaultValue ?? useDecibel)
      ? Math.max(gainToDb(audioParam.defaultValue), min)
      : audioParam.defaultValue

  if (options?.value) audioParam.value = options?.value
  el.valueAsNumber = useDecibel
    ? Math.max(gainToDb(audioParam.value), min)
    : useLog
      ? logarithmicScale(audioParam.value, min, max)
      : audioParam.value

  el.dataset.defaultValue = String(defaultValue)
  el.dataset.audioParam = "true"

  const transition = options?.transition ?? 0.015

  const signal = options?.signal

  let rafId
  let isWatching = false

  const watchAutomations = () => {
    if (isWatching || signal?.aborted) return
    isWatching = true

    let prev = audioParam.value

    const loop = useDecibel
      ? () => {
          if (prev !== audioParam.value) {
            el.valueAsNumber = Math.max(gainToDb(audioParam.value), min)
            el.title = `${el.value} ${unit}`
            prev = audioParam.value
          }

          rafId = requestAnimationFrame(loop)
        }
      : useLog
        ? () => {
            if (prev !== audioParam.value) {
              const val = logarithmicScale(audioParam.value, min, max)
              el.valueAsNumber = val
              el.title = `${val} ${unit}`
              prev = audioParam.value
            }

            rafId = requestAnimationFrame(loop)
          }
        : () => {
            if (prev !== audioParam.value) {
              el.valueAsNumber = audioParam.value
              el.title = `${el.value} ${unit}`
              prev = audioParam.value
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

        audioParam.cancelScheduledValues(0)
        audioParam.setTargetAtTime(gain, 0, transition)
        el.title = title
      }
    : () => {
        unwatchAutomations()
        audioParam.cancelScheduledValues(0)

        if (useLog) {
          const val = exponentialScale(el.valueAsNumber, min, max)
          audioParam.setTargetAtTime(val, 0, transition)
          el.title = `${val}${unit}`
        } else {
          audioParam.setTargetAtTime(el.valueAsNumber, 0, transition)
          el.title = `${el.value}${unit}`
        }
      }

  el.addEventListener("input", () => setValue(), { signal })
  el.title = `${el.value}${unit}`

  return { watchAutomations, unwatchAutomations }
}
