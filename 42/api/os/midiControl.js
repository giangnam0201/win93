import { scale } from "../../lib/type/number/math.js"
import { keep } from "../keep.js"

// Single OS-wide MIDI Learn / MIDI input access point. Permission is only
// requested by enableMidiControl(), following an explicit user action.
//
// Phase 1: session-only. Bindings live in the runtime registry below and
// are lost on reload -- no persistence yet. A
// later pass can add a ConfigFile-backed persistent layer for controls
// that supply a stable "path" (apps that are effectively singletons, e.g.
// the Mixer's own tracks); anything without one stays session-scoped,
// which is also the correct behavior for apps that can have several
// independent windows open at once (e.g. more than one Reverb instance) --
// there's no reliable existing signal in this OS to tell those two cases
// apart automatically (checked: manifest.multiple is about multi-file
// launches, not multi-instance apps), so this doesn't attempt to guess.

let midiAccess = null
let enabling = null
let deviceConfig = null

// null selects every device; an array restricts MIDI Learn to those IDs.
async function ensureDeviceConfig() {
  deviceConfig ??= await keep("~/config/midiControl.json5", {
    selectedDeviceIds: null,
  })
  return deviceConfig
}

export function isDeviceSelected(inputId) {
  const ids = deviceConfig?.selectedDeviceIds
  if (ids === null || ids === undefined) return true
  return ids.includes(inputId)
}

export function getMidiInputs() {
  return midiAccess ? [...midiAccess.inputs.values()] : []
}

export async function setDeviceSelected(inputId, selected) {
  const config = await ensureDeviceConfig()
  let ids = config.selectedDeviceIds
  ids = ids === null ? getMidiInputs().map((input) => input.id) : [...ids]
  if (selected) {
    if (!ids.includes(inputId)) ids.push(inputId)
  } else {
    ids = ids.filter((id) => id !== inputId)
  }
  config.selectedDeviceIds = ids
  reconcileAttachedInputs()
}

// ccKey -> Set<{el, apply}>. `apply(value)` lets each bound element decide
// what an incoming 0-127 means for itself (a knob scales it into its own
// min/max) -- kept generic here rather than this module assuming every
// learnable control is a continuous range.
const bindings = new Map()

// The element currently "armed" to learn the next incoming message, the
// apply() it should bind once one arrives, and an optional `kind` filter
// ("note" -- buttons/toggles only ever learn from a Note message, CC
// ignored while armed; undefined -- either kind, for range/select) -- see
// arm()/disarm(), driven by each attach*MidiLearn() below.
let learnTarget = null
let learnApply = null
let learnKind = null

function messageKey(input, data) {
  const status = data[0] & 0xf0
  const channel = data[0] & 0x0f
  // Control Change (0xb0) keyed by controller number; Note On/Off
  // (0x90/0x80) keyed by note number -- both live in the same map,
  // distinguished by status, so learning doesn't need to know in advance
  // which kind of message a given piece of hardware happens to send for
  // "this is a knob" vs "this is a button."
  if (status === 0xb0) return `${input.id}:${channel}:cc:${data[1]}`
  if (status === 0x90 || status === 0x80) {
    return `${input.id}:${channel}:note:${data[1]}`
  }
  return null
}

function handleMessage(input, { data }) {
  const key = messageKey(input, data)
  // key === null here is a single-byte realtime message (Active Sensing
  // 0xfe, Clock 0xf8, etc.) -- plenty of hardware, this controller
  // included apparently, streams those continuously regardless of what's
  // being touched. Not learnable, not dispatchable.
  if (!key) return

  const status = data[0] & 0xf0
  const isNote = status === 0x90 || status === 0x80

  if (learnTarget) {
    // Buttons/toggles ask to learn from a Note specifically -- a CC
    // arriving while armed for one is ignored outright (not bound, not
    // even clearing the armed state), so a stray knob twist nearby can't
    // accidentally steal the learn instead of the button press it's
    // actually waiting for.
    if (learnKind === "note" && !isNote) return
    bind(key, learnTarget, learnApply)
    learnTarget = null
    learnApply = null
    learnKind = null
    return
  }

  const targets = bindings.get(key)
  if (!targets) return
  // Note Off (0x80), or a Note On with velocity 0 (used as a Note Off by
  // convention on real hardware), reports as 0 -- CC just passes its value
  // straight through.
  const value = status === 0xb0 ? data[2] : status === 0x90 ? data[2] : 0
  for (const { apply } of targets) apply(value)
}

const attachedHandlers = new Map()

function attachInput(input) {
  if (attachedHandlers.has(input.id)) return
  const handler = (event) => handleMessage(input, event)
  input.addEventListener("midimessage", handler)
  attachedHandlers.set(input.id, handler)
}

function detachInput(input) {
  const handler = attachedHandlers.get(input.id)
  if (!handler) return
  input.removeEventListener("midimessage", handler)
  attachedHandlers.delete(input.id)
}

