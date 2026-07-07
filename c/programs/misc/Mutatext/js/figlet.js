/*
    FIGlet.js (a FIGDriver for FIGlet fonts)
    Written by https://github.com/patorjk/figlet.js/graphs/contributors
    Originally Written For: http://patorjk.com/software/taag/
    License: MIT (with this header staying intact)

    This JavaScript code aims to fully implement the FIGlet spec.
    Full FIGlet spec: http://patorjk.com/software/taag/docs/figfont.txt

    FIGlet fonts are actually kind of complex, which is why you will see
    a lot of code about parsing and interpreting rules. The actual generation
    code is pretty simple and is done near the bottom of the code.
*/

// ---------------------------------------------------------------------
// Private static variables

const FULL_WIDTH = 0
const FITTING = 1
const SMUSHING = 2
const CONTROLLED_SMUSHING = 3

// // ---------------------------------------------------------------------
// // Variable that will hold information about the fonts

// const figFonts = {} // What stores all of the FIGlet font data
// const figDefaults = {
//   font: "Standard",
//   fontPath: "./fonts",
// }

// ---------------------------------------------------------------------
// Private static methods

/*
    This method takes in the oldLayout and newLayout data from the FIGfont header file and returns
    the layout information.
*/
function getSmushingRules(oldLayout, newLayout) {
  const rules = {}
  let val
  let index
  let len
  let code
  const codes = [
    [16_384, "vLayout", SMUSHING],
    [8192, "vLayout", FITTING],
    [4096, "vRule5", true],
    [2048, "vRule4", true],
    [1024, "vRule3", true],
    [512, "vRule2", true],
    [256, "vRule1", true],
    [128, "hLayout", SMUSHING],
    [64, "hLayout", FITTING],
    [32, "hRule6", true],
    [16, "hRule5", true],
    [8, "hRule4", true],
    [4, "hRule3", true],
    [2, "hRule2", true],
    [1, "hRule1", true],
  ]

  val = newLayout === null ? oldLayout : newLayout
  index = 0
  len = codes.length
  while (index < len) {
    code = codes[index]
    if (val >= code[0]) {
      val -= code[0]
      rules[code[1]] = rules[code[1]] === undefined ? code[2] : rules[code[1]]
    } else if (code[1] !== "vLayout" && code[1] !== "hLayout") {
      rules[code[1]] = false
    }

    index++
  }

  if (rules.hLayout === undefined) {
    if (oldLayout === 0) {
      rules.hLayout = FITTING
    } else if (oldLayout === -1) {
      rules.hLayout = FULL_WIDTH
    } else if (
      rules.hRule1 ||
      rules.hRule2 ||
      rules.hRule3 ||
      rules.hRule4 ||
      rules.hRule5 ||
      rules.hRule6
    ) {
      rules.hLayout = CONTROLLED_SMUSHING
    } else {
      rules.hLayout = SMUSHING
    }
  } else if (rules.hLayout === SMUSHING) {
    if (
      rules.hRule1 ||
      rules.hRule2 ||
      rules.hRule3 ||
      rules.hRule4 ||
      rules.hRule5 ||
      rules.hRule6
    ) {
      rules.hLayout = CONTROLLED_SMUSHING
    }
  }

  if (rules.vLayout === undefined) {
    if (
      rules.vRule1 ||
      rules.vRule2 ||
      rules.vRule3 ||
      rules.vRule4 ||
      rules.vRule5
    ) {
      rules.vLayout = CONTROLLED_SMUSHING
    } else {
      rules.vLayout = FULL_WIDTH
    }
  } else if (rules.vLayout === SMUSHING) {
    if (
      rules.vRule1 ||
      rules.vRule2 ||
      rules.vRule3 ||
      rules.vRule4 ||
      rules.vRule5
    ) {
      rules.vLayout = CONTROLLED_SMUSHING
    }
  }

  return rules
}

/* The [vh]Rule[1-6]_Smush functions return the smushed character OR false if the two characters can't be smushed */

/*
        Rule 1: EQUAL CHARACTER SMUSHING (code value 1)

            Two sub-characters are smushed into a single sub-character
            if they are the same.  This rule does not smush
            hardblanks.  (See rule 6 on hardblanks below)
    */
function hRule1_Smush(ch1, ch2, hardBlank) {
  if (ch1 === ch2 && ch1 !== hardBlank) {
    return ch1
  }

  return false
}

/*
        Rule 2: UNDERSCORE SMUSHING (code value 2)

            An underscore ("_") will be replaced by any of: "|", "/",
            "\", "[", "]", "{", "}", "(", ")", "<" or ">".
    */
function hRule2_Smush(ch1, ch2) {
  const rule2Str = "|/\\[]{}()<>"
  if (ch1 === "_") {
    if (rule2Str.includes(ch2)) {
      return ch2
    }
  } else if (ch2 === "_") {
    if (rule2Str.includes(ch1)) {
      return ch1
    }
  }

  return false
}

/*
        Rule 3: HIERARCHY SMUSHING (code value 4)

            A hierarchy of six classes is used: "|", "/\", "[]", "{}",
            "()", and "<>".  When two smushing sub-characters are
            from different classes, the one from the latter class
            will be used.
    */
