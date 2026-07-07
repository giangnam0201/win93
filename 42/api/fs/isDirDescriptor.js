export function isDirDescriptor(desc) {
  if (desc == null || desc === 0 || Array.isArray(desc)) return false
  return typeof desc === "object"
}
