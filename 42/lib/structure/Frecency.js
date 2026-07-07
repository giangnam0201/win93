/**
 * @typedef {{
 *   decayRate?: number,
 *   halfLifeInDays?: number,
 *   history?: FrecencyHistory,
 *   accessor?: FrecencyAccessor,
 *   normalizeQuery?: (query: string) => string,
 * }} FrecencyOptions
 *
 * @typedef {Record<string, Record<string, FrecencyEntry>>} FrecencyHistory
 *
 * @typedef {(item) => string | number} FrecencyAccessor
 */

/**
 * @typedef {object} FrecencyEntry
 * @property {number} count - The number of times this result has been selected.
 * @property {number} lastAccessed - The timestamp (in milliseconds) of the last selection.
 */

/**
 * @typedef {object} ResultScore
 * @property {string | number} resultId - The unique identifier of the result.
 * @property {number} score - The calculated frecency score.
 */

const DAY_IN_MS = 1000 * 60 * 60 * 24

export class Frecency {
  /**
   * The rate at which the score's recency decays.
   * A higher value means faster decay (recency is more important).
   * @type {number}
   */
  decayRate

  /**
   * @type {FrecencyHistory}
   */
  history

  /**
   * A class to manage and score search results based on the Frecency algorithm.
   * It tracks user selections for different queries and calculates a score.
   * Based on how frequently (frequency) and how recently (recency) a result was chosen.
   *
   * @param {FrecencyOptions} [options] - Configuration options for the scorer.
   */
  constructor(options) {
    this.decayRate =
      options?.decayRate ?? Math.log(2) / (options?.halfLifeInDays ?? 30)
    this.history = options?.history ?? {}
    this.accessor = options?.accessor ?? ((item) => item)
    this.normalizeQuery =
      options?.normalizeQuery ?? ((query) => query.toLowerCase().trim())
  }

  /**
   * Records that a user has selected a specific result for a given query.
   * This updates the frequency count and recency timestamp for the result.
   *
   * @param {string} query - The search query term.
   * @param {string | number} resultId - The unique identifier for the selected search result.
   */
  recordSelection(query, resultId) {
    query = this.normalizeQuery(query)

    this.history[query] ??= {}

    const results = this.history[query]
    const entry = results[resultId]

    if (entry) {
      entry.count++
      entry.lastAccessed = Date.now()
    } else {
      results[resultId] = {
        count: 1,
        lastAccessed: Date.now(),
      }
    }
  }

  /**
   * Calculates the frecency score for a single entry (Score = Frequency * Recency).
   * This formula combines frequency (count) and recency (the exponential decay part).
   *
   * @param {FrecencyEntry} entry - The frecency data for a result.
   * @param {number} [now] - The current timestamp, passed in for consistency.
   */
  calculateScore(entry, now = Date.now()) {
    const ageInDays = (now - entry.lastAccessed) / DAY_IN_MS
    return entry.count * Math.exp(-this.decayRate * ageInDays)
  }

  /**
   * Retrieves the calculated scores for all tracked results for a given query.
   *
   * @param {string} query - The search query term.
   * @returns {Record<string, number>} An array of objects, each containing a resultId and its score.
   */
  getScores(query) {
    const resultsForQuery = this.history[this.normalizeQuery(query)]

    /** @type {Record<string, number>} */
    const scores = {}

    if (!resultsForQuery) return scores

    const now = Date.now()

    for (const [resultId, entry] of Object.entries(resultsForQuery)) {
      scores[resultId] = this.calculateScore(entry, now)
    }

    return scores
  }

  /**
   * Takes a list of new search results and sorts them based on their historical frecency score.
   * Results with a higher score (more frequent/recent selections) will appear first.
   * Results not in the history are given a score of 0 and will appear after scored results.
   *
   * @template T
   * @param {string} query - The search query term.
   * @param {Array<T>} results - The new list of search results to be sorted.
   * @param {FrecencyAccessor} [accessor] - A function that returns a unique ID from a result item.
   * @returns {Array<T>} A new array containing the sorted results.
   */
  sortResults(query, results, accessor = this.accessor) {
    const scores = this.getScores(query)

    results.sort((a, b) => {
      const scoreA = scores[accessor(a)] ?? 0
      const scoreB = scores[accessor(b)] ?? 0

      // Sort in descending order (highest score first)
      return scoreB - scoreA
    })

    return results
  }

  getSortedResults(query, results, accessor = this.accessor) {
    return this.sortResults(query, [...results], accessor)
  }
}