function hRule3_Smush(ch1, ch2) {
  const rule3Classes = "| /\\ [] {} () <>"
  const r3_pos1 = rule3Classes.indexOf(ch1)
  const r3_pos2 = rule3Classes.indexOf(ch2)
  if (r3_pos1 !== -1 && r3_pos2 !== -1) {
    if (r3_pos1 !== r3_pos2 && Math.abs(r3_pos1 - r3_pos2) !== 1) {
      const startPos = Math.max(r3_pos1, r3_pos2)
      const endPos = startPos + 1
      return rule3Classes.substring(startPos, endPos)
    }
  }

  return false
}

/*
        Rule 4: OPPOSITE PAIR SMUSHING (code value 8)

            Smushes opposing brackets ("[]" or "]["), braces ("{}" or
            "}{") and parentheses ("()" or ")(") together, replacing
            any such pair with a vertical bar ("|").
    */
function hRule4_Smush(ch1, ch2) {
  const rule4Str = "[] {} ()"
  const r4_pos1 = rule4Str.indexOf(ch1)
  const r4_pos2 = rule4Str.indexOf(ch2)
  if (r4_pos1 !== -1 && r4_pos2 !== -1) {
    if (Math.abs(r4_pos1 - r4_pos2) <= 1) {
      return "|"
    }
  }

  return false
}

/*
        Rule 5: BIG X SMUSHING (code value 16)

            Smushes "/\" into "|", "\/" into "Y", and "><" into "X".
            Note that "<>" is not smushed in any way by this rule.
            The name "BIG X" is historical; originally all three pairs
            were smushed into "X".
    */
function hRule5_Smush(ch1, ch2) {
  const rule5Str = "/\\ \\/ ><"
  const rule5Hash = { 0: "|", 3: "Y", 6: "X" }
  const r5_pos1 = rule5Str.indexOf(ch1)
  const r5_pos2 = rule5Str.indexOf(ch2)
  if (r5_pos1 !== -1 && r5_pos2 !== -1) {
    if (r5_pos2 - r5_pos1 === 1) {
      return rule5Hash[r5_pos1]
    }
  }

  return false
}

/*
        Rule 6: HARDBLANK SMUSHING (code value 32)

            Smushes two hardblanks together, replacing them with a
            single hardblank.  (See "Hardblanks" below.)
    */
function hRule6_Smush(ch1, ch2, hardBlank) {
  if (ch1 === hardBlank && ch2 === hardBlank) {
    return hardBlank
  }

  return false
}

/*
        Rule 1: EQUAL CHARACTER SMUSHING (code value 256)

            Same as horizontal smushing rule 1.
    */
function vRule1_Smush(ch1, ch2) {
  if (ch1 === ch2) {
    return ch1
  }

  return false
}

/*
        Rule 2: UNDERSCORE SMUSHING (code value 512)

            Same as horizontal smushing rule 2.
    */
function vRule2_Smush(ch1, ch2) {
  const rule2Str = "|/\\[]{}()<>"
  if (ch1 === "_") {
    if (rule2Str.includes(ch2)) {
      return ch2
    }
  } else if (ch2 === "_") {
    if (rule2Str.includes(ch1)) {
      return ch1
    }
  }

  return false
}

/*
        Rule 3: HIERARCHY SMUSHING (code value 1024)

            Same as horizontal smushing rule 3.
    */
function vRule3_Smush(ch1, ch2) {
  const rule3Classes = "| /\\ [] {} () <>"
  const r3_pos1 = rule3Classes.indexOf(ch1)
  const r3_pos2 = rule3Classes.indexOf(ch2)
  if (r3_pos1 !== -1 && r3_pos2 !== -1) {
    if (r3_pos1 !== r3_pos2 && Math.abs(r3_pos1 - r3_pos2) !== 1) {
      const startPos = Math.max(r3_pos1, r3_pos2)
      const endPos = startPos + 1
      return rule3Classes.substring(startPos, endPos)
    }
  }

  return false
}

/*
        Rule 4: HORIZONTAL LINE SMUSHING (code value 2048)

            Smushes stacked pairs of "-" and "_", replacing them with
            a single "=" sub-character.  It does not matter which is
            found above the other.  Note that vertical smushing rule 1
            will smush IDENTICAL pairs of horizontal lines, while this
            rule smushes horizontal lines consisting of DIFFERENT
            sub-characters.
    */
function vRule4_Smush(ch1, ch2) {
  if ((ch1 === "-" && ch2 === "_") || (ch1 === "_" && ch2 === "-")) {
    return "="
  }

  return false
}

/*
        Rule 5: VERTICAL LINE SUPERSMUSHING (code value 4096)

            This one rule is different from all others, in that it
            "supersmushes" vertical lines consisting of several
            vertical bars ("|").  This creates the illusion that
            FIGcharacters have slid vertically against each other.
            Supersmushing continues until any sub-characters other
            than "|" would have to be smushed.  Supersmushing can
            produce impressive results, but it is seldom possible,
            since other sub-characters would usually have to be
            considered for smushing as soon as any such stacked
            vertical lines are encountered.
    */
function vRule5_Smush(ch1, ch2) {
  if (ch1 === "|" && ch2 === "|") {
    return "|"
  }

  return false
}

/*
        Universal smushing simply overrides the sub-character from the
        earlier FIGcharacter with the sub-character from the later
        FIGcharacter.  This produces an "overlapping" effect with some
        FIGfonts, wherin the latter FIGcharacter may appear to be "in
        front".
    */
function uni_Smush(ch1, ch2, hardBlank) {
  if (ch2 === " " || ch2 === "") {
    return ch1
  }

  if (ch2 === hardBlank && ch1 !== " ") {
    return ch1
  }

  return ch2
}

