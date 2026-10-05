import { getStemname } from "../../lib/syntax/path/getStemname.js"
import { toKebabCase } from "../../lib/type/string/transform.js"
import { timeout } from "../../lib/timing/timeout.js"

/**
 * @param {string | URL | (string | URL)[]} components
 * @param {Window} [realm]
 */
export async function injectComponents(components, realm = window) {
  const undones = []

  for (const item of [components].flat()) {
    const url = String(item)
    const tagName = "ui-" + toKebabCase(getStemname(url))
    if (realm.customElements.get(tagName)) continue
    undones.push(
      // @ts-ignore
      realm.sys42?.load.script(url, { type: "module" }).then(() =>
        Promise.race([
          realm.customElements.whenDefined(tagName), //
          timeout(3000, `${tagName} component wasn't defined`),
        ]),
      ),
    )
  }

  return Promise.all(undones)
}
