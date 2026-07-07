import { debounce } from "../../timing/debounce.js"

export function motionless(el) {
  const saved = el.style.transitionDuration
  const cancel = () => {
    el.style.transitionDuration = "0s"
  }

  const restore = debounce(() => {
    el.style.transitionDuration = saved
  })

  return {
    cancel,
    restore,
  }
}
