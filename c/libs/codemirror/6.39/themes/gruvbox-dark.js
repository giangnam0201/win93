/**
 * @name gruvbox-dark
 * @author morhetz
 * Name: Gruvbox
 * From github.com/codemirror/codemirror5/blob/master/theme/gruvbox-dark.css
 */

export default {
  variant: "dark",
  settings: {
    background: "#282828",
    foreground: "#ebdbb2",
    caret: "#ebdbb2",
    selection: "#b99d555c",
    selectionMatch: "#b99d555c",
    lineHighlight: "#baa1602b",
    gutterBackground: "#282828",
    gutterForeground: "#7c6f64",
  },
  styles: [
    { tag: "keyword", color: "#fb4934" },
    {
      tag: ["name", "deleted", "character", "propertyName", "macroName"],
      color: "#8ec07c",
    },
    { tag: ["variableName"], color: "#83a598" },
    { tag: ["function.variableName"], color: "#b8bb26", fontStyle: "bold" },
    { tag: ["labelName"], color: "#ebdbb2" },
    { tag: ["color", "constant.name", "standard.name"], color: "#d3869b" },
    { tag: ["definition.name", "separator"], color: "#ebdbb2" },
    { tag: ["brace"], color: "#ebdbb2" },
    { tag: ["annotation"], color: "#fb4934d" },
    {
      tag: ["number", "changed", "annotation", "modifier", "self", "namespace"],
      color: "#d3869b",
    },
    { tag: ["typeName", "className"], color: "#fabd2f" },
    { tag: ["operator", "operatorKeyword"], color: "#fb4934" },
    {
      tag: ["tagName"],
      color: "#8ec07c",
      fontStyle: "bold",
    },
    { tag: ["squareBracket"], color: "#fe8019" },
    { tag: ["angleBracket"], color: "#83a598" },
    { tag: ["attributeName"], color: "#8ec07c" },
    { tag: ["regexp"], color: "#8ec07c" },
    { tag: ["quote"], color: "#928374" },
    { tag: ["string"], color: "#ebdbb2" },
    {
      tag: "link",
      color: "#a89984",
      textDecoration: "underline",
      textUnderlinePosition: "under",
    },
    { tag: ["url", "escape", "special.string"], color: "#d3869b" },
    { tag: ["meta"], color: "#fabd2f" },
    { tag: ["comment"], color: "#928374", fontStyle: "italic" },
    { tag: "strong", fontWeight: "bold", color: "#fe8019" },
    { tag: "emphasis", fontStyle: "italic", color: "#b8bb26" },
    { tag: "strikethrough", textDecoration: "line-through" },
    { tag: "heading", fontWeight: "bold", color: "#b8bb26" },
    { tag: ["heading1", "heading2"], fontWeight: "bold", color: "#b8bb26" },
    {
      tag: ["heading3", "heading4"],
      fontWeight: "bold",
      color: "#fabd2f",
    },
    { tag: ["heading5", "heading6"], color: "#fabd2f" },
    { tag: ["atom", "bool", "special.variableName"], color: "#d3869b" },
    { tag: ["processingInstruction", "inserted"], color: "#83a598" },
    { tag: ["contentSeparator"], color: "#fb4934" },
    { tag: "invalid", color: "#fe8019", borderBottom: `1px dotted #fb4934d` },
  ],
}
