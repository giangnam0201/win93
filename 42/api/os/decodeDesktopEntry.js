import { fs } from "../fs.js"
import { decodeINI } from "../../formats/data/INI/decodeINI.js"

export async function decodeDesktopEntry(path) {
  const text = await fs.readText(path)
  if (!text) return

  const ini = decodeINI(text)["Desktop Entry"]
  if (!ini) return

  return ini
}
