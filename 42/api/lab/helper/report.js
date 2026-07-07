/* eslint-disable complexity */

import { isHashmapLike } from "../../../lib/type/any/isHashmapLike.js"
import { pluralize } from "../../../lib/type/string/pluralize.js"
import { inFirefox } from "../../env/browser/inFirefox.js"
import { inBackend } from "../../env/runtime/inBackend.js"
import { minifyErrorStack } from "./minifyErrorStack.js"

const getStopwatch = (ms) => (ms > 3 ? `⏱️ ${Math.round(ms)}ms` : "")

const getColor = (ok) => (ok ? "color:springgreen" : "color:tomato")

const colorReset = "color:inherit"
const watchColor = "font-weight:normal; color:darkseagreen"

/**
 * @typedef {{ verbose?: number }} ReportOptions
 * @param {import("../Lab.js").Lab} lab
 * @param {ReportOptions} [options]
 */
export function report(lab, options) {
  const { tests, onlies, stats } = lab

  const VERBOSE = options?.verbose ?? 2

  console.log(inBackend ? "" : "\n\n")

  let currentFilename

  const errors = []

  for (const test of onlies.length > 0 ? onlies : tests) {
    const fileTitle = test.getFileTitle()

    if (VERBOSE < 4 && currentFilename !== test.meta.filename) {
      if (currentFilename !== undefined) console.groupEnd()
      currentFilename = test.meta.filename
      const { ok, ms } = lab.files[currentFilename]
      // console.log(ms)
      let groupTitle = `%c${ok ? "✓" : "✗"} %c${fileTitle}`
      groupTitle += ms > 2 ? ` %c${getStopwatch(ms)}` : "%c"
      console.groupCollapsed(
        groupTitle,
        getColor(ok),
        "color:inherit",
        watchColor,
      )
    }

    if ((test.meta.skip || test.ok) && VERBOSE < 3) continue

    const title = test.getTitle({ devtools: true, verbose: VERBOSE })

    const color = test.meta.skip ? "color:grey" : getColor(test.ok)
    const colorPrefix =
      VERBOSE > 3 ? colorReset : "font-weight:normal; " + color

    const groupTitle = test.meta.skip
      ? [`%c~ ${title}`, color, colorPrefix, color]
      : test.ok
        ? [`%c✓ ${title}`, color, colorPrefix, color]
        : [
            `%c✗ ${title} 💥 %c${test.error?.message}`,
            color,
            colorPrefix,
            color,
            "font-weight:normal; color:grey",
          ]

    const ms = getStopwatch(test.ms)
    if (ms) {
      groupTitle[0] += ` %c${ms}`
      groupTitle.push(watchColor)
    }

    console.groupCollapsed(...groupTitle)

    const str = String("└╴ " + test.getURL({ devtools: true }))

    if (test.error) {
      errors.push({ fileTitle, groupTitle, error: test.error })
    }

    console.log(str)
    console.groupEnd()
  }

  console.groupEnd()

  if (errors.length > 0) {
    const firstErrors = errors.splice(0, 3)

    console.log(inBackend ? "" : "\n\n")

    for (const { fileTitle, groupTitle, error } of firstErrors) {
      reportError(fileTitle, groupTitle, error)
    }

    if (errors.length > 0) {
      console.log("\n")
      console.groupCollapsed(
        `%c${errors.length} ${pluralize("error", errors.length)} not shown...`,
        "color:tomato",
      )
      for (const { fileTitle, groupTitle, error } of errors) {
        reportError(fileTitle, groupTitle, error)
      }

      console.groupEnd()
      console.log("\n")
    } else {
      console.log(inBackend ? "" : "\n\n")
    }
  }

  const percent =
    stats.passed > 0 && stats.ran > 0
      ? Math.floor((stats.passed / stats.ran) * 100)
      : 0

  const ok = percent === 100

  let warning = `%c${
    stats.onlies > 0
      ? `\n┈ only ${stats.onlies}/${tests.length} ${pluralize(
          "test",
          stats.onlies,
        )} ran ┈\n`
      : ""
  }`

  if (inFirefox) warning += "\n"

  const ms = getStopwatch(lab.ms)

  const sp = inBackend ? "" : " "

  console.log(
    ok
      ? `\n${sp}%c✓ ${percent}%  %c${ms}  🧪 %o\n${warning}`
      : `\n${sp}%c✗ ${percent}%  %c${ms}  🧪💥 %o\n${warning}`,
    ok
      ? "font-weight:bold; color:springgreen"
      : "font-weight:bold; color:tomato",
    watchColor,
    stats,
    "color:tomato",
  )
}

function reportError(fileTitle, groupTitle, error) {
  groupTitle[0] = groupTitle[0].replace("%c✗", `%c✗ ${fileTitle} -`)

  const { cause } = error
  delete error.cause

  if (inBackend) {
    console.log(groupTitle[0].replaceAll("%c", ""))
    console.log(error)
    if (isHashmapLike(cause)) {
      console.log(cause)
    }
    return
  }

  console.group(...groupTitle)

  let str = "%c%o"
  const params = []
  params.push("color:tomato")

  params.push(minifyErrorStack(error))

  str += "\n"

  if (cause) {
    if (isHashmapLike(cause)) {
      for (const key of Object.keys(cause)) {
        str += `${key.padEnd(9)} %o\n`
        const item = cause[key]
        params.push(
          inFirefox
            ? typeof item === "string"
              ? JSON.stringify(item)
              : item
            : item,
        )
      }
    } else {
      str += `cause: %o\n`
      params.push(cause)
    }
  }

  if (inFirefox) str += "\n"

  console.log(str, ...params)
  console.groupEnd()
}
