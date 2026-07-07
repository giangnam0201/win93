import { untilRepaint } from "../../../../42/lib/timing/untilRepaint.js"
import { randomItem } from "../../../../42/lib/type/array/randomItem.js"
import { ensureElement } from "../../../../42/lib/type/element/ensureElement.js"

const animIn = [
  // "rubberBand", // blurry
  // "jello", // blurry
  // "swing", // slow
  // "tada", // blurry
  // "wobble", // slow
  // "jackInTheBox", // slow
  // "bounceIn", // blurry
  // "bounceInDown", // blurry
  // "bounceInLeft", // blurry
  "flipInX",
  "flipInY",
  // "lightSpeedInLeft", // blurry
  // "lightSpeedInRight", // blurry
  // "rotateIn", // slow
  // "rotateInDownLeft", // slow
  // "rotateInDownRight", // slow
  // "rotateInUpRight", // blurry
  // "slideInDown", // slow
  // "slideInLeft", // slow
  "rollIn",
  // "zoomIn", // slow
  "zoomInDown",
  "zoomInLeft",
  "zoomInRight",
  "zoomInUp",
]
const animOut = [
  "bounceOut",
  "bounceOutDown",
  "bounceOutLeft",
  "bounceOutRight",
  "bounceOutUp",
  // "lightSpeedOutLeft", // slow
  // "lightSpeedOutRight", // slow
  "rotateOut",
  // "rotateOutDownLeft", // slow
  // "rotateOutDownRight", // slow
  // "rotateOutUpLeft", // slow
  // "rotateOutUpRight", // slow
  "flipOutX",
  "flipOutY",
  "fadeOutLeftBig",
  "fadeOutRightBig",
  "fadeOutUpBig",
  "fadeOutDownBig",
  // "fadeOutLeft", // slow
  // "fadeOutRight", // slow
  // "fadeOutUp", // slow
  // "fadeOutDown", // slow
  // "slideOutLeft", // slow
  // "slideOutRight", // slow
  // "slideOutUp", // slow
  // "slideOutDown", // slow
  "hinge",
  "rollOut",
  // "zoomOut", // slow
  // "zoomOutDown", // slow
  "zoomOutLeft",
  "zoomOutRight",
  // "zoomOutUp", // slow
]

export async function animateCSS(el, animation, ...classes) {
  el = ensureElement(el)

  const prefix = ""
  const animationLowercase = animation.toLowerCase()

  if (animationLowercase === "false") return

  return new Promise((resolve) => {
    const animationName = `${prefix}${animation}`
    if (!animationName) return

    el.dataset.animationName = animationName
    el.classList.add(`${prefix}animated`, animationName, ...classes)

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd(e) {
      if (
        e.target !== el ||
        e.animationName.toLowerCase() !== animationLowercase
      ) {
        return
      }

      e.stopPropagation()
      el.classList.remove(`${prefix}animated`, animationName, ...classes)
      delete el.dataset.animationName
      el.removeEventListener("animationend", handleAnimationEnd)
      el.removeEventListener("animationcancel", handleAnimationEnd)
      resolve()
    }

    el.addEventListener("animationend", handleAnimationEnd)
    el.addEventListener("animationcancel", handleAnimationEnd)
  })
}

export async function animateIn(
  el,
  animation = randomItem(animIn),
  ...classes
) {
  if (typeof animation === "number") animation = animIn[animation]
  if (animation === "random") animation = randomItem(animIn)
  return animateCSS(el, animation, ...classes)
}

export async function animateOut(
  el,
  animation = randomItem(animOut),
  ...classes
) {
  if (typeof animation === "number") animation = animOut[animation]
  if (animation === "random") animation = randomItem(animOut)
  return animateCSS(el, animation, ...classes)
}
