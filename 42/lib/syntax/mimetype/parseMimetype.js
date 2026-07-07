// @read https://mimesniff.spec.whatwg.org

/**
 * @typedef {{
 *   essence: string
 *   type: string
 *   subtype: string
 *   prefix: string
 *   suffix: string
 * }} MimeType
 */

// TODO: write real parser

/**
 *
 * @param {string} mimetype
 * @returns {MimeType}
 */
export function parseMimetype(mimetype) {
  let [type, subtype = "*"] = mimetype.trim().toLowerCase().split("/")
  const [prefix, suffix = ""] = subtype.split("+")

  type ||= "*"

  return {
    essence: `${type}/${subtype}`,
    type,
    subtype,
    prefix,
    suffix,
  }
}
