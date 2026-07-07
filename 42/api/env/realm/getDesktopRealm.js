/** @import {Os} from "../../os.js" */
/** @returns {Window & typeof globalThis & {sys42: Os, os: Os}} */
export function getDesktopRealm() {
  if (globalThis.window === undefined) {
    // @ts-ignore
    return globalThis
  }

  /** @type {Window} */
  let realm = globalThis.window

  while (realm !== globalThis.top) {
    if (realm.name === "desktop") break
    realm = realm.parent
  }

  // @ts-ignore
  return realm
}
