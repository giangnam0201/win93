export function setFileRelativePath(file, relativePath) {
  if (relativePath.startsWith("/")) relativePath = relativePath.slice(1)
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    enumerable: true,
    writable: false,
    value: relativePath,
  })
}
