/**
 * @name Atom One
 * Atom One dark syntax theme
 *
 * https://github.com/atom/one-dark-syntax
 */

export default {
  variant: "dark",
  settings: {
    background: "#272C35",
    foreground: "#9d9b97",
    caret: "#797977",
    selection: "#3d4c64",
    selectionMatch: "#3d4c64",
    gutterBackground: "#272C35",
    gutterForeground: "#465063",
    gutterBorder: "transparent",
    lineHighlight: "#2e3f5940",
  },
  styles: [
    {
      tag: [
        "function.variableName",
        "function.propertyName",
        "url",
        "processingInstruction",
      ],
      color: "hsl(207, 82%, 66%)",
    },
    { tag: ["tagName", "heading"], color: "#e06c75" },
    { tag: "comment", color: "#54636D" },
    { tag: ["propertyName"], color: "hsl(220, 14%, 71%)" },
    { tag: ["attributeName", "number"], color: "hsl( 29, 54%, 61%)" },
    { tag: "className", color: "hsl( 39, 67%, 69%)" },
    { tag: "keyword", color: "hsl(286, 60%, 67%)" },
    { tag: ["string", "regexp", "special.propertyName"], color: "#98c379" },
  ],
}
