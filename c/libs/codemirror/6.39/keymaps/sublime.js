import * as commands from "../lib/commands.js"
import { foldAll, unfoldAll } from "../lib/language.js"
import { selectNextOccurrence } from "../lib/search.js"
import { EditorSelection } from "../lib/state.js"

/**
 * @param {import("../lib/view.js").EditorView} view
 * @param {import("../lib/state.js").EditorSelection} selection
 * @returns {boolean}
 */
const dispatchSelection = (view, selection) => {
  view.dispatch({ selection, scrollIntoView: true, userEvent: "select" })
  return true
}

/**
 * @param {'up' | 'down'} direction
 */
const createAddCursor = (direction) => (view) => {
  const forward = direction === "down"
  let { selection } = view.state
  for (const range of selection.ranges) {
    selection = selection.addRange(view.moveVertically(range, forward))
  }
  return dispatchSelection(view, selection)
}

const addCursorUp = createAddCursor("up")
const addCursorDown = createAddCursor("down")

/**
 * @returns {boolean}
 */
const splitSelectionByLine = (view) => {
  const ranges = []
  for (const range of view.state.selection.ranges) {
    const fromLine = view.state.doc.lineAt(range.from)
    const toLine = view.state.doc.lineAt(range.to)
    for (let lineNo = fromLine.number; lineNo <= toLine.number; lineNo++) {
      const line = view.state.doc.line(lineNo)
      if (
        toLine.number > fromLine.number &&
        lineNo === toLine.number &&
        range.to === line.from
      ) {
        continue
      }
      ranges.push(
        EditorSelection.range(
          lineNo === fromLine.number ? range.from : line.from,
          lineNo === toLine.number ? range.to : line.to,
        ),
      )
    }
  }
  if (ranges.length === 0) return false
  const selection = EditorSelection.create(ranges, 0)
  return selection.eq(view.state.selection, true)
    ? false
    : dispatchSelection(view, selection)
}

/**
 * @returns {boolean}
 */
const singleSelectionTop = (view) => {
  if (view.state.selection.ranges.length < 2) return false
  return dispatchSelection(
    view,
    EditorSelection.create([view.state.selection.ranges[0]], 0),
  )
}

/**
 * @param {'up' | 'down'} direction
 */
const scrollLine = (direction) => (view) => {
  const amount = view.defaultLineHeight
  const { main } = view.state.selection
  if (main.empty) {
    const cursorLine = view.lineBlockAt(main.head)
    const top = view.scrollDOM.scrollTop
    const bottom = top + view.scrollDOM.clientHeight
    if (direction === "up" && cursorLine.bottom >= bottom - amount) {
      commands.cursorLineUp(view)
    } else if (direction === "down" && cursorLine.top <= top + amount) {
      commands.cursorLineDown(view)
    }
  }
  view.scrollDOM.scrollTop += direction === "up" ? -amount : amount
  return true
}

const scrollLineUp = scrollLine("up")
const scrollLineDown = scrollLine("down")

/**
 * @param {boolean} above
 */
const insertLine = (above) => (view) => {
  if (view.state.readOnly) return false
  const { lineBreak } = view.state
  const lineNumbers = []
  const seen = new Set()
  for (const range of view.state.selection.ranges) {
    const lineNumber = view.state.doc.lineAt(range.head).number
    if (!seen.has(lineNumber)) {
      seen.add(lineNumber)
      lineNumbers.push(lineNumber)
    }
  }
  lineNumbers.sort((a, b) => a - b)

  let offset = 0
  const changes = []
  const ranges = []
  for (const lineNumber of lineNumbers) {
    const line = view.state.doc.line(lineNumber)
    const indent = /^\s*/.exec(line.text)[0]
    const from = above ? line.from : line.to
    const insert = above ? indent + lineBreak : lineBreak + indent
    const cursor =
      from + offset + (above ? indent.length : lineBreak.length + indent.length)
    changes.push({ from, insert })
    ranges.push(EditorSelection.cursor(cursor))
    offset += insert.length
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(ranges, 0),
    scrollIntoView: true,
    userEvent: "input",
  })
  return true
}

const insertLineBefore = insertLine(true)

/**
 * @returns {boolean}
 */
const skipAndSelectNextOccurrence = (view) => {
  const previous = view.state.selection.main
  if (!selectNextOccurrence(view)) return false
  const ranges = view.state.selection.ranges.filter(
    (range) => range.from !== previous.from || range.to !== previous.to,
  )
  if (ranges.length === 0) return false
  return dispatchSelection(
    view,
    EditorSelection.create(ranges, ranges.length - 1),
  )
}

/**
 * @param {(value: string) => string} mod
 */
