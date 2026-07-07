/* eslint-disable max-params */

// Copyright (c) Nozbe. MIT License.
// @src https://github.com/Nozbe/microfuzz

import { deburr } from "../type/string/deburr.js"

/**
 * Normalizes text so that it's suitable to comparisons, sorting, search, etc. By:
 * - turning into lowercase
 * - removing diacritics
 * - removing extra whitespace.
 */
function normalizeText(string) {
  return deburr(string).toLowerCase().trim()
}

const { MAX_SAFE_INTEGER } = Number
export const sortByScore = function sortByScore(a, b) {
  return a.score - b.score
}

const sortRangeTuple = function sortRangeTuple(a, b) {
  return a[0] - b[0]
}

const validWordBoundaries = new Set("  /[]()-–—'\"“”".split(""))
function isValidWordBoundary(character /* : string */) /* : boolean */ {
  return validWordBoundaries.has(character)
}

function matchesFuzzily(
  item,
  normalizedItem,
  itemWords,
  query,
  normalizedQuery,
  queryWords,
  strategy,
) {
  // quick matches
  if (item === query) {
    return [0, [[0, item.length - 1]]]
  }

  const queryLen = query.length
  const normalizedItemLen = normalizedItem.length
  const normalizedQueryLen = normalizedQuery.length
  if (normalizedItem === normalizedQuery) {
    return [0.1, [[0, normalizedItemLen - 1]]]
  }

  if (normalizedItem.startsWith(normalizedQuery)) {
    return [0.5, [[0, normalizedQueryLen - 1]]]
  }

  // contains query (starting at word boundary)
  // NOTE: It would be more correct to do a regex search, than to check previous character, since
  // it could be that the item found does _not_ start at a word boundary, but there is another match
  // that does. However, this is faster and should rarely be a problem, while fuzzy search will still
  // find other matches (just ranked lower)
  const exactContainsIdx = item.indexOf(query)
  if (
    exactContainsIdx > -1 &&
    isValidWordBoundary(item[exactContainsIdx - 1])
  ) {
    return [0.9, [[exactContainsIdx, exactContainsIdx + queryLen - 1]]]
  }

  const containsIdx = normalizedItem.indexOf(normalizedQuery)
  if (
    containsIdx > -1 &&
    isValidWordBoundary(normalizedItem[containsIdx - 1])
  ) {
    return [1, [[containsIdx, containsIdx + queryLen - 1]]]
  }

  // Match by words included
  // Score: 1.5 + 0.2*words (so that it's better than two non-word chunks)
  const queryWordCount = queryWords.length
  if (queryWordCount > 1) {
    if (queryWords.every((word) => itemWords.has(word))) {
      const score = 1.5 + queryWordCount * 0.2
      return [
        score,
        queryWords
          .map((word) => {
            const wordIndex = normalizedItem.indexOf(word)
            return [wordIndex, wordIndex + word.length - 1] /* : Range */
          })
          .sort(sortRangeTuple),
      ]
    }
  }

  // Contains query (at any position)
  if (containsIdx > -1) {
    return [2, [[containsIdx, containsIdx + queryLen - 1]]]
  }

  // Match by consecutive letters (fuzzy)
  if (strategy === "aggressive") {
    return aggressiveFuzzyMatch(normalizedItem, normalizedQuery)
  }

  if (strategy === "smart") {
    return experimentalSmartFuzzyMatch(normalizedItem, normalizedQuery)
  }

  return null
}

