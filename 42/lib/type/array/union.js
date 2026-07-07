export function union(...args) {
  return [...new Set(args.flat())]
}
