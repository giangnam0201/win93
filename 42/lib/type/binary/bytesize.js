// @thanks http://stackoverflow.com/a/18650828
// @read https://stackoverflow.com/a/25651291

import { round } from "../number/precision.js"

const K_SI = 1000 // 10 ** 3
const K_IEC = 1024 // 2 ** 10

const UNITS = {
  IEC: ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"],
  SI: ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
}

const DEFAULTS = {
  SI: true,
  unit: undefined,
  locale: "en-US",
  decimals: 2,
  returnString: true,
}

const { floor, log } = Math

function toString() {
  return `${this.string}`
}

function formatSize(size, locale, minimumFractionDigits) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumSignificantDigits: 6,
    roundingPriority: "lessPrecision",
  }).format(size)
}

/**
 * @overload
 * @param {number | Blob | File | ArrayBuffer | ArrayBufferView} bytes
 * @param {Partial<DEFAULTS> & {returnString: false}} options
 * @returns {{ size: string, unit: string, string: string, toString: typeof toString }}
 */
/**
 * @overload
 * @param {number | Blob | File | ArrayBuffer | ArrayBufferView} bytes
 * @param {Partial<DEFAULTS> & {returnString: true}} options
 * @returns {string}
 */
/**
 * @overload
 * @param {number | Blob | File | ArrayBuffer | ArrayBufferView} bytes
 * @returns {string}
 */
/**
 * @param {number | Blob | File | ArrayBuffer | ArrayBufferView} bytes
 * @param {Partial<DEFAULTS>} [options]
 */
export function bytesize(bytes, options) {
  if (!Number.isInteger(bytes)) {
    // @ts-ignore
    if ("size" in bytes) bytes = bytes.size
    // @ts-ignore
    else if ("byteLength" in bytes) bytes = bytes.byteLength
  }

  let nBytes = /** @type {number} */ (bytes)

  let {
    SI,
    unit: desiredUnit,
    locale,
    decimals,
    returnString,
  } = { ...DEFAULTS, ...options }

  if (nBytes === 0) {
    const string = `${formatSize(0, locale, decimals)} B`
    return returnString ? string : { size: 0, unit: "B", string, toString }
  }

  let prefix = SI ? "SI" : "IEC"

  let i

  if (desiredUnit) {
    i = UNITS[prefix].indexOf(desiredUnit)
    if (i === -1) {
      SI = !SI
      prefix = SI ? "SI" : "IEC"
      i = UNITS[prefix].indexOf(desiredUnit)
      if (i === -1) {
        SI = DEFAULTS.SI
        prefix = SI ? "SI" : "IEC"
        i = undefined
      }
    }
  }

  const units = UNITS[prefix]

  const k = SI ? K_SI : K_IEC

  i ??= floor(log(nBytes) / log(k))
  const unit = units[i]
  nBytes = round(nBytes / k ** i, decimals)

  const size = formatSize(nBytes, locale, decimals)

  const string = `${size} ${unit}`
  return returnString ? string : { size, unit, string, toString }
}