function reconcileAttachedInputs() {
  if (!midiAccess) return
  for (const input of midiAccess.inputs.values()) {
    if (isDeviceSelected(input.id)) attachInput(input)
    else detachInput(input)
  }
}

// Read-only check: does this origin already have MIDI access granted from
// a previous session? Never prompts -- the Permissions API is a silent
// state query, unlike requestMIDIAccess() itself.
export async function isMidiControlGranted() {
  if (!navigator.permissions?.query) return false
  try {
    const status = await navigator.permissions.query({
      name: "midi",
      sysex: false,
    })
    return status.state === "granted"
  } catch {
    // Some browsers don't recognize "midi" as a queryable permission name
    // at all and throw rather than resolve "prompt" -- treat the same as
    // not-yet-granted rather than letting it break the caller.
    return false
  }
}

export function isMidiControlActive() {
  return midiAccess !== null
}

// The only function in this module allowed to trigger the permission
// prompt -- call this only from a direct, deliberate user action (a menu
// checkbox or settings toggle), never from a passive gesture.
export async function enableMidiControl() {
  if (midiAccess) return midiAccess
  await ensureDeviceConfig()
  enabling ??= navigator.requestMIDIAccess().then((access) => {
    midiAccess = access
    reconcileAttachedInputs()
    // A device plugged in after access was granted -- MIDIAccess.inputs
    // only reflects whatever was connected at request time otherwise.
    access.onstatechange = ({ port }) => {
      if (port.type !== "input") return
      if (port.state === "connected") reconcileAttachedInputs()
      else detachInput(port)
    }
    return access
  })
  try {
    return await enabling
  } finally {
    enabling = null
  }
}

// There's no real "revoke" for Web MIDI once the browser has granted it --
// only the user can undo that, in the browser's own site permissions UI.
// This just stops this module from acting on incoming messages, which is
// the only thing actually meaningful to "turn off" from in-app UI.
export function disableMidiControl() {
  if (!midiAccess) return
  for (const input of midiAccess.inputs.values()) detachInput(input)
  midiAccess.onstatechange = null
  midiAccess = null
}

// Silent, never prompts (see isMidiControlGranted() above) -- auto-
// activates if a previous session already granted access, so the user
// isn't stuck re-flipping the Mixer checkbox every single time.
export async function autoActivateMidiControlIfGranted() {
  if (await isMidiControlGranted()) await enableMidiControl()
}

// No dedicated OS-boot hook to attach this to -- instead it runs once, the
// moment this module is first imported by anything (knob.js, the Mixer's
// menu, or any future consumer), which naturally only happens on a page
// that actually uses one of those. Safe to call from multiple importers:
// enableMidiControl() itself is idempotent (returns the cached access if
// already active).
autoActivateMidiControlIfGranted()

export function bind(key, el, apply) {
  // Unbind BEFORE creating/inserting this key's Set, not after -- doing it
  // after was a real bug: unbindElement()'s own "delete the key if its Set
  // is now empty" cleanup was deleting the *freshly created, still-empty*
  // Set for this very `key` (inserted into `bindings` a couple lines
  // earlier, entry not added yet), silently orphaning it from the map
  // right before .add() below populated it -- console.debug() still fired
  // (the local `set` variable still pointed at a real Set), but `bindings`
  // itself no longer had any entry for `key` a moment later. An element
  // only ever holds one binding at a time -- learning a new CC for an
  // already-bound control replaces it rather than adding a second
  // (many-to-one is CC -> multiple elements, not the other way around).
  unbindElement(el)
  let set = bindings.get(key)
  if (!set) bindings.set(key, (set = new Set()))
  set.add({ el, apply })
  // Only visible feedback right now that a learn actually captured
  // something -- cheap and useful for confirming the pipeline works at all
  // while this is new, without popping a toast on every single assignment.
  console.debug(`MIDI Learn: bound "${key}" to`, el)
}

export function unbindElement(el) {
  for (const [key, set] of bindings) {
    for (const entry of set) {
      if (entry.el === el) set.delete(entry)
    }
    if (set.size === 0) bindings.delete(key)
  }
}

export function isElementBound(el) {
  for (const set of bindings.values()) {
    for (const entry of set) if (entry.el === el) return true
  }
  return false
}

// Arms `el` to learn the next incoming MIDI message; `apply(value)` is
// called with 0-127 on every future message matching whatever gets
// learned as a result. `kind: "note"` restricts learning to Note messages
// only (see handleMessage() above) -- for buttons/toggles, which want
// physical button presses, not a nearby knob's CC.
export function arm(el, apply, { kind } = {}) {
  learnTarget = el
  learnApply = apply
  learnKind = kind ?? null
}

export function disarm(el) {
  if (learnTarget === el) {
    learnTarget = null
    learnApply = null
    learnKind = null
  }
}

