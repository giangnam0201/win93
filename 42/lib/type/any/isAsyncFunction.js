// @thanks https://github.com/tc39/ecmascript-asyncawait/issues/78#issuecomment-167162901

const AsyncFunction = async function () {}.constructor

/**
 * @param {any} val
 * @returns {val is AsyncFunction}
 */
export function isAsyncFunction(val) {
  return val instanceof AsyncFunction
}
