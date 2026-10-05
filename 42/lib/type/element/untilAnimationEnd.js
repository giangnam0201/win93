import { ensureElement } from "./ensureElement.js"

/**
 * Returns a Promise that resolves when all element's animations are finished.
 *
 * @param {string | HTMLElement} el
 * @param {{animatableParents: string | string[]}} [options]
 * @returns {Promise<void>}
 */
export async function untilAnimationEnd(el, options) {
  el = ensureElement(el)

  const anims = /** @type {CSSAnimation[]} */ (el.getAnimations())

  if (options?.animatableParents) {
    for (const animatableParent of [options.animatableParents].flat()) {
      const res = /** @type {CSSAnimation[]} */ (
        el.closest(animatableParent)?.getAnimations()
      )
      if (res?.length) anims.push(...res)
    }
  }

  const undones = []

  for (const anim of anims) {
    if (anim.effect.getTiming().iterations === Infinity) {
      console.warn(
        anim.animationName
          ? `Animation "${anim.animationName}" is infinite`
          : "Animation is infinite",
        anim,
      )
      continue
    }

    undones.push(anim.finished)
  }

  await Promise.all(undones)
}
