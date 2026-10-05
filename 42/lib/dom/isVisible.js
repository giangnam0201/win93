export const isVisible = globalThis.checkVisibility
  ? (el) =>
      globalThis.checkVisibility(el, {
        opacityProperty: true,
        visibilityProperty: true,
        contentVisibilityAuto: true,
      })
  : (el) =>
      Boolean(
        el.offsetWidth || el.offsetHeight || el.getClientRects().length > 0,
      )
