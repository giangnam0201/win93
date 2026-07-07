import { setTemp } from "../type/element/setTemp.js"

const suspendedIframes = new WeakMap()

export function suspendIframes(options) {
  let timeoutId
  const currentIframes = document.querySelectorAll("iframe")

  for (const iframe of currentIframes) {
    let item = suspendedIframes.get(iframe)
    if (!item) {
      item = {
        count: 0,
        restore: setTemp(iframe, { class: { "action-false": true } }),
      }
      suspendedIframes.set(iframe, item)
    }
    item.count++
  }

  let isRestored = false

  function restoreIframes() {
    if (isRestored) return
    isRestored = true
    clearTimeout(timeoutId)
    for (const iframe of currentIframes) {
      const item = suspendedIframes.get(iframe)
      if (!item) continue
      item.count--
      if (item.count <= 0) {
        item.restore()
        suspendedIframes.delete(iframe)
      }
    }
  }

  if (options?.timeout) {
    timeoutId = setTimeout(restoreIframes, options.timeout)
  }

  return restoreIframes
}
