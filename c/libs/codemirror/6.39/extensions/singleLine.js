import { EditorState } from "../lib/state.js"

export function singleLine() {
  return EditorState.transactionFilter.of((tr) => {
    if (tr.changes.empty) return tr
    // if (tr.newDoc.lines > 1 && !tr.isUserEvent("input.paste")) {
    //   return []
    // }

    const removeNLs = []
    tr.changes.iterChanges((_fromA, _toA, fromB, _toB, ins) => {
      const lineIter = ins.iterLines().next()
      if (ins.lines <= 1) return
      // skip the first line
      let len = fromB + lineIter.value.length
      lineIter.next()
      // for the next lines, remove the leading NL
      for (; !lineIter.done; lineIter.next()) {
        removeNLs.push({ from: len, to: len + 1 })
        len += lineIter.value.length + 1
      }
    })

    return [tr, { changes: removeNLs, sequential: true }]
  })
}