// --------------------------------------------------------------------------
// main vertical smush routines (excluding rules)

/*
        txt1 - A line of text
        txt2 - A line of text
        opts - FIGlet options array

        About: Takes in two lines of text and returns one of the following:
        "valid" - These lines can be smushed together given the current smushing rules
        "end" - The lines can be smushed, but we're at a stopping point
        "invalid" - The two lines cannot be smushed together
    */
function canVerticalSmush(txt1, txt2, opts) {
  if (opts.fittingRules.vLayout === FULL_WIDTH) {
    return "invalid"
  }

  let ii
  const len = Math.min(txt1.length, txt2.length)
  let ch1
  let ch2
  let endSmush = false
  let validSmush
  if (len === 0) {
    return "invalid"
  }

  for (ii = 0; ii < len; ii++) {
    ch1 = txt1.substring(ii, ii + 1)
    ch2 = txt2.substring(ii, ii + 1)
    if (ch1 !== " " && ch2 !== " ") {
      if (opts.fittingRules.vLayout === FITTING) {
        return "invalid"
      }

      if (opts.fittingRules.vLayout === SMUSHING) {
        return "end"
      }

      if (vRule5_Smush(ch1, ch2)) {
        endSmush = endSmush || false
        continue
      } // rule 5 allow for "super" smushing, but only if we're not already ending this smush

      validSmush = false
      validSmush = opts.fittingRules.vRule1
        ? vRule1_Smush(ch1, ch2)
        : validSmush
      validSmush =
        !validSmush && opts.fittingRules.vRule2
          ? vRule2_Smush(ch1, ch2)
          : validSmush
      validSmush =
        !validSmush && opts.fittingRules.vRule3
          ? vRule3_Smush(ch1, ch2)
          : validSmush
      validSmush =
        !validSmush && opts.fittingRules.vRule4
          ? vRule4_Smush(ch1, ch2)
          : validSmush
      endSmush = true
      if (!validSmush) {
        return "invalid"
      }
    }
  }

  if (endSmush) {
    return "end"
  }

  return "valid"
}

function getVerticalSmushDist(lines1, lines2, opts) {
  const maxDist = lines1.length
  const len1 = lines1.length
  const len2 = lines2.length
  let subLines1
  let subLines2
  let slen
  let curDist = 1
  let ii
  let ret
  let result
  while (curDist <= maxDist) {
    subLines1 = lines1.slice(Math.max(0, len1 - curDist), len1)
    subLines2 = lines2.slice(0, Math.min(maxDist, curDist))

    slen = subLines2.length // TODO:check this
    result = ""
    for (ii = 0; ii < slen; ii++) {
      ret = canVerticalSmush(subLines1[ii], subLines2[ii], opts)
      if (ret === "end") {
        result = ret
      } else if (ret === "invalid") {
        result = ret
        break
      } else if (result === "") {
        result = "valid"
      }
    }

    if (result === "invalid") {
      curDist--
      break
    }

    if (result === "end") {
      break
    }

    if (result === "valid") {
      curDist++
    }
  }

  return Math.min(maxDist, curDist)
}

function verticallySmushLines(line1, line2, opts) {
  let ii
  const len = Math.min(line1.length, line2.length)
  let ch1
  let ch2
  let result = ""
  let validSmush

  for (ii = 0; ii < len; ii++) {
    ch1 = line1.substring(ii, ii + 1)
    ch2 = line2.substring(ii, ii + 1)
    if (ch1 !== " " && ch2 !== " ") {
      if (opts.fittingRules.vLayout === FITTING) {
        result += uni_Smush(ch1, ch2)
      } else if (opts.fittingRules.vLayout === SMUSHING) {
        result += uni_Smush(ch1, ch2)
      } else {
        validSmush = false
        validSmush = opts.fittingRules.vRule5
          ? vRule5_Smush(ch1, ch2)
          : validSmush
        validSmush =
          !validSmush && opts.fittingRules.vRule1
            ? vRule1_Smush(ch1, ch2)
            : validSmush
        validSmush =
          !validSmush && opts.fittingRules.vRule2
            ? vRule2_Smush(ch1, ch2)
            : validSmush
        validSmush =
          !validSmush && opts.fittingRules.vRule3
            ? vRule3_Smush(ch1, ch2)
            : validSmush
        validSmush =
          !validSmush && opts.fittingRules.vRule4
            ? vRule4_Smush(ch1, ch2)
            : validSmush
        result += validSmush
      }
    } else {
      result += uni_Smush(ch1, ch2)
    }
  }

  return result
}

function verticalSmush(lines1, lines2, overlap, opts) {
  const len1 = lines1.length
  const len2 = lines2.length
  const piece1 = lines1.slice(0, Math.max(0, len1 - overlap))
  const piece2_1 = lines1.slice(Math.max(0, len1 - overlap), len1)
  const piece2_2 = lines2.slice(0, Math.min(overlap, len2))
  let ii
  let len
  let line
  const piece2 = []
  let piece3
  const result = []

  len = piece2_1.length
  for (ii = 0; ii < len; ii++) {
    line =
      ii >= len2
        ? piece2_1[ii]
        : verticallySmushLines(piece2_1[ii], piece2_2[ii], opts)
    piece2.push(line)
  }

  piece3 = lines2.slice(Math.min(overlap, len2), len2)

  return result.concat(piece1, piece2, piece3)
}

