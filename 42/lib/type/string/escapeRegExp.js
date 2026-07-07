export const escapeRegExp = (str) =>
  str.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&")
