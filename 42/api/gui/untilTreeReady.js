import { getAllChildrens } from "../../lib/type/element/getAllChildrens.js"

export async function untilTreeReady(el) {
  const undones = []
  for (const item of getAllChildrens(el)) {
    if ("ready" in item) undones.push(item.ready)
  }
  await Promise.all(undones)
}