function padLines(lines, numSpaces) {
  let ii
  const len = lines.length
  let padding = ""
  for (ii = 0; ii < numSpaces; ii++) {
    padding += " "
  }

  for (ii = 0; ii < len; ii++) {
    lines[ii] += padding
  }
}

function smushVerticalFigLines(output, lines, opts) {
  const len1 = output[0].length
  const len2 = lines[0].length

  if (len1 > len2) {
    padLines(lines, len1 - len2)
  } else if (len2 > len1) {
    padLines(output, len2 - len1)
  }

  const overlap = getVerticalSmushDist(output, lines, opts)
  return verticalSmush(output, lines, overlap, opts)
}

// -------------------------------------------------------------------------
// Main horizontal smush routines (excluding rules)

function getHorizontalSmushLength(txt1, txt2, opts) {
  if (opts.fittingRules.hLayout === FULL_WIDTH) {
    return 0
  }

  let ii
  const len1 = txt1.length
  const len2 = txt2.length
  const maxDist = len1
  let curDist = 1
  let breakAfter = false
  let validSmush = false
  let seg1
  let seg2
  let ch1
  let ch2
  if (len1 === 0) {
    return 0
  }

  distCal: while (curDist <= maxDist) {
    const seg1StartPos = len1 - curDist
    seg1 = txt1.substring(seg1StartPos, seg1StartPos + curDist)
    seg2 = txt2.slice(0, Math.max(0, Math.min(curDist, len2)))
    for (ii = 0; ii < Math.min(curDist, len2); ii++) {
      ch1 = seg1.substring(ii, ii + 1)
      ch2 = seg2.substring(ii, ii + 1)
      if (ch1 !== " " && ch2 !== " ") {
        if (opts.fittingRules.hLayout === FITTING) {
          curDist -= 1
          break distCal
        } else if (opts.fittingRules.hLayout === SMUSHING) {
          if (ch1 === opts.hardBlank || ch2 === opts.hardBlank) {
            curDist -= 1 // universal smushing does not smush hardblanks
          }

          break distCal
        } else {
          breakAfter = true // we know we need to break, but we need to check if our smushing rules will allow us to smush the overlapped characters
          validSmush = false // the below checks will let us know if we can smush these characters

          validSmush = opts.fittingRules.hRule1
            ? hRule1_Smush(ch1, ch2, opts.hardBlank)
            : validSmush
          validSmush =
            !validSmush && opts.fittingRules.hRule2
              ? hRule2_Smush(ch1, ch2, opts.hardBlank)
              : validSmush
          validSmush =
            !validSmush && opts.fittingRules.hRule3
              ? hRule3_Smush(ch1, ch2, opts.hardBlank)
              : validSmush
          validSmush =
            !validSmush && opts.fittingRules.hRule4
              ? hRule4_Smush(ch1, ch2, opts.hardBlank)
              : validSmush
          validSmush =
            !validSmush && opts.fittingRules.hRule5
              ? hRule5_Smush(ch1, ch2, opts.hardBlank)
              : validSmush
          validSmush =
            !validSmush && opts.fittingRules.hRule6
              ? hRule6_Smush(ch1, ch2, opts.hardBlank)
              : validSmush

          if (!validSmush) {
            curDist -= 1
            break distCal
          }
        }
      }
    }

    if (breakAfter) {
      break
    }

    curDist++
  }

  return Math.min(maxDist, curDist)
}

function horizontalSmush(textBlock1, textBlock2, overlap, opts) {
  let ii
  let jj
  const outputFig = []
  let overlapStart
  let piece1
  let piece2
  let piece3
  let len1
  let len2
  let txt1
  let txt2

  for (ii = 0; ii < opts.height; ii++) {
    txt1 = textBlock1[ii]
    txt2 = textBlock2[ii]
    len1 = txt1.length
    len2 = txt2.length
    overlapStart = len1 - overlap
    piece1 = txt1.slice(0, Math.max(0, Math.max(0, overlapStart)))
    piece2 = ""

    // determine overlap piece
    const seg1StartPos = Math.max(0, len1 - overlap)
    const seg1 = txt1.substring(seg1StartPos, seg1StartPos + overlap)
    const seg2 = txt2.slice(0, Math.max(0, Math.min(overlap, len2)))

    for (jj = 0; jj < overlap; jj++) {
      const ch1 = jj < len1 ? seg1.substring(jj, jj + 1) : " "
      const ch2 = jj < len2 ? seg2.substring(jj, jj + 1) : " "

      if (ch1 !== " " && ch2 !== " ") {
        if (opts.fittingRules.hLayout === FITTING) {
          piece2 += uni_Smush(ch1, ch2, opts.hardBlank)
        } else if (opts.fittingRules.hLayout === SMUSHING) {
          piece2 += uni_Smush(ch1, ch2, opts.hardBlank)
        } else {
          // Controlled Smushing
          let nextCh = ""
          nextCh =
            !nextCh && opts.fittingRules.hRule1
              ? hRule1_Smush(ch1, ch2, opts.hardBlank)
              : nextCh
          nextCh =
            !nextCh && opts.fittingRules.hRule2
              ? hRule2_Smush(ch1, ch2, opts.hardBlank)
              : nextCh
          nextCh =
            !nextCh && opts.fittingRules.hRule3
              ? hRule3_Smush(ch1, ch2, opts.hardBlank)
              : nextCh
          nextCh =
            !nextCh && opts.fittingRules.hRule4
              ? hRule4_Smush(ch1, ch2, opts.hardBlank)
              : nextCh
          nextCh =
            !nextCh && opts.fittingRules.hRule5
              ? hRule5_Smush(ch1, ch2, opts.hardBlank)
              : nextCh
          nextCh =
            !nextCh && opts.fittingRules.hRule6
              ? hRule6_Smush(ch1, ch2, opts.hardBlank)
              : nextCh
          nextCh = nextCh || uni_Smush(ch1, ch2, opts.hardBlank)
          piece2 += nextCh
        }
      } else {
        piece2 += uni_Smush(ch1, ch2, opts.hardBlank)
      }
    }

    piece3 =
      overlap >= len2
        ? ""
        : txt2.substring(overlap, overlap + Math.max(0, len2 - overlap))
    outputFig[ii] = piece1 + piece2 + piece3
  }

  return outputFig
}

