import { fileIndex } from "/42/api/fileIndex.js"

export const DEFAULT_SOUNDFONT =
  "/c/libs/chip-player-js/soundfonts/gmgsx-plus.sf2"

function humanize(filename) {
  return filename
    .replace(/\.sf2$/i, "")
    .replaceAll(/_+/g, " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim()
}

// Soundfont collections conventionally live below a directory named
// "soundfonts". Keep its first child directory as the optgroup, regardless
// of where that collection lives in the file index. A loose .sf2 outside a
// collection is grouped by its immediate parent directory instead.
function groupFromPath(path) {
  const parts = path.split("/").filter(Boolean)
  const soundfontsIndex = parts
    .map((part) => part.toLowerCase())
    .lastIndexOf("soundfonts")
  if (soundfontsIndex !== -1) {
    return parts.length > soundfontsIndex + 2
      ? parts[soundfontsIndex + 1]
      : null
  }
  return parts.length > 1 ? parts.at(-2) : null
}

// Use absolute file-index paths as values: two soundfonts with the same name
// can coexist, and .sf2 files may be placed anywhere in the filesystem.
export const SOUNDFONTS = fileIndex
  .glob("**/*.sf2", "i")
  .map((path) => ({
    label: humanize(path.split("/").pop()),
    value: path,
    group: groupFromPath(path),
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function groupedSoundfontOptions() {
  const rootItems = []
  const groups = new Map()
  for (const soundfont of SOUNDFONTS) {
    const item = [soundfont.label, soundfont.value]
    if (soundfont.group === null) {
      rootItems.push(item)
    } else {
      if (!groups.has(soundfont.group)) groups.set(soundfont.group, [])
      groups.get(soundfont.group).push(item)
    }
  }
  const optgroups = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, items]) => ({ tag: "optgroup", label, content: items }))
  return [...rootItems, ...optgroups]
}

// Accept filename-only and old directory-relative persisted values, matching
// by basename before falling back to the bundled default soundfont.
export function resolveSoundfontValue(value) {
  if (SOUNDFONTS.some((soundfont) => soundfont.value === value)) return value
  const basename = value?.split("/").pop()
  const match =
    basename &&
    SOUNDFONTS.find(
      (soundfont) => soundfont.value.split("/").pop() === basename,
    )
  return match?.value ?? DEFAULT_SOUNDFONT
}
