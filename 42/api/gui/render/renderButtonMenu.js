import { on } from "../../../lib/event/on.js"

let menu

export function renderButtonMenu(el, data, stage) {
  const signal = stage?.signal ?? el.signal

  el.ariaHasPopup = "menu"
  el.classList.toggle("pointer-instant", true)

  on(el, {
    signal,
    "prevent": true,
    "pointerdown || Enter || Space || ArrowDown": async (e, opener) => {
      let menuItems =
        typeof data === "function" //
          ? data(el, stage)
          : data

      if (menu) menuItems = await menuItems
      else {
        const res = await Promise.all([
          menuItems,
          import("../../../ui/layout/menu.js"),
        ])

        menuItems = res[0]
        menu = res[1].menu
      }

      el.focus()

      menu(menuItems, {
        opener,
        highlightFirst: e.type !== "pointerdown",
      })
    },
  })
}
