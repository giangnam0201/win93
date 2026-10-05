/**
 * Check if element has animations that can finish.
 *
 * @param {HTMLElement} el
 * @param {{animatableParents: string | string[]}} [options]
 */
export function isAnimated(el, options) {
  const anims = /** @type {CSSAnimation[]} */ (el.getAnimations())

  if (options?.animatableParents) {
    for (const animatableParent of [options.animatableParents].flat()) {
      const res = /** @type {CSSAnimation[]} */ (
        el.closest(animatableParent)?.getAnimations()
      )
      if (res?.length) anims.push(...res)
    }
  }

  for (const anim of anims) {
    if (anim.effect.getTiming().iterations !== Infinity) return true
  }

  return false
}