function aggressiveFuzzyMatch(normalizedItem, normalizedQuery) {
  const normalizedItemLen = normalizedItem.length
  const normalizedQueryLen = normalizedQuery.length
  let queryIdx = 0
  let queryChar = normalizedQuery[queryIdx]
  const indices = []
  let chunkFirstIdx = -1
  let chunkLastIdx = -2
  // TODO: May improve performance by early exits (less to go than remaining query)
  // and by using .indexOf(x, fromIndex)
  for (let itemIdx = 0; itemIdx < normalizedItemLen; itemIdx += 1) {
    // DEBUG:
    // console.log(`${itemIdx} (${normalizedItem[itemIdx]}), ${queryIdx} (${queryChar}), ${chunkLastIdx}, score: ${consecutiveChunks}`)
    if (normalizedItem[itemIdx] === queryChar) {
      if (itemIdx !== chunkLastIdx + 1) {
        if (chunkFirstIdx >= 0) {
          indices.push([chunkFirstIdx, chunkLastIdx])
        }

        chunkFirstIdx = itemIdx
      }

      chunkLastIdx = itemIdx
      queryIdx += 1
      if (queryIdx === normalizedQueryLen) {
        indices.push([chunkFirstIdx, chunkLastIdx])
        return scoreConsecutiveLetters(indices, normalizedItem)
      }

      queryChar = normalizedQuery[queryIdx]
    }
  }

  return null
}

function experimentalSmartFuzzyMatch(normalizedItem, normalizedQuery) {
  const normalizedItemLen = normalizedItem.length

  // Match by consecutive letters, but only match beginnings of words or chunks of 3+ letters
  // Note that there may be multiple valid ways in which such matching can be done, and we'll only
  // match each chunk to the first one found that matches these criteria. It's not perfect as it's
  // possible that later chunks will fail to match while there's a better match, for example:
  // - query: ABC
  // - item: A xABC
  //         ^___xx (no match)
  //         ___^^^ (better match)
  // But we want to limit the algorithmic complexity and this should generally work.

  const indices = []
  let queryIdx = 0
  let queryChar = normalizedQuery[queryIdx]
  let chunkFirstIdx = -1
  let chunkLastIdx = -2

  while (true) {
    // Find match for first letter of chunk
    const idx = normalizedItem.indexOf(queryChar, chunkLastIdx + 1)
    if (idx === -1) {
      break
    }

    // Check if chunk starts at word boundary
    if (idx === 0 || isValidWordBoundary(normalizedItem[idx - 1])) {
      chunkFirstIdx = idx
    } else {
      // Else, check if chunk is at least 3+ letters
      const queryCharsLeft = normalizedQuery.length - queryIdx
      const itemCharsLeft = normalizedItem.length - idx
      const minimumChunkLen = Math.min(3, queryCharsLeft, itemCharsLeft)
      const minimumQueryChunk = normalizedQuery.slice(
        queryIdx,
        queryIdx + minimumChunkLen,
      )
      if (
        normalizedItem.slice(idx, idx + minimumChunkLen) === minimumQueryChunk
      ) {
        chunkFirstIdx = idx
      } else {
        // Move index to continue search for valid chunk
        chunkLastIdx += 1
        continue
      }
    }

    // We have first index of a valid chunk, find its last index
    // TODO: We could micro-optimize by setting chunkLastIdx earlier if we already know it's len 3 or more
    for (
      chunkLastIdx = chunkFirstIdx;
      chunkLastIdx < normalizedItemLen;
      chunkLastIdx += 1
    ) {
      if (normalizedItem[chunkLastIdx] !== queryChar) {
        break
      }

      queryIdx += 1
      queryChar = normalizedQuery[queryIdx]
    }

    // Add chunk to indices
    chunkLastIdx -= 1 // decrement as we've broken out of loop on non-matching char
    indices.push([chunkFirstIdx, chunkLastIdx])

    // Check if we're done
    if (queryIdx === normalizedQuery.length) {
      return scoreConsecutiveLetters(indices, normalizedItem)
    }
  }

  return null
}

