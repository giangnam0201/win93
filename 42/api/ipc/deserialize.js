// @ts-ignore
export function deserializeError({ _42_SERIALIZED_, ...obj } = {}) {
  if (!_42_SERIALIZED_ || _42_SERIALIZED_ !== "Error") return
  return Object.assign(new Error(), obj)
}
