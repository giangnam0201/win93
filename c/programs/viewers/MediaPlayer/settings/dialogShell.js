// Boilerplate shared by every per-format Settings dialog (see midi.js, vgm.js,
// mod.js, gme.js, mdx.js, sid.js, xmpFull.js, adplug.js, sc68.js, zxtune.js).
// MediaPlayer.js owns the one Settings <ui-dialog> for its player instance:
// each format module just builds a content plan (build*Settings(playerEl,
// state), returning { label, content } or null), and MediaPlayer.js either
// opens the first dialog with it or, if one's already open and the file type
// changed, swaps its content in place via replaceDialogContent() below --
// same window, no destroy/recreate.

import { render } from "../../../../../42/api/gui/render.js"

/**
 * Every field in these dialogs applies live via its own change/input handler,
 * so there's nothing an Ok/Cancel footer would commit or discard (footer:
 * false), and form()'s default Enter handler -- which would otherwise close
 * the dialog -- is just annoying while adjusting a number input or tabbing
 * through fields (the fieldset.on override replaces only Enter). `created`
 * is called with the <fieldset> form() builds around the content -- MediaPlayer.js
 * uses it to grab the owning <ui-dialog> via el.closest("ui-dialog").
 */
export function settingsDialogOptions({
  label,
  picto = "cog",
  width = 260,
  height = 260,
  created,
} = {}) {
  return {
    label,
    picto,
    width,
    height,
    resizable: true,
    footer: false,
    fieldset: { on: { Enter: (e) => e.preventDefault() } },
    created,
  }
}

// Mirrors the <fieldset> form() wraps its content in by default (aligned,
// not piled) -- see dialog.js's form() -- so swapping content into an
// already-open dialog looks identical to what form() would have built from
// scratch for that content.
function wrapFieldset(plan) {
  return {
    tag: "fieldset.ui-dialog-form__fieldset.ma-t-xs.ma-b-xxs.aligned",
    role: "none",
    on: { Enter: (e) => e.preventDefault() },
    content: plan,
  }
}

/**
 * Replaces an already-open Settings dialog's content in place -- used when
 * the player switches to a different file type while Settings is open, so
 * the same window updates instead of being destroyed and recreated.
 */
export function replaceDialogContent(dialogEl, plan, { label, picto } = {}) {
  if (label != null) dialogEl.title = label
  if (picto != null) dialogEl.picto = picto
  dialogEl.contentEl.replaceChildren()
  render(wrapFieldset(plan), dialogEl.contentEl)
}

// paramDefs' enum options are grouped ([{label, items:[{label,value}]}]) --
// flatten to the [label, value] pairs the plan-render <select> content
// shorthand expects.
export function flattenOptions(paramDef) {
  if (!paramDef) return []
  return paramDef.options.flatMap((group) =>
    group.items.map((item) => [item.label, String(item.value)]),
  )
}