const modifyWordOrSelection = (mod) => (view) => {
  if (view.state.readOnly) return false
  const changes = []
  const ranges = []
  for (const range of view.state.selection.ranges) {
    if (range.empty) {
      const word = view.state.wordAt(range.head)
      if (!word) {
        ranges.push(range)
        continue
      }
      changes.push({
        from: word.from,
        to: word.to,
        insert: mod(view.state.sliceDoc(word.from, word.to)),
      })
      ranges.push(EditorSelection.range(word.from, word.to))
    } else {
      changes.push({
        from: range.from,
        to: range.to,
        insert: mod(view.state.sliceDoc(range.from, range.to)),
      })
      ranges.push(
        EditorSelection.range(
          range.from,
          range.from + mod(view.state.sliceDoc(range.from, range.to)).length,
        ),
      )
    }
  }
  if (changes.length === 0) return false
  view.dispatch({
    changes,
    selection: EditorSelection.create(ranges, view.state.selection.mainIndex),
    scrollIntoView: true,
    userEvent: "input",
  })
  return true
}

const upcaseAtCursor = modifyWordOrSelection((value) => value.toUpperCase())
const downcaseAtCursor = modifyWordOrSelection((value) => value.toLowerCase())

/**
 * @returns {boolean}
 */
const duplicateLine = (view) => {
  if (view.state.readOnly) return false

  const spec = view.state.changeByRange((range) => {
    if (range.empty) {
      const line = view.state.doc.lineAt(range.head)
      const column = range.head - line.from
      return {
        changes: {
          from: line.to,
          insert: view.state.lineBreak + line.text,
        },
        range: EditorSelection.cursor(
          line.to + view.state.lineBreak.length + column,
        ),
      }
    }

    const insert = view.state.sliceDoc(range.from, range.to)
    return {
      changes: { from: range.to, insert },
      range: EditorSelection.range(range.to, range.to + insert.length),
    }
  })

  view.dispatch({ ...spec, scrollIntoView: true, userEvent: "input" })
  return true
}

/**
 * @returns {boolean}
 */
const joinLines = (view) => {
  if (view.state.readOnly) return false
  const { lineBreak } = view.state
  const changes = []
  const touched = new Set()
  for (const range of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(range.from).number
    const endBase = range.empty
      ? Math.min(startLine + 1, view.state.doc.lines)
      : view.state.doc.lineAt(range.to).number
    for (let lineNumber = startLine; lineNumber < endBase; lineNumber++) {
      if (touched.has(lineNumber)) continue
      touched.add(lineNumber)
      const line = view.state.doc.line(lineNumber)
      const next = view.state.doc.line(lineNumber + 1)
      const from = line.to
      const to = next.from + /^\s*/.exec(next.text)[0].length
      if (view.state.sliceDoc(from, to) === lineBreak) {
        changes.push({ from, to, insert: " " })
      } else changes.push({ from, to, insert: " " })
    }
  }
  if (changes.length === 0) return false
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" })
  return true
}

/**
 * @param {import("../lib/state.js").EditorState} state
 */
const selectedLineBlocks = (state) => {
  const blocks = []
  for (const range of state.selection.ranges) {
    if (range.empty) continue
    const fromLine = state.doc.lineAt(range.from).number
    let toLine = state.doc.lineAt(range.to).number
    if (range.to === state.doc.line(toLine).from) toLine--
    if (toLine < fromLine) continue
    const previous = blocks[blocks.length - 1]
    if (previous && fromLine <= previous.to + 1) {
      previous.to = Math.max(previous.to, toLine)
    } else blocks.push({ from: fromLine, to: toLine })
  }
  return blocks
}

/**
 * @param {boolean} caseSensitive
 * @param {1 | -1} direction
 */
const sortLines = (caseSensitive, direction) => (view) => {
  if (view.state.readOnly) return false
  const blocks = selectedLineBlocks(view.state)
  const targets =
    blocks.length > 0 ? blocks : [{ from: 1, to: view.state.doc.lines }]
  const changes = []
  const ranges = []
  let offset = 0

  for (const block of targets) {
    const fromLine = view.state.doc.line(block.from)
    const toLine = view.state.doc.line(block.to)
    const lines = []
    for (let lineNumber = block.from; lineNumber <= block.to; lineNumber++) {
      lines.push(view.state.doc.line(lineNumber).text)
    }
    lines.sort((left, right) => {
      const a = caseSensitive ? left : left.toUpperCase()
      const b = caseSensitive ? right : right.toUpperCase()
      if (a < b) return -direction
      if (a > b) return direction
      return 0
    })
    const insert = lines.join(view.state.lineBreak)
    const start = fromLine.from + offset
    changes.push({ from: fromLine.from, to: toLine.to, insert })
    if (blocks.length > 0) {
      ranges.push(EditorSelection.range(start, start + insert.length))
    }
    offset += insert.length - (toLine.to - fromLine.from)
  }

  view.dispatch({
    changes,
    selection:
      ranges.length > 0
        ? EditorSelection.create(ranges, 0)
        : view.state.selection,
    scrollIntoView: true,
    userEvent: "input",
  })
  return true
}

