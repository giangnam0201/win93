import { isInstanceOf } from "./isInstanceOf.js"

const TypedArray = /** @type {Function} */ (Reflect.getPrototypeOf(Int8Array))

/**
 * @typedef {Int8Array
 *   | Uint8Array
 *   | Uint8ClampedArray
 *   | Int16Array
 *   | Uint16Array
 *   | Int32Array
 *   | Uint32Array
 *   | Float32Array
 *   | Float64Array
 *   | BigInt64Array
 *   | BigUint64Array
 * } TypedArray
 */

/**
 * @param {any} val
 * @returns {val is TypedArray}
 */
export const isTypedArray = (val) => isInstanceOf(val, TypedArray)
