/**
 * @name gruvbox-dark
 * @author morhetz
 * Name: Gruvbox
 * From github.com/codemirror/codemirror5/blob/master/theme/gruvbox-dark.css
 */

export default {
  variant: "light",
  settings: {
    background: "#fbf1c7",
    foreground: "#3c3836",
    caret: "#af3a03",
    selection: "#bdae9391",
    selectionMatch: "#bdae9391",
    lineHighlight: "#a37f2238",
    gutterBackground: "#ebdbb2",
    gutterForeground: "#665c54",
    gutterBorder: "transparent",
  },
  styles: [
    { tag: "keyword", color: "#9d0006" },
    {
      tag: ["name", "deleted", "character", "propertyName", "macroName"],
      color: "#427b58",
    },
    { tag: ["variableName"], color: "#076678" },
    { tag: ["function.variableName"], color: "#79740e", fontStyle: "bold" },
    { tag: ["labelName"], color: "#3c3836" },
    {
      tag: ["color", "constant.name", "standard.name"],
      color: "#8f3f71",
    },
    { tag: ["definition.name", "separator"], color: "#3c3836" },
    { tag: ["brace"], color: "#3c3836" },
    {
      tag: ["annotation"],
      color: "#9d0006",
    },
    {
      tag: ["number", "changed", "annotation", "modifier", "self", "namespace"],
      color: "#8f3f71",
    },
    {
      tag: ["typeName", "className"],
      color: "#b57614",
    },
    {
      tag: ["operator", "operatorKeyword"],
      color: "#9d0006",
    },
    {
      tag: ["tagName"],
      color: "#427b58",
      fontStyle: "bold",
    },
    {
      tag: ["squareBracket"],
      color: "#af3a03",
    },
    {
      tag: ["angleBracket"],
      color: "#076678",
    },
    {
      tag: ["attributeName"],
      color: "#427b58",
    },
    {
      tag: ["regexp"],
      color: "#427b58",
    },
    {
      tag: ["quote"],
      color: "#928374",
    },
    { tag: ["string"], color: "#3c3836" },
    {
      tag: "link",
      color: "#7c6f64",
      textDecoration: "underline",
      textUnderlinePosition: "under",
    },
    {
      tag: ["url", "escape", "special.string"],
      color: "#8f3f71",
    },
    { tag: ["meta"], color: "#b57614" },
    { tag: ["comment"], color: "#928374", fontStyle: "italic" },
    { tag: "strong", fontWeight: "bold", color: "#af3a03" },
    { tag: "emphasis", fontStyle: "italic", color: "#79740e" },
    { tag: "strikethrough", textDecoration: "line-through" },
    { tag: "heading", fontWeight: "bold", color: "#79740e" },
    { tag: ["heading1", "heading2"], fontWeight: "bold", color: "#79740e" },
    {
      tag: ["heading3", "heading4"],
      fontWeight: "bold",
      color: "#b57614",
    },
    {
      tag: ["heading5", "heading6"],
      color: "#b57614",
    },
    { tag: ["atom", "bool", "special.variableName"], color: "#8f3f71" },
    {
      tag: ["processingInstruction", "inserted"],
      color: "#076678",
    },
    {
      tag: ["contentSeparator"],
      color: "#9d0006",
    },
    { tag: "invalid", color: "#af3a03", borderBottom: `1px dotted #9d0006` },
  ],
}
