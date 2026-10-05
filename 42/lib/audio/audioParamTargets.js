import { getDesktopRealm } from "../../api/env/realm/getDesktopRealm.js"

const realm = getDesktopRealm()
const key = Symbol.for("sys42.audioParamTargets")
/** Shared by same-origin iframe controls and the desktop patch editor. */
realm[key] ??= new Map()
export const audioParamTargets = realm[key]

const eventsKey = Symbol.for("sys42.audioParamTargetEvents")
realm[eventsKey] ??= new realm.EventTarget()
export const audioParamTargetEvents = realm[eventsKey]

/** Notify the desktop when a control binds or releases an AudioParam. */
export function notifyAudioParamTargets() {
  audioParamTargetEvents.dispatchEvent(new realm.Event("change"))
}

const bindingsKey = Symbol.for("sys42.audioParamBindings")
realm[bindingsKey] ??= new Map()
/** AudioParam binding metadata shared with the mixer across realms. */
export const audioParamBindings = realm[bindingsKey]
