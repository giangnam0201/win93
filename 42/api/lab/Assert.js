/* eslint-disable no-unused-expressions */
/* eslint-disable unicorn/no-object-as-default-parameter */

import { AssertionError } from "./AssertionError.js"
import { equals } from "../../lib/type/any/equals.js"
import { indefiniteArticle } from "../../lib/type/string/indefiniteArticle.js"
import { getTypeOf } from "../../lib/type/any/getTypeOf.js"
import * as is from "../../lib/type/any/is.js"

/**
 * @typedef {(actual: any, message?: string, details?: object) => void} ActualFn
 * @typedef {(actual: any, expected: any, message?: string, details?: object) => void} ActualExpectedFn
 * @typedef {(string: string, regex: RegExp, message?: string, details?: object) => void} StringRegexFn
 */

const placeholder = Symbol.for("Assert.PLACEHOLDER")

export class Assert {
  static PLACEHOLDER = placeholder

  _call() {}

  /**
   * Assert that `actual` is strictly true.
   * @type ActualFn
   */
  true(actual, message, details = { actual }) {
    this._call()
    if (actual !== true) {
      throw new AssertionError(message ?? "Value is not true", details)
    }
  }

  /**
   * Assert that `actual` is strictly false.
   * @type ActualFn
   */
  false(actual, message, details = { actual }) {
    this._call()
    if (actual !== false) {
      throw new AssertionError(message ?? "Value is not false", details)
    }
  }

  /**
   * Assert that `actual` is [truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy).
   * @type ActualFn
   */
  truthy(actual, message, details = { actual }) {
    this._call()
    if (Boolean(actual) !== true) {
      throw new AssertionError(message ?? "Value is not truthy", details)
    }
  }

  /**
   * Assert that `actual` is [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy).
   * @type ActualFn
   */
  falsy(actual, message, details = { actual }) {
    this._call()
    if (Boolean(actual) !== false) {
      throw new AssertionError(message ?? "Value is not falsy", details)
    }
  }

  /**
   * Assert that `actual` is [the same value](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) as `expected`.
   * @type ActualExpectedFn
   */
  is(actual, expected, message, details = { actual, expected }) {
    this._call()
    if (!Object.is(actual, expected)) {
      if (equals(actual, expected)) {
        throw new AssertionError(
          message ?? "Values are deeply equal but are not the same",
        )
      } else {
        throw new AssertionError(message ?? "Values are not the same", details)
      }
    }
  }

  /**
   * Assert that `actual` is not [the same value](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) as `expected`.
   * @type ActualExpectedFn
   */
  not(actual, expected, message, details = { actual, expected }) {
    this._call()
    if (Object.is(actual, expected)) {
      throw new AssertionError(message ?? "Values are the same", details)
    }
  }

  /**
   * Assert that `actual` is deeply equal to `expected`.
   * @type ActualExpectedFn
   */
  eq(actual, expected, message, details = { actual, expected }) {
    this._call()
    if (equals(actual, expected, { placeholder }) === false) {
      if (equals(actual, expected, { proto: false })) {
        throw new AssertionError(
          message ?? "Values are deeply equal but have not the same prototype",
          details,
        )
      }

      throw new AssertionError(
        message ?? "Values are not deeply equal",
        details,
      )
    }
  }

  /**
   * Assert that `actual` is not deeply equal to `expected`.
   * @type ActualExpectedFn
   */
  notEq(actual, expected, message, details = { actual, expected }) {
    this._call()
    if (equals(actual, expected, { placeholder })) {
      throw new AssertionError(message ?? "Values are deeply equal", details)
    }
  }

  /**
   * Assert that `string` matches the regular expression.
   * @type StringRegexFn
   */
  regex(string, regex, message, details) {
    this._call()
    if (!string.match(regex)) {
      throw new AssertionError(
        message ?? "Value must match regex",
        details ?? { string, regex },
      )
    }
  }

  /**
   * Assert that `string` does not match the regular expression.
   * @type StringRegexFn
   */
  notRegex(string, regex, message, details) {
    this._call()
    if (string.match(regex)) {
      throw new AssertionError(
        message ?? "Value must not match regex",
        details ?? { string, regex },
      )
    }
  }
}

