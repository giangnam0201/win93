import { normalizeError } from "../../lib/type/error/normalizeError.js"
import { formatError } from "./formatters/formatError.js"
import { logAsHTML } from "./logAsHTML.js"

/**
 * @import { ErrorLike } from "../../lib/type/error/normalizeError.js"
 * @import { FormatErrorOptions } from "./formatters/formatError.js"
 */

/**
 * @typedef {FormatErrorOptions & {
 *   returnString?: boolean;
 * }} DisplayErrorOptions
 */

/**
 * @overload
 * @param {ErrorLike} error
 * @param {DisplayErrorOptions & { returnString?: true; }} options
 * @returns {string}
 */
/**
 * @overload
 * @param {ErrorLike} error
 * @param {DisplayErrorOptions} [options]
 * @returns {DocumentFragment}
 */
/**
 * @param {ErrorLike} error
 * @param {DisplayErrorOptions} [options]
 */
export function displayError(error, options) {
  const formated = formatError(normalizeError(error), {
    ...options,
    markdown: !options?.returnString,
  })

  if (options?.returnString) return formated

  return logAsHTML(formated)
}
