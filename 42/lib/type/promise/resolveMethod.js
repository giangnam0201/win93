export function resolveMethod(obj, methods, resolver) {
  methods = [methods].flat()

  let resolved

  for (const item of methods) {
    obj[item] = async (...args) => {
      resolved ??= await resolver()

      if (typeof resolved === "function") {
        const res = resolved.call(obj, ...args)
        obj[item] = resolved
        return res
      }

      const res = resolved[item].call(obj, ...args)
      for (const item of methods) obj[item] = resolved[item]
      return res
    }
  }

  return obj
}
