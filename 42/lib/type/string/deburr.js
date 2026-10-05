// @src https://twitter.com/LeaVerou/status/934590045708840960
// https://stackoverflow.com/a/37511463/1289275

/**
 * @param {string} str
 * @returns {string}
 */
export function deburr(str) {
  return str
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .replaceAll("ñ", "n")
}
