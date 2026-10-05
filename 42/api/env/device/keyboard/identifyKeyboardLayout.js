/* eslint-disable prefer-destructuring */
/* eslint-disable complexity */

// @ts-ignore
const keyboard = /** @type {any} */ (navigator.keyboard)

export const KEYBOARD_LAYOUTS = [
  { name: "Belgian", code: "BE" },
  { name: "Brazil", code: "BR" },
  { name: "Bulgarian", code: "BG" },
  { name: "Denmark", code: "DK" },
  { name: "French", code: "FR" },
  { name: "German", code: "GR" },
  { name: "Hebrew", code: "HE" },
  { name: "Italy", code: "IT" },
  { name: "Latin American", code: "LA" },
  { name: "Netherlands", code: "NL" },
  { name: "Norwegian", code: "NO" },
  { name: "Polish", code: "PL" },
  { name: "Portugal", code: "PO" },
  { name: "Russia", code: "RU" },
  { name: "Slovenian", code: "SL" },
  { name: "Spanish", code: "SP" },
  { name: "Suomi", code: "SU" },
  { name: "Swedish", code: "SV" },
  { name: "Swiss French", code: "SF" },
  { name: "Swiss German", code: "SG" },
  { name: "United Kingdom", code: "UK" },
  { name: "US", code: "US" },
]

/**
 * Identify the keyboard layout. It will return "US" if the layout is not recognized.
 *
 * References:
 * - https://github.com/ocavue/keyboard-layout-map
 * - https://support.apple.com/en-au/102743
 * - https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-language-pack-default-values?view=windows-11.
 * - https://github.com/MicrosoftDocs/globalization/tree/main/globalization/keyboards.
 *
 * @param {KeyboardLayoutMap} layoutMap
 */
export function detectKeyboardLayout(layoutMap) {
  const semicolon = layoutMap.get("Semicolon")
  const bracketLeft = layoutMap.get("BracketLeft")
  const bracketRight = layoutMap.get("BracketRight")
  const backslash = layoutMap.get("Backslash")
  const digit6 = layoutMap.get("Digit6")

  switch (semicolon) {
    case "m":
      return digit6 === "-"
        ? { name: "French", code: "FR" }
        : { name: "Belgian", code: "BE" }
    case "ç":
      return bracketLeft === "+"
        ? { name: "Portugal", code: "PO" }
        : { name: "Brazil", code: "BR" }
    case "é":
      return { name: "Swiss French", code: "SF" }
    case "ø":
      return { name: "Norwegian", code: "NO" }
    case "æ":
      return { name: "Denmark", code: "DK" }
    case "ò":
      return { name: "Italy", code: "IT" }
    case "ñ":
      return bracketLeft === "´"
        ? { name: "Latin American", code: "LA" }
        : { name: "Spanish", code: "SP" }
    case "ö":
      if (bracketLeft === "å") {
        // Finnish (SU) and Swedish (SV) layouts are nearly identical on the base layer.
        // It's not reliable to distinguish them without checking AltGr combinations.
        // We are defaulting to Swedish, but this could also be Finnish.
        return { name: "Swedish", code: "SV" } // or { name: "Suomi", code: "SU" }
      }
      return bracketRight === "¨"
        ? { name: "Swiss German", code: "SG" }
        : { name: "German", code: "GR" }
    case "ł":
      return { name: "Polish", code: "PL" }
    case "ж":
      return { name: "Russia", code: "RU" }
    case "ч":
      return { name: "Bulgarian", code: "BG" }
    case "ף":
      return { name: "Hebrew", code: "HE" }
    case "č":
      return { name: "Slovenian", code: "SL" }
    case "+":
      return { name: "Netherlands", code: "NL" }
    default:
      return backslash === "#"
        ? { name: "United Kingdom", code: "UK" }
        : { name: "US", code: "US" }
  }
}

/**
 * Detects the keyboard layout and returns its name and code.
 * @returns {Promise<{name: string;code: string;}>} A promise that resolves to the layout object.
 */
export async function identifyKeyboardLayout() {
  if (!keyboard || !keyboard.getLayoutMap) return

  try {
    const layoutMap = await keyboard.getLayoutMap()
    return detectKeyboardLayout(layoutMap)
  } catch (error) {
    console.error("Error getting keyboard layout:", error)
    return
  }
}
