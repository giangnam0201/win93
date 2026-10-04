import { noop } from "../../../lib/type/function/noop.js"

/**
 * @typedef {import("../Lab.js").onEachFn} onEachFn
 * @typedef {import("../Test.js").Test} Test
 * @typedef {import("../Lab.js").Lab} Lab
 */

function addStats(lab, test) {
  lab.stats.ran++
  test.file.stats.ran++
  test.file.ms += test.ms
  if (test.ok) {
    test.file.ok ??= true
    test.file.stats.passed++
    lab.stats.passed++
  } else {
    test.file.ok = false
    test.file.stats.failed++
    lab.stats.failed++
  }
}

/**
 * @param {Lab} lab
 * @param {Test[]} tests
 * @param {onEachFn} [onEach]
 */
export async function run(lab, tests, onEach = noop) {
  const serial = []
  const parallel = []

  for (const test of tests) {
    if (test.meta.skip) {
      test.file.stats.skipped++
      lab.stats.skipped++
      continue
    }

    if (test.meta.only) {
      if (lab.stats.onlies === 0) {
        serial.length = 0
        parallel.length = 0
      }

      if (test.meta.serial) serial.push(test)
      else parallel.push(test)

      lab.onlies.push(test)
      test.file.stats.onlies++
      lab.stats.onlies++
    }

    if (lab.stats.onlies) continue

    if (test.meta.serial) serial.push(test)
    else parallel.push(test)
  }

  for (const test of serial) {
    await test.run()
    onEach(test)
    addStats(lab, test)
  }

  const parallelCtx = { cumulated: 0 }

  const undones = []
  for (const test of parallel) {
    undones.push(
      test.run(parallelCtx).then(() => {
        onEach(test)
        addStats(lab, test)
      }),
    )
  }

  if (undones.length > 0) await Promise.all(undones)
}
