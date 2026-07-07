// @read https://gist.github.com/Rich-Harris/50ff201552a8ca8bc1492dd570ecac07

/**
 * Remove an item from an ordered array.
 *
 * @template {Array} T
 * @param {T} arr
 * @param {any} item
 * @returns {T}
 */
export function removeItem(arr, item) {
  const idx = arr.indexOf(item)
  if (idx === -1) return arr
  arr.splice(idx, 1)
  return arr
}

/**
 * Remove an item from an array. Faster if the order doesn't matter.
 *
 * @template {Array} T
 * @param {T} arr
 * @param {any} item
 * @returns {T}
 */
export function removeItemFast(arr, item) {
  const idx = arr.indexOf(item)
  if (idx === -1) return arr
  arr[idx] = arr[arr.length - 1]
  arr.pop()
  return arr
}

removeItem.fast = removeItemFast