/*
        Creates new empty ASCII placeholder of give len
        - len - number
    */
function newFigChar(len) {
  const outputFigText = []
  let row
  for (row = 0; row < len; row++) {
    outputFigText[row] = ""
  }

  return outputFigText
}

/*
        Return max line of the ASCII Art
        - text is array of lines for text
        - char is next character
     */
const figLinesWidth = function (textLines) {
  return Math.max.apply(
    Math,
    textLines.map((line, i) => line.length),
  )
}

/*
       join words or single characaters into single Fig line
       - array - array of ASCII words or single characters: {fig: array, overlap: number}
       - len - height of the Characters (number of rows)
       - opt - options object
    */
function joinFigArray(array, len, opts) {
  return array.reduce(
    (acc, data) => horizontalSmush(acc, data.fig, data.overlap, opts),
    newFigChar(len),
  )
}

/*
       break long word return leftover characters and line before the break
       - figChars - list of single ASCII characters in form {fig, overlap}
       - len - number of rows
       - opt - options object
    */
function breakWord(figChars, len, opts) {
  const result = {}
  for (let i = figChars.length; --i; ) {
    const w = joinFigArray(figChars.slice(0, i), len, opts)
    if (figLinesWidth(w) <= opts.width) {
      result.outputFigText = w
      result.chars = i < figChars.length ? figChars.slice(i) : []
      break
    }
  }

  return result
}

function generateFigTextLines(txt, figChars, opts) {
  let charIndex
  let figChar
  let overlap = 0
  let row
  let outputFigText
  let len
  const { height } = opts
  const outputFigLines = []
  let maxWidth
  let nextFigChars
  let figWords = []
  let char
  let isSpace
  let textFigWord
  let textFigLine
  let tmpBreak

  outputFigText = newFigChar(height)
  if (opts.width > 0 && opts.whitespaceBreak) {
    // list of characters is used to break in the middle of the word when word is logner
    // chars is array of characters with {fig, overlap} and overlap is for whole word
    nextFigChars = {
      chars: [],
      overlap,
    }
  }

  if (opts.printDirection === 1) {
    txt = txt.split("").reverse().join("")
  }

  len = txt.length
  for (charIndex = 0; charIndex < len; charIndex++) {
    char = txt.substring(charIndex, charIndex + 1)
    isSpace = char.match(/\s/)
    figChar = figChars[char.charCodeAt(0)]
    textFigLine = null
    if (figChar) {
      if (opts.fittingRules.hLayout !== FULL_WIDTH) {
        overlap = 10_000 // a value too high to be the overlap
        for (row = 0; row < opts.height; row++) {
          overlap = Math.min(
            overlap,
            getHorizontalSmushLength(outputFigText[row], figChar[row], opts),
          )
        }

        overlap = overlap === 10_000 ? 0 : overlap
      }

      if (opts.width > 0) {
        if (opts.whitespaceBreak) {
          // next character in last word (figChars have same data as words)
          textFigWord = joinFigArray(
            nextFigChars.chars.concat([
              {
                fig: figChar,
                overlap,
              },
            ]),
            height,
            opts,
          )
          textFigLine = joinFigArray(
            figWords.concat([
              {
                fig: textFigWord,
                overlap: nextFigChars.overlap,
              },
            ]),
            height,
            opts,
          )
          maxWidth = figLinesWidth(textFigLine)
        } else {
          textFigLine = horizontalSmush(outputFigText, figChar, overlap, opts)
          maxWidth = figLinesWidth(textFigLine)
        }

        if (maxWidth >= opts.width && charIndex > 0) {
          if (opts.whitespaceBreak) {
            outputFigText = joinFigArray(figWords.slice(0, -1), height, opts)
            if (figWords.length > 1) {
              outputFigLines.push(outputFigText)
              outputFigText = newFigChar(height)
            }

            figWords = []
          } else {
            outputFigLines.push(outputFigText)
            outputFigText = newFigChar(height)
          }
        }
      }

      if (opts.width > 0 && opts.whitespaceBreak) {
        if (!isSpace || charIndex === len - 1) {
          nextFigChars.chars.push({ fig: figChar, overlap })
        }

        if (isSpace || charIndex === len - 1) {
          // break long words
          tmpBreak = null
          while (true) {
            textFigLine = joinFigArray(nextFigChars.chars, height, opts)
            maxWidth = figLinesWidth(textFigLine)
            if (maxWidth >= opts.width) {
              tmpBreak = breakWord(nextFigChars.chars, height, opts)
              nextFigChars = { chars: tmpBreak.chars }
              outputFigLines.push(tmpBreak.outputFigText)
            } else {
              break
            }
          }

          // any leftovers
          if (maxWidth > 0) {
            if (tmpBreak) {
              figWords.push({ fig: textFigLine, overlap: 1 })
            } else {
              figWords.push({
                fig: textFigLine,
                overlap: nextFigChars.overlap,
              })
            }
          }

          // save space character and current overlap for smush in joinFigWords
          if (isSpace) {
            figWords.push({ fig: figChar, overlap })
            outputFigText = newFigChar(height)
          }

          if (charIndex === len - 1) {
            // last line
            outputFigText = joinFigArray(figWords, height, opts)
          }

          nextFigChars = {
            chars: [],
            overlap,
          }
          continue
        }
      }

      outputFigText = horizontalSmush(outputFigText, figChar, overlap, opts)
    }
  }

  // special case when last line would be empty
  // this may happen if text fit exactly opt.width
  if (figLinesWidth(outputFigText) > 0) {
    outputFigLines.push(outputFigText)
  }

  // remove hardblanks
  if (opts.showHardBlanks !== true) {
    outputFigLines.forEach((outputFigText) => {
      len = outputFigText.length
      for (row = 0; row < len; row++) {
        outputFigText[row] = outputFigText[row].replaceAll(
          new RegExp("\\" + opts.hardBlank, "g"),
          " ",
        )
      }
    })
  }

  return outputFigLines
}

