import { FS_DRIVER_MASKS } from "./FileIndex.js"

import { driver as indexeddb } from "./driver/indexeddbDriver.js"
import { driver as localstorage } from "./driver/localstorageDriver.js"
import { driver as memory } from "./driver/memoryDriver.js"
import { driver as opfs } from "./driver/opfsDriver.js"

const modules = {
  indexeddb,
  localstorage,
  memory,
  opfs,
}

const drivers = {}

export async function getDriver(name) {
  const type = typeof name
  if (type === "function") return name

  name = type === "number" ? FS_DRIVER_MASKS[name] : name.toLowerCase()

  if (drivers[name]) return drivers[name]

  drivers[name] = await modules[name](getDriver)
  return drivers[name]
}
