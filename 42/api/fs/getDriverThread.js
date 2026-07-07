import { threadify } from "../threadify.js"
import { FS_DRIVER_MASKS } from "./FileIndex.js"

const drivers = {}

export async function getDriverThread(name) {
  const type = typeof name
  if (type === "function") return name

  name = type === "number" ? FS_DRIVER_MASKS[name] : name.toLowerCase()

  if (drivers[name]) return drivers[name]

  const thread = await threadify(
    import.meta.resolve(`./driver/${name}Driver.js`),
  )
  const { driver } = thread.module
  drivers[name] = await driver()
  return drivers[name]
}
