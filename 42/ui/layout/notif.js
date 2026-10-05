import { positionable } from "../../api/gui/trait/positionable.js"
import { untilTreeReady } from "../../api/gui/untilTreeReady.js"
import { focusInside } from "../../lib/dom/focus.js"
import { balloon } from "./toast.js"

/** @import {Plan} from "../../api/gui/render.js" */

/**
 * @param {string | HTMLElement} el
 * @param {Plan} message
 * @param {any} [options]
 */
export async function notif(el, message, options) {
  const notifEl = await balloon(message, "ui-notif", {
    animateTo: false,
    animateFrom: false,
    timeout: false,
    ...options,
  })

  if (options?.positionable !== false) {
    const p = positionable(notifEl, { of: el, preset: "notif" }) //
      .on("place", ({ my }) => {
        for (const item of notifEl.classList) {
          if (item.startsWith("tail-")) notifEl.classList.remove(item)
        }
        notifEl.classList.add(`tail-${my.y[0]}${my.x[0]}`)
      })

    notifEl.closed.then(() => {
      p.destroy()
    })

    // notifEl.className = "tail-br"
  }

  await untilTreeReady(notifEl)
  focusInside(notifEl)

  return notifEl
}
