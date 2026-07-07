export function getAllMethodNames(obj) {
  const methods = new Set()
  while ((obj = Reflect.getPrototypeOf(obj))) {
    if (obj.constructor === Object) continue
    for (const item of Reflect.ownKeys(obj)) {
      if (
        typeof item !== "string" ||
        item === "constructor" ||
        item.startsWith("__")
      ) {
        continue
      }
      methods.add(item)
    }
  }
  return Array.from(methods)
}
