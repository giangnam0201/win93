// @src https://youtu.be/9-6CKCz58A8

import { ensureElement } from "./ensureElement.js"
import { untilRepaint } from "../../timing/untilRepaint.js"
import { distribute } from "../object/distribute.js"

const OPTIONS_KEYWORDS = [
  "signal",
  "commitStylesOnCancel",
  "ms",
  "duration",
  "easing",
  "delay",
  "endDelay",
  "autoHideScrollbars",
  "startTime",
  "keyframes",
  "from",
  "to",
]
const FORCE_DISPLAY = "display: block !important;"

const prm = window.matchMedia(`(prefers-reduced-motion: reduce)`)
let prefersReducedMotion = prm.matches
prm.onchange = (e) => (prefersReducedMotion = e.matches)

function hideScrollbars(el) {
  if (el.classList.contains("scrollbar-invisible")) return false
  if (!(el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
    el.classList.add("scrollbar-invisible")
    return true
  }
}

/**
 * Ensures height/width styles are set to px values before animating.
 * This prevents browser-inferred starting values that cause jitter.
 * @param {HTMLElement} el
 * @param {object} to - Target animation keyframe.
 */
function initializeDimensions(el, to) {
  let rect
  if ("height" in to) {
    // @ts-ignore
    if (to.height === "auto") el.style.interpolateSize = "allow-keywords"
    if (!el.style.height.endsWith("px")) {
      rect = el.getBoundingClientRect()
      el.style.height = `${rect.height}px`
    }
  }
  if ("width" in to) {
    // @ts-ignore
    if (to.width === "auto") el.style.interpolateSize = "allow-keywords"
    if (!el.style.width.endsWith("px")) {
      rect ??= el.getBoundingClientRect()
      el.style.width = `${rect.width}px`
    }
  }
}

/**
 * @param { Animatable } el
 */
export async function cancelAnimations(el) {
  for (const anim of el.getAnimations()) anim.cancel()
}

function commitStyles(el, anim) {
  // Force rendered element to commit styles
  const { display } = el.style
  el.style.cssText += FORCE_DISPLAY
  const { isConnected } = el
  if (!isConnected) document.documentElement.append(el)

  anim.commitStyles()

  // Restore forced
  el.style.cssText = el.style.cssText.replace(FORCE_DISPLAY, "")
  el.style.display = display
  if (!isConnected) el.remove()
}

/**
 * @param {string | HTMLElement} el
 * @param {object} options
 * @param {number} [duration]
 * @returns {Promise<Animation>}
 */
export async function animateTo(el, options, duration = 240) {
  el = ensureElement(el)

  // TODO: debug duration keyword handling: differs between keyframes array and single keyframe
  if (Array.isArray(options)) options = { keyframes: options }

  let [to, config] = distribute(options, OPTIONS_KEYWORDS)

  let {
    signal, //
    commitStylesOnCancel,
    autoHideScrollbars,
    startTime,
    keyframes,
    from,
    to: explicitTo,
  } = config

  autoHideScrollbars ??= true

  // Merge explicit `to` with auto-extracted properties
  if (explicitTo) to = { ...to, ...explicitTo }

  delete config.signal
  delete config.commitStylesOnCancel
  delete config.autoHideScrollbars
  delete config.startTime
  delete config.keyframes
  delete config.from
  delete config.to

  if (signal?.aborted) return

  // When explicit "from" is provided, use [from, to] keyframes for precise control
  // This avoids browser-inferred starting values that can cause animation jitter
  const hasExplicitFrom = from !== undefined

  if (!hasExplicitFrom) initializeDimensions(el, to)

  const shouldRestoreScrollbars = autoHideScrollbars
    ? hideScrollbars(el)
    : false

  if (prefersReducedMotion || el.classList.contains("animation-false")) {
    config.duration = 1
  } else config.duration ??= config.ms ?? duration

  // Use keyframe array when explicit from is provided, otherwise single keyframe
  keyframes ??= hasExplicitFrom ? [from, to] : to

  const anim = el.animate(keyframes, {
    easing: "ease-in-out",
    ...config,
    fill: hasExplicitFrom ? "forwards" : "both",
  })

  // Sync animation with shared start time for coordinated multi-element animations
  if (startTime !== undefined) {
    anim.startTime = startTime
  }

  signal?.addEventListener("abort", () => {
    if (commitStylesOnCancel) commitStyles(el, anim)
    anim.cancel()
  })

  try {
    await anim.finished
  } catch {
    animateTo.cancelledAnims.add(anim)
  }

  if (shouldRestoreScrollbars) el.classList.remove("scrollbar-invisible")

  commitStyles(el, anim)

  anim.cancel()
  return anim
}

/**
 * @param {string | HTMLElement} el
 * @param {object} options
 * @param {number} [duration]
 * @returns {Promise<Animation>}
 */
export async function animateFrom(el, options, duration = 240) {
  el = ensureElement(el)

  if (Array.isArray(options)) options = { keyframes: options }

  let [from, config] = distribute(options, OPTIONS_KEYWORDS)

  const { keyframes } = config

  from ??= keyframes[0]

  delete config.keyframes

  let heightBkp
  let widthBkp
  const hasHeightAnim = "height" in from
  const hasWidthAnim = "width" in from
  if (hasHeightAnim || hasWidthAnim) {
    // Prevent FOUC
    if (hasHeightAnim) {
      heightBkp = el.style.height
      el.style.height = from.height
    }

    if (hasWidthAnim) {
      widthBkp = el.style.width
      el.style.width = from.width
    }

    const rect = el.getBoundingClientRect()
    await untilRepaint()

    if (hasHeightAnim) {
      el.style.height = heightBkp
      el.style.height = `${rect.height}px`
    }

    if (hasWidthAnim) {
      el.style.width = widthBkp
      el.style.width = `${rect.width}px`
    }
  }

  const restoreScrollbars = hideScrollbars(el)

  if (prefersReducedMotion || el.classList.contains("animation-false")) {
    config.duration = 1
  } else config.duration ??= config.ms ?? duration

  const list = [{ ...from, offset: 0 }]

  if (keyframes) list.push(...keyframes.slice(1))

  const anim = el.animate(list, {
    easing: "ease-in-out",
    ...config,
    fill: "backwards",
  })

  try {
    await anim.finished
  } catch {
    animateFrom.cancelledAnims.add(anim)
  }

  if (heightBkp !== undefined) el.style.height = heightBkp
  if (widthBkp !== undefined) el.style.width = widthBkp
  if (restoreScrollbars) el.classList.remove("scrollbar-invisible")

  return anim
}

animateTo.cancelledAnims = new WeakSet()
animateFrom.cancelledAnims = new WeakSet()

export const animate = {
  cancel: cancelAnimations,
  to: animateTo,
  from: animateFrom,
}
