import { untilConnected } from "../../lib/type/element/untilConnected.js"
import { render } from "../gui/render.js"
import { ensureURL } from "./ensureURL.js"

export class TraysManager {
  list = new Set()
  elements = new Map()
  promise = undefined
  el = undefined
}

export const traysManager = new TraysManager()

export async function tray(manifest, module) {
  if (traysManager.list.has(manifest.command)) return
  traysManager.list.add(manifest.command)

  traysManager.promise ??= untilConnected("#tray")
  traysManager.el ??= await traysManager.promise

  module ??= await import(
    await ensureURL(new URL(manifest.module, manifest.manifestURL).href)
  )

  let el

  if (module.renderTray) {
    if (module.renderTray.done) return
    const plan = await module.renderTray(manifest)
    el = render(plan, traysManager.el)
    traysManager.elements.set(manifest.command, el)
    module.renderTray.done = true
  }

  if (module.startTray) {
    await module.startTray(el, manifest)
  }
}