function scoreConsecutiveLetters(indices, normalizedItem) {
  // Score: 2 + sum of chunk scores
  // Chunk scores:
  // - 0.2 for a full word
  // - 0.4 for chunk starting at beginning of word
  // - 0.8 for chunk in the middle of the word (if >=3 characters)
  // - 1.6 for chunk in the middle of the word (if 1 or 2 characters)
  let score = 2
  indices.forEach((_ref) => {
    const firstIdx = _ref[0]
    const lastIdx = _ref[1]
    const chunkLength = lastIdx - firstIdx + 1
    const isStartOfWord =
      firstIdx === 0 ||
      normalizedItem[firstIdx] === " " ||
      normalizedItem[firstIdx - 1] === " "
    const isEndOfWord =
      lastIdx === normalizedItem.length - 1 ||
      normalizedItem[lastIdx] === " " ||
      normalizedItem[lastIdx + 1] === " "
    const isFullWord = isStartOfWord && isEndOfWord

    // DEBUG:
    // console.log({
    //   firstIdx,
    //   lastIdx,
    //   chunkLength,
    //   isStartOfWord,
    //   isEndOfWord,
    //   isFullWord,
    //   before: normalizedItem[firstIdx - 1],
    //   after: normalizedItem[lastIdx + 1],
    // })
    if (isFullWord) {
      score += 0.2
    } else if (isStartOfWord) {
      score += 0.4
    } else if (chunkLength >= 3) {
      score += 0.8
    } else {
      score += 1.6
    }
  })
  return [score, indices]
}

/**
 * @param {string} text
 * @param {string} query
 * @returns {FuzzyResult | undefined}
 */
export function fuzzyMatch(text, query) {
  const normalizedQuery = normalizeText(query)
  const queryWords = normalizedQuery.split(" ")
  const normalizedText = normalizeText(text)
  const itemWords = new Set(normalizedText.split(" "))

  const result = matchesFuzzily(
    text,
    normalizedText,
    itemWords,
    query,
    normalizedQuery,
    queryWords,
    "smart",
  )

  if (result) {
    return {
      text,
      score: result[0],
      matches: [result[1]],
    }
  }
}

/**
 * @typedef {{
 *   text: string;
 *   score: number;
 *   matches: [number, number][][];
 *   item?: any;
 *   index?: number;
 * }} FuzzyResult
 * @typedef {FuzzyResult[]} FuzzyResults
 */

/**
 * @param {any[]} collection
 * @param {{
 *   key?: string;
 *   sort?: boolean;
 *   strategy?: "smart" | "aggressive";
 *   getText?: (element: any) => string[];
 * }} [options]
 * @returns {(text: string) => FuzzyResults}
 */
export function createFuzzySearch(collection, options = {}) {
  const strategy = options.strategy ?? "smart" // "aggressive"

  const { getText } = options

  const preprocessedCollection = []

  for (let i = 0, l = collection.length; i < l; i++) {
    const element = collection[i]
    let texts

    if (getText) {
      texts = getText(element)
    } else {
      texts = options.key ? element[options.key] : element
    }

    if (!texts) continue

    const normalizedItem = normalizeText(texts)
    const itemWords = new Set(normalizedItem.split(" "))
    const preprocessedTexts = [[texts, normalizedItem, itemWords]]

    preprocessedCollection.push([element, preprocessedTexts, i])
  }

  return (text) => {
    const results = []
    const normalizedQuery = normalizeText(text)
    const queryWords = normalizedQuery.split(" ")

    if (normalizedQuery.length === 0) return []

    preprocessedCollection.forEach((_ref2) => {
      const item = _ref2[0]
      const texts = _ref2[1]
      const index = _ref2[2]
      let bestScore = MAX_SAFE_INTEGER
      const matches = []
      for (let i = 0, len = texts.length; i < len; i += 1) {
        const _texts$i = texts[i]
        const item2 = _texts$i[0]
        const normalizedItem = _texts$i[1]
        const itemWords = _texts$i[2]
        const result = matchesFuzzily(
          item2,
          normalizedItem,
          itemWords,
          text,
          normalizedQuery,
          queryWords,
          strategy,
        )
        if (result) {
          bestScore = Math.min(bestScore, result[0]) // take the lowest score of any match
          matches.push(result[1])
        } else {
          matches.push(null)
        }
      }

      if (bestScore < MAX_SAFE_INTEGER) {
        results.push({
          score: bestScore,
          text: item,
          item,
          index,
          matches,
        })
      }
    })

    if (options.sort !== false) results.sort(sortByScore)

    return results
  }
}

/**
 * @param {string} text
 * @param {any[]} collection
 */
export function fuzzySearch(text, collection) {
  return createFuzzySearch(collection)(text)
}
