export function zalgo(str, options) {
  const intensity = options?.intensity ?? 30
  return str.replaceAll(
    /([A-Za-z])/g,
    (_, c) =>
      c +
      new Array(Math.floor(Math.random() * intensity) + 1)
        .fill()
        .map(() => String.fromCharCode(0x3_00 + Math.floor(Math.random() * 79)))
        .join("")
        .replaceAll("̿", "")
        .replaceAll("̳", "")
        .replaceAll("̚", ""),
  )
}
