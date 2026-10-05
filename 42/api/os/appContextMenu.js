import { AppAgent } from "./AppAgent.js"
import { appsManager } from "./managers/appsManager.js"
import { mimetypesManager } from "./managers/mimetypesManager.js"
import { ensureURL } from "./ensureURL.js"

/**
 * Merge app menu contributions without mutating their plans.
 * @param {Array<{name: string, items: import("../gui/render.js").PlanArray}>} contributions
 * @returns {import("../gui/render.js").PlanArray}
 */
export function mergeAppMenuItems(contributions) {
  const entries = contributions.flatMap(({ name, items }) =>
    items.map((item) => ({ name, item })),
  )
  const groups = new Map()
  for (const entry of entries) {
    const label = entry.item?.label
    if (typeof label !== "string") continue
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(entry)
  }
  const merged = new Set()
  const out = []
  for (const { name, item } of entries) {
    const group = groups.get(item?.label)
    if (!group || new Set(group.map((entry) => entry.name)).size < 2) {
      out.push(typeof item === "object" ? { ...item } : item)
    } else if (group.every((entry) => Array.isArray(entry.item.content))) {
      if (merged.has(item.label)) continue
      merged.add(item.label)
      out.push({
        ...item,
        content: mergeAppMenuItems(
          group.map((entry) => ({
            name: entry.name,
            items: entry.item.content,
          })),
        ),
      })
    } else {
      out.push({ ...item, label: `${item.label} (${name})` })
    }
  }
  return out
}

/**
 * @param {string[]} selection
 * @returns {Promise<import("../gui/render.js").PlanArray>}
 */
export async function makeAppContextMenu(selection) {
  if (selection.length === 0) return []
  await Promise.all([appsManager.ready, mimetypesManager.ready])
  const contributions = await Promise.all(
    Object.values(appsManager.value).map(async (manifest) => {
      if (!manifest.contextMenu || !manifest.module) return
      const agent = new AppAgent(manifest, selection)
      if (agent.getSupportedSelection().length === 0) return
      try {
        const module = await import(
          await ensureURL(agent.resolveURL(manifest.module))
        )
        const items = await module.renderContextMenu?.(agent)
        if (items?.length) return { name: agent.name, items }
      } catch (err) {
        console.error(`Could not render ${agent.name} context menu`, err)
      }
    }),
  )
  return mergeAppMenuItems(contributions.filter(Boolean))
}
