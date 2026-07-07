/* eslint-disable max-depth */
import { getBasename } from "../../../lib/syntax/path/getBasename.js"
import { getDirname } from "../../../lib/syntax/path/getDirname.js"

/** @import { FuzzyResult } from "../../../lib/algo/fuzzySearch.js" */

/**
 * @param {Partial<FuzzyResult>} res
 * @param {{ isPath: boolean; }} [options]
 */
export function fuzzyResultsToPlan(res, options) {
  const { text, matches } = res

  let a = text
  let b = ""

  let bLen = -1

  if (options?.isPath) {
    a = getBasename(text)
    b = getDirname(text)
    bLen = b.length
  }

  let content
  let bContent

  let lastEnd = -1

  if (matches?.length) {
    content = []
    bContent = []
    for (const match of matches) {
      for (const [start, end] of match) {
        if (start > bLen) {
          if (bLen > lastEnd) {
            bContent.push(b.slice(lastEnd + 1, bLen))
            lastEnd = bLen
          }

          const fstart = start - bLen - 1
          const fend = end - bLen

          if (start > lastEnd + 1) {
            content.push(
              a.slice(
                bLen === -1 //
                  ? lastEnd + 1
                  : lastEnd - bLen,
                fstart,
              ),
            )
          }

          content.push({
            tag: "strong.fuzzy-result__highlight",
            content: a.slice(fstart, fend),
          })
        } else {
          if (start > lastEnd + 1) {
            bContent.push(b.slice(lastEnd + 1, start))
          }

          bContent.push({
            tag: "strong.fuzzy-result__highlight",
            content: b.slice(start, end + 1),
          })
        }

        lastEnd = end
      }

      if (text.length > lastEnd + 1) {
        if (bLen > lastEnd + 1) {
          bContent.push(b.slice(lastEnd + 1, bLen))
        }

        if (content.length > 0) {
          content.push(a.slice(lastEnd - bLen, a.length))
        } else content.push(a)
      }
    }
  } else {
    content = a
    bContent = b
  }

  return options?.isPath
    ? [
        { tag: "span.fuzzy-result.fuzzy-result--basename", content },
        " ",
        {
          tag: "span.fuzzy-result.fuzzy-result--dirname.txt-dim.txt-i",
          title: text,
          content: bContent,
        },
      ]
    : [{ tag: "span.fuzzy-result", content }]
}
