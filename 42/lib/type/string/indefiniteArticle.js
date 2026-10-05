const VOWELS = new Set(["a", "e", "i", "o", "u", "A", "E", "I", "O", "U"])

/**
 * Prefix a string with an indefinite article (a or an) based on whether it begins with a vowel.
 *
 * @param {string} text
 * @param {string} [displayedText]
 * @returns {string}
 */
export function indefiniteArticle(text, displayedText = text) {
  const article = VOWELS.has(text.charAt(0)) ? "an" : "a"
  return `${article} ${displayedText}`
}