const sortLinesCaseSensitive = sortLines(true, 1)
const reverseSortLinesCaseSensitive = sortLines(true, -1)
const sortLinesInsensitive = sortLines(false, 1)
const reverseSortLinesInsensitive = sortLines(false, -1)

const sublimeKeymap = [
  ...commands.defaultKeymap,
  {
    key: "Ctrl-t",
    run: commands.transposeChars,
    preventDefault: true,
  },
  {
    key: "Alt-ArrowLeft",
    mac: "Ctrl-ArrowLeft",
    run: commands.cursorSubwordBackward,
    shift: commands.selectSubwordBackward,
    preventDefault: true,
  },
  {
    key: "Alt-ArrowRight",
    mac: "Ctrl-ArrowRight",
    run: commands.cursorSubwordForward,
    shift: commands.selectSubwordForward,
    preventDefault: true,
  },
  {
    key: "Ctrl-ArrowUp",
    mac: "Ctrl-Alt-ArrowUp",
    run: scrollLineUp,
    preventDefault: true,
  },
  {
    key: "Ctrl-ArrowDown",
    mac: "Ctrl-Alt-ArrowDown",
    run: scrollLineDown,
    preventDefault: true,
  },
  {
    key: "Ctrl-l",
    mac: "Cmd-l",
    run: commands.selectLine,
    preventDefault: true,
  },
  {
    key: "Ctrl-Shift-l",
    mac: "Shift-Cmd-l",
    run: splitSelectionByLine,
    preventDefault: true,
  },
  // {
  //   key: "Escape",
  //   run: singleSelectionTop,
  //   preventDefault: true,
  // },
  {
    key: "Ctrl-Enter",
    mac: "Cmd-Enter",
    run: commands.insertBlankLine,
    preventDefault: true,
  },
  {
    key: "Shift-Ctrl-Enter",
    mac: "Shift-Cmd-Enter",
    run: insertLineBefore,
    preventDefault: true,
  },
  {
    key: "Ctrl-d",
    mac: "Cmd-d",
    run: selectNextOccurrence,
    preventDefault: true,
  },
  {
    key: "Shift-Ctrl-Space",
    mac: "Shift-Cmd-Space",
    run: commands.selectParentSyntax,
    preventDefault: true,
  },
  {
    key: "Shift-Ctrl-m",
    mac: "Shift-Cmd-m",
    run: commands.selectMatchingBracket,
    preventDefault: true,
  },
  {
    key: "Ctrl-m",
    mac: "Cmd-m",
    run: commands.cursorMatchingBracket,
    preventDefault: true,
  },
  {
    key: "Shift-Ctrl-ArrowUp",
    mac: "Cmd-Ctrl-ArrowUp",
    run: commands.moveLineUp,
    preventDefault: true,
  },
  {
    key: "Shift-Ctrl-ArrowDown",
    mac: "Cmd-Ctrl-ArrowDown",
    run: commands.moveLineDown,
    preventDefault: true,
  },
  {
    key: "Ctrl-j",
    mac: "Cmd-j",
    run: joinLines,
    preventDefault: true,
  },
  {
    key: "Shift-Ctrl-d",
    mac: "Shift-Cmd-d",
    run: duplicateLine,
    preventDefault: true,
  },
  {
    key: "F9",
    mac: "F5",
    run: sortLinesCaseSensitive,
    preventDefault: true,
  },
  {
    key: "Shift-F9",
    mac: "Shift-F5",
    run: reverseSortLinesCaseSensitive,
    preventDefault: true,
  },
  {
    key: "Ctrl-F9",
    mac: "Cmd-F5",
    run: sortLinesInsensitive,
    preventDefault: true,
  },
  {
    key: "Shift-Ctrl-F9",
    mac: "Shift-Cmd-F5",
    run: reverseSortLinesInsensitive,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-d",
    mac: "Cmd-k Cmd-d",
    run: skipAndSelectNextOccurrence,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-k",
    mac: "Cmd-k Cmd-k",
    run: commands.deleteToLineEnd,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-u",
    mac: "Cmd-k Cmd-u",
    run: upcaseAtCursor,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-l",
    mac: "Cmd-k Cmd-l",
    run: downcaseAtCursor,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-Backspace",
    mac: "Cmd-k Cmd-Backspace",
    run: commands.deleteToLineStart,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-1",
    mac: "Cmd-k Cmd-1",
    run: foldAll,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-0",
    mac: "Cmd-k Cmd-0",
    run: unfoldAll,
    preventDefault: true,
  },
  {
    key: "Ctrl-k Ctrl-j",
    mac: "Cmd-k Cmd-j",
    run: unfoldAll,
    preventDefault: true,
  },
  {
    key: "Ctrl-Alt-ArrowUp",
    mac: "Ctrl-Shift-ArrowUp",
    run: addCursorUp,
    preventDefault: true,
  },
  {
    key: "Ctrl-Alt-ArrowDown",
    mac: "Ctrl-Shift-ArrowDown",
    run: addCursorDown,
    preventDefault: true,
  },
]

export { sublimeKeymap }
