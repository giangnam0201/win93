/**
 * @typedef {{
 *  (rule: CSSRule, index: number, sheet: CSSStyleSheet): void | false
 * }} WalkStyleSheetCallback
 */

/**
 * @typedef {{ document?: Document, deep?: false }} WalkOptions
 */

/**
 * @param {CSSStyleSheet} sheet
 * @param {WalkStyleSheetCallback} cb
 * @param {{ deep?: false }} [options]
 */
export function walkStyleSheet(sheet, cb, options) {
  let rules

  try {
    rules = sheet.cssRules
  } catch {
    return
  }

  if (rules) {
    for (let i = 0, l = rules.length; i < l; i++) {
      const rule = rules[i]
      const res = cb(rule, i, sheet)
      if (res === false) return false
      if (options?.deep !== false && "styleSheet" in rule) {
        // @ts-ignore
        if (walkStyleSheet(rule.styleSheet, cb) === false) return false
      }
    }
  }
}

/**
 * @param {WalkStyleSheetCallback} cb
 * @param {WalkOptions} [options]
 */
export function walkStyleSheets(cb, options) {
  const doc = options?.document ?? document
  for (const sheet of doc.styleSheets) {
    if (walkStyleSheet(sheet, cb, options) === false) return
  }
}

/**
 * @param {WalkStyleSheetCallback} cb
 * @param {WalkOptions} [options]
 */
export function walkAdoptedStyleSheets(cb, options) {
  const doc = options?.document ?? document
  for (const sheet of doc.adoptedStyleSheets) {
    if (walkStyleSheet(sheet, cb, options) === false) return
  }
}

/**
 * @param {WalkStyleSheetCallback} cb
 * @param {WalkOptions} [options]
 */
export function walkAllStyleSheets(cb, options) {
  const doc = options?.document ?? document
  for (const sheet of doc.styleSheets) {
    if (walkStyleSheet(sheet, cb, options) === false) return
  }

  for (const sheet of doc.adoptedStyleSheets) {
    if (walkStyleSheet(sheet, cb, options) === false) return
  }
}