// -------------------------------------------------------------------------
// Parsing and Generation methods

const getHorizontalFittingRules = function (layout, options) {
  const props = [
    "hLayout",
    "hRule1",
    "hRule2",
    "hRule3",
    "hRule4",
    "hRule5",
    "hRule6",
  ]
  let params = {}
  let ii
  if (layout === "default") {
    for (ii = 0; ii < props.length; ii++) {
      params[props[ii]] = options.fittingRules[props[ii]]
    }
  } else if (layout === "full") {
    params = {
      hLayout: FULL_WIDTH,
      hRule1: false,
      hRule2: false,
      hRule3: false,
      hRule4: false,
      hRule5: false,
      hRule6: false,
    }
  } else if (layout === "fitted") {
    params = {
      hLayout: FITTING,
      hRule1: false,
      hRule2: false,
      hRule3: false,
      hRule4: false,
      hRule5: false,
      hRule6: false,
    }
  } else if (layout === "controlled smushing") {
    params = {
      hLayout: CONTROLLED_SMUSHING,
      hRule1: true,
      hRule2: true,
      hRule3: true,
      hRule4: true,
      hRule5: true,
      hRule6: true,
    }
  } else if (layout === "universal smushing") {
    params = {
      hLayout: SMUSHING,
      hRule1: false,
      hRule2: false,
      hRule3: false,
      hRule4: false,
      hRule5: false,
      hRule6: false,
    }
  } else {
    return
  }

  return params
}

const getVerticalFittingRules = function (layout, options) {
  const props = ["vLayout", "vRule1", "vRule2", "vRule3", "vRule4", "vRule5"]
  let params = {}
  let ii
  if (layout === "default") {
    for (ii = 0; ii < props.length; ii++) {
      params[props[ii]] = options.fittingRules[props[ii]]
    }
  } else if (layout === "full") {
    params = {
      vLayout: FULL_WIDTH,
      vRule1: false,
      vRule2: false,
      vRule3: false,
      vRule4: false,
      vRule5: false,
    }
  } else if (layout === "fitted") {
    params = {
      vLayout: FITTING,
      vRule1: false,
      vRule2: false,
      vRule3: false,
      vRule4: false,
      vRule5: false,
    }
  } else if (layout === "controlled smushing") {
    params = {
      vLayout: CONTROLLED_SMUSHING,
      vRule1: true,
      vRule2: true,
      vRule3: true,
      vRule4: true,
      vRule5: true,
    }
  } else if (layout === "universal smushing") {
    params = {
      vLayout: SMUSHING,
      vRule1: false,
      vRule2: false,
      vRule3: false,
      vRule4: false,
      vRule5: false,
    }
  } else {
    return
  }

  return params
}

/*
        Generates the ASCII Art
        - fontName: Font to use
        - option: Options to override the defaults
        - txt: The text to make into ASCII Art
    */
const generateText = function (font, options, txt) {
  txt = txt.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
  const lines = txt.split("\n")
  let figLines = []
  let ii
  let len
  let output
  len = lines.length
  for (ii = 0; ii < len; ii++) {
    figLines = figLines.concat(generateFigTextLines(lines[ii], font, options))
  }

  len = figLines.length
  output = figLines[0]
  for (ii = 1; ii < len; ii++) {
    output = smushVerticalFigLines(output, figLines[ii], options)
  }

  return output
    ? output
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/^ *\n/, "")
        .trimEnd()
    : ""
}

/*
      takes assigned options and merges them with the default options from the choosen font
     */