for (const [key, check] of /** @type {[string, any]} */ (Object.entries(is))) {
  const keyNot = `isNot${key.slice(2)}`

  const thisType = indefiniteArticle(
    key === "isNaN" ? "NaN" : key.charAt(2).toLowerCase() + key.slice(3),
  )

  if (key === "isInstanceOf" || key === "isDirectInstanceOf") {
    const an = key === "isDirectInstanceOf" ? "a direct" : "an"
    Assert.prototype[key] = function (
      actual,
      expected,
      message,
      details = { actual, expected },
    ) {
      this._call()
      if (check(actual, expected) === false) {
        throw new AssertionError(
          message ?? `Value is not ${an} instance of ${getTypeOf(expected)}`,
          details,
        )
      }
    }

    Assert.prototype[keyNot] = function (
      actual,
      expected,
      message,
      details = { actual, expected },
    ) {
      this._call()
      if (check(actual, expected) === true) {
        throw new AssertionError(
          message ??
            `Value should not be ${an} instance of ${getTypeOf(expected)}`,
          details,
        )
      }
    }

    continue
  }

  Assert.prototype[key] = function (actual, message, details = { actual }) {
    this._call()
    if (check(actual) === false) {
      throw new AssertionError(
        message ?? `Value is not ${thisType}, got: ${getTypeOf(actual)}`,
        details,
      )
    }
  }

  Assert.prototype[keyNot] = function (actual, message, details = { actual }) {
    this._call()
    if (check(actual) === true) {
      throw new AssertionError(
        message ?? `Value should not be ${thisType}`,
        details,
      )
    }
  }
}

/** @type {ActualExpectedFn} */ Assert.prototype.isInstanceOf
/** @type {ActualExpectedFn} */ Assert.prototype.isDirectInstanceOf

/** @type {ActualFn} */ Assert.prototype.isObject
/** @type {ActualFn} */ Assert.prototype.isObjectOrArray
/** @type {ActualFn} */ Assert.prototype.isPlainObject
/** @type {ActualFn} */ Assert.prototype.isHashmap
/** @type {ActualFn} */ Assert.prototype.isHashmapLike
/** @type {ActualFn} */ Assert.prototype.isEmptyObject
/** @type {ActualFn} */ Assert.prototype.isProxy
/** @type {ActualFn} */ Assert.prototype.isLength
/** @type {ActualFn} */ Assert.prototype.isArrayLike
/** @type {ActualFn} */ Assert.prototype.isIterable
/** @type {ActualFn} */ Assert.prototype.isPromiseLike
/** @type {ActualFn} */ Assert.prototype.isTemplateObject
/** @type {ActualFn} */ Assert.prototype.isErrorLike
/** @type {ActualFn} */ Assert.prototype.isGeneratorFunction
/** @type {ActualFn} */ Assert.prototype.isAsyncFunction
/** @type {ActualFn} */ Assert.prototype.isMultipleOf
/** @type {ActualFn} */ Assert.prototype.isPositiveInteger
/** @type {ActualFn} */ Assert.prototype.isSafeInteger
/** @type {ActualFn} */ Assert.prototype.isInteger
/** @type {ActualFn} */ Assert.prototype.isFinite
/** @type {ActualFn} */ Assert.prototype.isNaN
/** @type {ActualFn} */ Assert.prototype.isNumber
/** @type {ActualFn} */ Assert.prototype.isFloat
/** @type {ActualFn} */ Assert.prototype.isNil
/** @type {ActualFn} */ Assert.prototype.isNull
/** @type {ActualFn} */ Assert.prototype.isUndefined
/** @type {ActualFn} */ Assert.prototype.isFalsy
/** @type {ActualFn} */ Assert.prototype.isTruthy
/** @type {ActualFn} */ Assert.prototype.isFrozen
/** @type {ActualFn} */ Assert.prototype.isArray
/** @type {ActualFn} */ Assert.prototype.isBoolean
/** @type {ActualFn} */ Assert.prototype.isString
/** @type {ActualFn} */ Assert.prototype.isSymbol
/** @type {ActualFn} */ Assert.prototype.isFunction
/** @type {ActualFn} */ Assert.prototype.isSet
/** @type {ActualFn} */ Assert.prototype.isMap
/** @type {ActualFn} */ Assert.prototype.isDate
/** @type {ActualFn} */ Assert.prototype.isError
/** @type {ActualFn} */ Assert.prototype.isPromise
/** @type {ActualFn} */ Assert.prototype.isMapOrSet
/** @type {ActualFn} */ Assert.prototype.isIterator
/** @type {ActualFn} */ Assert.prototype.isEmptyArray
/** @type {ActualFn} */ Assert.prototype.isArrayBuffer
/** @type {ActualFn} */ Assert.prototype.isTypedArray
/** @type {ActualFn} */ Assert.prototype.isDataView
/** @type {ActualFn} */ Assert.prototype.isArrayBufferView
/** @type {ActualFn} */ Assert.prototype.isEmpty
/** @type {ActualFn} */ Assert.prototype.isElement