// Shared wiring behind every attach*MidiLearn() below -- core.js's single
// delegated "focusin" listener calls the right one of these for whatever
// element type just got focused, which is what makes MIDI Learn "automatic
// everywhere" rather than opt-in per app the way knob.js's own (separate,
// near-identical) wiring is.
//
const ARM_HOLD_DELAY = 1000

export function attachMidiLearnCommon(el, apply, { kind, onArmChange } = {}) {
  if (el.midiLearnAttached) return
  el.midiLearnAttached = true

  let armed = false
  let armTimeoutId
  let disarmTimeoutId

  const setArmed = (value) => {
    armed = value
    onArmChange?.(armed)
  }

  const doDisarm = () => {
    disarm(el)
  }

  el.addEventListener("keydown", (e) => {
    if (el.disabled) return
    const key = e.key.toLocaleLowerCase()
    if (key === "alt") {
      if (e.repeat) return
      clearTimeout(disarmTimeoutId)
      clearTimeout(armTimeoutId)
      armTimeoutId = setTimeout(() => {
        setArmed(true)
        arm(el, apply, { kind })
      }, ARM_HOLD_DELAY)
    } else if (armed && (e.key === "Delete" || e.key === "Backspace")) {
      unbindElement(el)
    }
  })

  el.addEventListener("keyup", (e) => {
    if (e.key.toLocaleLowerCase() !== "alt") return
    clearTimeout(armTimeoutId)
    if (!armed) return
    setArmed(false)
    clearTimeout(disarmTimeoutId)
    disarmTimeoutId = setTimeout(doDisarm, 400)
  })

  el.addEventListener("blur", () => {
    clearTimeout(armTimeoutId)
    setArmed(false)
    clearTimeout(disarmTimeoutId)
    doDisarm()
  })
}

// Any plain <input type="range">. CC or Note velocity, either scaled
// linearly into the slider's own min/max.
export function attachRangeMidiLearn(el) {
  attachMidiLearnCommon(el, (value) => {
    const min = Number(el.min) || 0
    const max = el.max === "" ? 100 : Number(el.max)
    const scaled = scale(value, 0, 127, min, max)
    if (String(scaled) === el.value) return
    el.value = String(scaled)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

// Any plain <select>. CC (or Note velocity) 0-127 scaled across however
// many <option>s it has, same idea as a range slider but landing on a
// whole option instead of a continuous value.
export function attachSelectMidiLearn(el) {
  attachMidiLearnCommon(el, (value) => {
    const count = el.options.length
    if (count === 0) return
    const index = Math.min(count - 1, Math.floor(scale(value, 0, 127, 0, count)))
    if (el.selectedIndex === index) return
    el.selectedIndex = index
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

// Any <button>, <input type="button">, <input type="checkbox">, or
// aria-pressed toggle button (this OS's convention for a toggle that isn't
// a checkbox -- e.g. the Mixer's Mute/Solo/Send buttons, plain
// <button aria-pressed="...">, flipped by their own press handler rather
// than any native browser behavior -- see e.g. index.js's
// "pointerdown || Space || Enter": () => track.toggleMute()). Notes only
// -- see handleMessage()'s learnKind check above -- a CC arriving while
// armed is ignored rather than learned, since these are meant to be
// triggered by an actual physical button/pad press, not whatever knob
// happens to be nearby.
//
// Simulates a press on press (Note On, velocity > 0), nothing on release
// (Note Off, or Note On velocity 0) -- same as a mouse click doesn't have
// a separate meaningful "release" for a plain button.
//
// Dispatches a real pointerdown *and* click() -- checked directly against
// this codebase: plenty of buttons react to "pointerdown" specifically,
// not "click" (basicPlayer.js's own Play/Pause button, the Mixer's Mute/
// Solo/Send buttons -- the "pointer-instant" styling is the same pattern
// each time), so click() alone was silently inert for those. An earlier
// version of this only called click(), on the assumption that it already
// fires the full native event sequence and lets each element's own
// handler decide what "pressed" means -- true for elements that actually
// listen for click, but not the ones here that don't.
function simulatePress(el) {
  el.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
  )
  el.click()
}

export function attachButtonMidiLearn(el) {
  attachMidiLearnCommon(
    el,
    (value) => {
      if (value > 0) simulatePress(el)
    },
    { kind: "note" },
  )
}

// Any <ui-icon> (desktop and file-explorer app/file/folder icons --
// 42/ui/media/icon.js, shared by both). Notes only, same reasoning as
// attachButtonMidiLearn() above.
//
// Not el.click() -- a single click on an icon selects it, it's a *double*
// click (or Enter, already wired as an equivalent -- see explorer.js's
// delegated "touchend || dblclick || Enter" handler on "ui-icon") that
// opens it. Dispatching a synthetic Enter keydown reaches that same
// existing handler exactly like a physical Enter press would, without
// needing to reach into explorer.js's own closures (go()/explorer()/etc.)
// directly.
export function attachIconMidiLearn(el) {
  attachMidiLearnCommon(
    el,
    (value) => {
      if (value === 0) return
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      )
    },
    { kind: "note" },
  )
}