function _reworkFontOpts(fontOpts, options) {
  const myOpts = JSON.parse(JSON.stringify(fontOpts)) // make a copy because we may edit this (see below)
  let params
  let prop

  /*
         If the user is chosing to use a specific type of layout (e.g., 'full', 'fitted', etc etc)
         Then we need to override the default font options.
         */
  if (options.horizontalLayout !== undefined) {
    params = getHorizontalFittingRules(options.horizontalLayout, fontOpts)
    for (prop in params) {
      if (params.hasOwnProperty(prop)) {
        myOpts.fittingRules[prop] = params[prop]
      }
    }
  }

  if (options.verticalLayout !== undefined) {
    params = getVerticalFittingRules(options.verticalLayout, fontOpts)
    for (prop in params) {
      if (params.hasOwnProperty(prop)) {
        myOpts.fittingRules[prop] = params[prop]
      }
    }
  }

  myOpts.printDirection =
    options.printDirection === undefined
      ? fontOpts.printDirection
      : options.printDirection
  myOpts.showHardBlanks = options.showHardBlanks || false
  myOpts.width = options.width || -1
  myOpts.whitespaceBreak = options.whitespaceBreak || false

  return myOpts
}

// -------------------------------------------------------------------------
// Public methods

/*
        A short-cut for the figlet.text method

        Parameters:
        - txt (string): The text to make into ASCII Art
        - options (object/string - optional): Options that will override the current font's default options.
          If a string is provided instead of an object, it is assumed to be the font name.

            * font
            * horizontalLayout
            * verticalLayout
            * showHardBlanks - Wont remove hardblank characters

        - next (function): A callback function, it will contained the outputted ASCII Art.
    */
export const figlet = function (txt, options, next) {
  return figlet.text(txt, options, next)
}

// figlet.text = async function (txt, options, next) {
//   let fontName = ""

//   // Validate inputs
//   txt = String(txt)

//   if (typeof arguments[1] === "function") {
//     next = options
//     options = {}
//     options.font = figDefaults.font // default font
//   }

//   if (typeof options === "string") {
//     fontName = options
//     options = {}
//   } else {
//     options = options || {}
//     fontName = options.font || figDefaults.font
//   }

//   return await new Promise((resolve, reject) => {
//     /*
//           Load the font. If it loads, it's data will be contained in the figFonts object.
//           The callback will recieve a fontsOpts object, which contains the default
//           options of the font (its fitting rules, etc etc).
//       */
//     figlet.loadFont(fontName, (err, fontOpts) => {
//       if (err) {
//         reject(err)
//         if (next) next(err)
//         return
//       }

//       const generatedTxt = generateText(
//         fontName,
//         _reworkFontOpts(fontOpts, options),
//         txt,
//       )

//       resolve(generatedTxt)
//       if (next) next(null, generatedTxt)
//     })
//   })
// }

// /*
//         Synchronous version of figlet.text.
//         Accepts the same parameters.
//      */
// figlet.textSync = function (txt, options) {
//   let fontName = ""

//   // Validate inputs
//   txt = String(txt)

//   if (typeof options === "string") {
//     fontName = options
//     options = {}
//   } else {
//     options = options || {}
//     fontName = options.font || figDefaults.font
//   }

//   const fontOpts = _reworkFontOpts(figlet.loadFontSync(fontName), options)
//   return generateText(fontName, fontOpts, txt)
// }

// /*
//         Returns metadata about a specfic FIGlet font.

//         Returns:
//             next(err, options, headerComment)
//             - err: The error if an error occurred, otherwise null/falsey.
//             - options (object): The options defined for the font.
//             - headerComment (string): The font's header comment.
//     */
// figlet.metadata = function (fontName, next) {
//   fontName = String(fontName)

//   /*
//             Load the font. If it loads, it's data will be contained in the figFonts object.
//             The callback will recieve a fontsOpts object, which contains the default
//             options of the font (its fitting rules, etc etc).
//         */
//   return new Promise((resolve, reject) => {
//     figlet.loadFont(fontName, (err, fontOpts) => {
//       if (err) {
//         if (next) next(err)
//         reject(err)
//         return
//       }

//       if (next) {
//         next(null, fontOpts, figFonts[fontName].comment)
//       }

//       resolve([fontOpts, figFonts[fontName].comment])
//     })
//   })
// }

// /*
//         Allows you to override defaults. See the definition of the figDefaults object up above
//         to see what properties can be overridden.
//         Returns the options for the font.
//     */
// figlet.defaults = function (opts) {
//   if (typeof opts === "object" && opts !== null) {
//     for (const prop in opts) {
//       if (opts.hasOwnProperty(prop)) {
//         figDefaults[prop] = opts[prop]
//       }
//     }
//   }

//   return JSON.parse(JSON.stringify(figDefaults))
// }

/*
        Parses data from a FIGlet font file and places it into the figFonts object.
    */