/** @type {ActualExpectedFn} */ Assert.prototype.isNotInstanceOf
/** @type {ActualExpectedFn} */ Assert.prototype.isNotDirectInstanceOf

/** @type {ActualFn} */ Assert.prototype.isNotObject
/** @type {ActualFn} */ Assert.prototype.isNotObjectOrArray
/** @type {ActualFn} */ Assert.prototype.isNotPlainObject
/** @type {ActualFn} */ Assert.prototype.isNotHashmap
/** @type {ActualFn} */ Assert.prototype.isNotHashmapLike
/** @type {ActualFn} */ Assert.prototype.isNotEmptyObject
/** @type {ActualFn} */ Assert.prototype.isNotProxy
/** @type {ActualFn} */ Assert.prototype.isNotLength
/** @type {ActualFn} */ Assert.prototype.isNotArrayLike
/** @type {ActualFn} */ Assert.prototype.isNotIterable
/** @type {ActualFn} */ Assert.prototype.isNotPromiseLike
/** @type {ActualFn} */ Assert.prototype.isNotTemplateObject
/** @type {ActualFn} */ Assert.prototype.isNotErrorLike
/** @type {ActualFn} */ Assert.prototype.isNotGeneratorFunction
/** @type {ActualFn} */ Assert.prototype.isNotAsyncFunction
/** @type {ActualFn} */ Assert.prototype.isNotMultipleOf
/** @type {ActualFn} */ Assert.prototype.isNotPositiveInteger
/** @type {ActualFn} */ Assert.prototype.isNotSafeInteger
/** @type {ActualFn} */ Assert.prototype.isNotInteger
/** @type {ActualFn} */ Assert.prototype.isNotFinite
/** @type {ActualFn} */ Assert.prototype.isNotNaN
/** @type {ActualFn} */ Assert.prototype.isNotNumber
/** @type {ActualFn} */ Assert.prototype.isNotFloat
/** @type {ActualFn} */ Assert.prototype.isNotNil
/** @type {ActualFn} */ Assert.prototype.isNotNull
/** @type {ActualFn} */ Assert.prototype.isNotUndefined
/** @type {ActualFn} */ Assert.prototype.isNotFalsy
/** @type {ActualFn} */ Assert.prototype.isNotTruthy
/** @type {ActualFn} */ Assert.prototype.isNotFrozen
/** @type {ActualFn} */ Assert.prototype.isNotArray
/** @type {ActualFn} */ Assert.prototype.isNotBoolean
/** @type {ActualFn} */ Assert.prototype.isNotString
/** @type {ActualFn} */ Assert.prototype.isNotSymbol
/** @type {ActualFn} */ Assert.prototype.isNotFunction
/** @type {ActualFn} */ Assert.prototype.isNotSet
/** @type {ActualFn} */ Assert.prototype.isNotMap
/** @type {ActualFn} */ Assert.prototype.isNotDate
/** @type {ActualFn} */ Assert.prototype.isNotError
/** @type {ActualFn} */ Assert.prototype.isNotPromise
/** @type {ActualFn} */ Assert.prototype.isNotMapOrSet
/** @type {ActualFn} */ Assert.prototype.isNotIterator
/** @type {ActualFn} */ Assert.prototype.isNotEmptyArray
/** @type {ActualFn} */ Assert.prototype.isNotArrayBuffer
/** @type {ActualFn} */ Assert.prototype.isNotTypedArray
/** @type {ActualFn} */ Assert.prototype.isNotDataView
/** @type {ActualFn} */ Assert.prototype.isNotArrayBufferView
/** @type {ActualFn} */ Assert.prototype.isNotEmpty
/** @type {ActualFn} */ Assert.prototype.isNotElement
