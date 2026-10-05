/* eslint-disable eqeqeq */

import { isInstanceOf } from "./isInstanceOf.js"

export { isInstanceOf } from "./isInstanceOf.js"
export { isDirectInstanceOf } from "./isDirectInstanceOf.js"
export { isEmpty } from "./isEmpty.js"
export { isObject } from "./isObject.js"
export { isObjectOrArray } from "./isObjectOrArray.js"
export { isPlainObject } from "./isPlainObject.js"
export { isHashmap } from "./isHashmap.js"
export { isHashmapLike } from "./isHashmapLike.js"
export { isEmptyObject } from "./isEmptyObject.js"
export { isProxy } from "./isProxy.js"
export { isLength } from "./isLength.js"
export { isArrayLike } from "./isArrayLike.js"
export { isTypedArray } from "./isTypedArray.js"
export { isIterable } from "./isIterable.js"
export { isIterator } from "./isIterator.js"
export { isPromiseLike } from "./isPromiseLike.js"
export { isTemplateObject } from "./isTemplateObject.js"
export { isErrorLike } from "./isErrorLike.js"
export { isGeneratorFunction } from "./isGeneratorFunction.js"
export { isAsyncFunction } from "./isAsyncFunction.js"
export { isMultipleOf } from "../number/isMultipleOf.js"
export { isFloat } from "../number/isFloat.js"
export { isPositiveInteger } from "../number/isPositiveInteger.js"

export const { isFrozen } = Object
export const { isArray } = Array

export const { isSafeInteger } = Number
export const { isInteger } = Number
export const { isFinite } = Number
export const { isNaN } = Number
/** @returns {val is number} */
export const isNumber = (val) => typeof val === "number"
/** @returns {val is udefined | null} */
export const isNil = (val) => val == undefined
/** @returns {val is null} */
export const isNull = (val) => val === null

/** @returns {val is undefined} */
export const isUndefined = (val) => val === undefined
export const isFalsy = (val) => Boolean(val) === false
export const isTruthy = (val) => Boolean(val) === true

/** @returns {val is boolean} */
export const isBoolean = (val) => typeof val === "boolean"
/** @returns {val is string} */
export const isString = (val) => typeof val === "string"
/** @returns {val is symbol} */
export const isSymbol = (val) => typeof val === "symbol"
/** @returns {val is Function} */
export const isFunction = (val) => typeof val === "function"
/** @returns {val is Set} */
export const isSet = (val) => isInstanceOf(val, Set)
/** @returns {val is Map} */
export const isMap = (val) => isInstanceOf(val, Map)
/** @returns {val is Date} */
export const isDate = (val) => isInstanceOf(val, Date)
/** @returns {val is Error} */
export const isError = (val) => isInstanceOf(val, Error)
/** @returns {val is Promise} */
export const isPromise = (val) => isInstanceOf(val, Promise)

/** @returns {val is Map | Set} */
export const isMapOrSet = (val) => isMap(val) || isSet(val)

/** @returns {val is ArrayBuffer} */
export const isArrayBuffer = (val) => isInstanceOf(val, ArrayBuffer)
/** @returns {val is DataView} */
export const isDataView = (val) => isInstanceOf(val, DataView)
/** @returns {val is ArrayBufferView} */
export const isArrayBufferView = (val) => ArrayBuffer.isView(val)

export const isEmptyArray = (val) => val?.length === 0

/** @returns {val is Element} */
export const isElement = (val) => val?.nodeType === Node.ELEMENT_NODE
