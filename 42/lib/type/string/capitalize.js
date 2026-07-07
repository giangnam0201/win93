/**
 * @param {string} str
 * @param {{force: boolean}} [options]
 * @returns {string}
 */
export const capitalize = (str, options) =>
  options?.force
    ? str.charAt(0).toLocaleUpperCase() + str.slice(1).toLocaleLowerCase()
    : str.charAt(0).toLocaleUpperCase() + str.slice(1)
