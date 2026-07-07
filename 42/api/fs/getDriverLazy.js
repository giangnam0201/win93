import { FS_DRIVER_MASKS } from "./FileIndex.js"

const drivers = {}

export async function getDriverLazy(name) {
  const type = typeof name
  if (type === "function") return name

  name = type === "number" ? FS_DRIVER_MASKS[name] : name.toLowerCase()

  if (drivers[name]) return drivers[name]

  const { driver } = await import(`./driver/${name}Driver.js`)
  drivers[name] = await driver(getDriverLazy)
  return drivers[name]
}
