import { loadScript } from "../../../../42/api/load/loadScript.js"
import { on } from "../../../../42/lib/event/on.js"
import { setTemp } from "../../../../42/lib/type/element/setTemp.js"
import { Physic } from "./Physic.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  await loadScript(new URL("./box2d.min.js", import.meta.url))

  const { signal } = app

  const physic = new Physic("#desktop", {
    signal,
    items: `
      :scope > ui-folder > ui-icon,
      :scope > ui-toaster > ui-toast,
      :scope > ui-workspaces > ui-workspace[active] > ui-dialog`,
  })

  on({
    signal,
    "ui:toast.open": (e) => physic.addElement(e.target),
    "ui:toast.close": (e) => {
      e.target.style.display = "none"
      physic.removeElement(e.target)
    },
    "ui:dialog.open || ui:dialog.unminimize || ui:dialog.restore": (e) =>
      physic.addElement(e.target),
    "ui:dialog.close || ui:dialog.minimize || ui:dialog.maximize": (e) => {
      physic.removeElement(e.target)
    },
  })

  const desktopEl = document.querySelector("#desktopFolder")
  if (desktopEl) {
    setTemp(desktopEl, {
      signal,
      style: { overflow: "hidden" },
    })
  }
}