figlet.parseFont = function (data) {
  data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
  // figFonts[fontName] = {}

  const lines = data.split("\n")
  const headerData = lines.splice(0, 1)[0].split(" ")
  // const figFont = figFonts[fontName]
  const figFont = {}
  const opts = {}

  opts.hardBlank = headerData[0].slice(5, 6)
  opts.height = Number.parseInt(headerData[1], 10)
  opts.baseline = Number.parseInt(headerData[2], 10)
  opts.maxLength = Number.parseInt(headerData[3], 10)
  opts.oldLayout = Number.parseInt(headerData[4], 10)
  opts.numCommentLines = Number.parseInt(headerData[5], 10)
  opts.printDirection =
    headerData.length >= 6 ? Number.parseInt(headerData[6], 10) : 0
  opts.fullLayout =
    headerData.length >= 7 ? Number.parseInt(headerData[7], 10) : null
  opts.codeTagCount =
    headerData.length >= 8 ? Number.parseInt(headerData[8], 10) : null
  opts.fittingRules = getSmushingRules(opts.oldLayout, opts.fullLayout)

  figFont.options = opts

  // error check
  if (
    opts.hardBlank.length !== 1 ||
    isNaN(opts.height) ||
    isNaN(opts.baseline) ||
    isNaN(opts.maxLength) ||
    isNaN(opts.oldLayout) ||
    isNaN(opts.numCommentLines)
  ) {
    throw new Error("FIGlet header contains invalid values.")
  }

  /*
            All FIGlet fonts must contain chars 32-126, 196, 214, 220, 228, 246, 252, 223
        */

  let charNums = []
  let ii
  for (ii = 32; ii <= 126; ii++) {
    charNums.push(ii)
  }

  charNums = charNums.concat(196, 214, 220, 228, 246, 252, 223)

  // error check - validate that there are enough lines in the file
  if (lines.length < opts.numCommentLines + opts.height * charNums.length) {
    throw new Error("FIGlet file is missing data.")
  }

  /*
            Parse out the context of the file and put it into our figFont object
        */

  let cNum
  let endCharRegEx
  let parseError = false

  figFont.comment = lines.splice(0, opts.numCommentLines).join("\n")
  figFont.numChars = 0

  while (lines.length > 0 && figFont.numChars < charNums.length) {
    cNum = charNums[figFont.numChars]
    figFont[cNum] = lines.splice(0, opts.height)
    // remove end sub-chars
    for (ii = 0; ii < opts.height; ii++) {
      if (figFont[cNum][ii] === undefined) {
        figFont[cNum][ii] = ""
      } else {
        endCharRegEx = new RegExp(
          "\\" +
            figFont[cNum][ii].slice(-1, figFont[cNum][ii].length - 1 + 1) +
            "+$",
        )
        figFont[cNum][ii] = figFont[cNum][ii].replace(endCharRegEx, "")
      }
    }

    figFont.numChars++
  }

  /*
            Now we check to see if any additional characters are present
        */

  while (lines.length > 0) {
    cNum = lines.splice(0, 1)[0].split(" ")[0]
    if (/^0[Xx][\dA-Fa-f]+$/.test(cNum)) {
      cNum = Number.parseInt(cNum, 16)
    } else if (/^0[0-7]+$/.test(cNum)) {
      cNum = Number.parseInt(cNum, 8)
    } else if (/^\d+$/.test(cNum)) {
      cNum = Number.parseInt(cNum, 10)
    } else if (/^-0[Xx][\dA-Fa-f]+$/.test(cNum)) {
      cNum = Number.parseInt(cNum, 16)
    } else {
      if (cNum === "") {
        break
      }

      // something's wrong
      console.log("Invalid data:" + cNum)
      parseError = true
      break
    }

    figFont[cNum] = lines.splice(0, opts.height)
    // remove end sub-chars
    for (ii = 0; ii < opts.height; ii++) {
      if (figFont[cNum][ii] === undefined) {
        figFont[cNum][ii] = ""
      } else {
        endCharRegEx = new RegExp(
          "\\" +
            figFont[cNum][ii].slice(-1, figFont[cNum][ii].length - 1 + 1) +
            "+$",
        )
        figFont[cNum][ii] = figFont[cNum][ii].replace(endCharRegEx, "")
      }
    }

    figFont.numChars++
  }

  // error check
  if (parseError === true) {
    throw new Error("Error parsing data.")
  }

  // return opts
  return figFont
}

// /*
//         Loads a font.
//     */
// figlet.loadFont = function (fontName, next) {
//   if (figFonts[fontName]) {
//     if (next) {
//       next(null, figFonts[fontName].options)
//     }

//     return Promise.resolve()
//   }

//   if (typeof fetch !== "function") {
//     console.error(
//       "figlet.js requires the fetch API or a fetch polyfill such as https://cdnjs.com/libraries/fetch",
//     )
//     throw new Error("fetch is required for figlet.js to work.")
//   }

//   return fetch(figDefaults.fontPath + "/" + fontName + ".flf")
//     .then((response) => {
//       if (response.ok) {
//         return response.text()
//       }

//       console.log("Unexpected response", response)
//       throw new Error("Network response was not ok.")
//     })
//     .then((text) => {
//       if (next) {
//         next(null, figlet.parseFont(fontName, text))
//       }
//     })
//     .catch(next)
// }

// /*
//         loads a font synchronously, not implemented for the browser
//      */
// figlet.loadFontSync = function (name) {
//   if (figFonts[name]) {
//     return figFonts[name].options
//   }

//   throw new Error("synchronous font loading is not implemented for the browser")
// }

// /*
//         preloads a list of fonts prior to using textSync
//         - fonts: an array of font names (i.e. ["Standard","Soft"])
//         - next: callback function
//      */
// figlet.preloadFonts = function (fonts, next) {
//   const fontData = []

//   return fonts
//     .reduce(
//       (promise, name) =>
//         promise.then(() =>
//           fetch(figDefaults.fontPath + "/" + name + ".flf")
//             .then((response) => response.text())
//             .then((data) => {
//               fontData.push(data)
//             }),
//         ),
//       Promise.resolve(),
//     )
//     .then((res) => {
//       for (const i in fonts) {
//         if (fonts.hasOwnProperty(i)) {
//           figlet.parseFont(fonts[i], fontData[i])
//         }
//       }

//       if (next) next()
//     })
// }

// figlet.figFonts = figFonts
figlet.generateText = generateText
