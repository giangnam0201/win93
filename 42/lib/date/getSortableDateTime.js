import { isInstanceOf } from "../type/any/isInstanceOf.js"

/**
 * @typedef {{
 *   human?: boolean;
 *   time?: boolean;
 *   seconds?: boolean;
 *   dateSep?: string;
 *   hourSep?: string;
 *   sep?: string;
 * }} SortableDateTimeOptions
 */

/**
 * @overload
 * @param {SortableDateTimeOptions} [time]
 * @returns {string}
 */
/**
 * @overload
 * @param {number | string | Date} time
 * @param {SortableDateTimeOptions} [options]
 * @returns {string}
 */
/**
 * @param {number | string | Date | SortableDateTimeOptions} [time]
 * @param {SortableDateTimeOptions} [options]
 * @returns {string}
 */
export function getSortableDateTime(time = new Date(), options) {
  // @ts-ignore
  if (options?.human) return getSortableDateTimeHumanReadable(time)

  let date
  if (typeof time === "number" || typeof time === "string") {
    date = new Date(time)
  } else if (!options && !isInstanceOf(time, Date)) {
    options = time
    date = new Date()
  } else {
    date = /** @type {Date} */ (time)
  }

  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  if (options?.time !== false) {
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")

    if (options?.seconds === true) {
      const seconds = String(date.getSeconds()).padStart(2, "0")
      return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
    }

    return `${year}-${month}-${day}_${hours}-${minutes}`
  }

  return `${year}-${month}-${day}`
}

/**
 * @param {number | string | Date} [time]
 */
export function getSortableDateTimeHumanReadable(time) {
  let date
  if (!time) date = new Date()
  else if (typeof time === "number") date = new Date(time)
  return `${date.toLocaleDateString("zh-CN")} ${date.toLocaleTimeString("zh-CN")}`
}

/**
 * @param {number | string | Date} [time]
 */
export function getSortableTimeHumanReadable(time) {
  let date
  if (!time) date = new Date()
  else if (typeof time === "number") date = new Date(time)
  return date.toLocaleTimeString("zh-CN")
}

export const d = getSortableDateTimeHumanReadable
export const t = getSortableTimeHumanReadable
