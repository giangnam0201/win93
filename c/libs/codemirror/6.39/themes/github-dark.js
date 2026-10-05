/**
 * @name github
 */

export default {
  variant: "dark",
  settings: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    caret: "#c9d1d9",
    selection: "#003d73",
    selectionMatch: "#003d73",
    lineHighlight: "#36334280",
  },
  styles: [
    { tag: ["standard.tagName", "tagName"], color: "#7ee787" },
    { tag: ["comment", "bracket"], color: "#8b949e" },
    { tag: ["className", "propertyName"], color: "#d2a8ff" },
    {
      tag: ["variableName", "attributeName", "number", "operator"],
      color: "#79c0ff",
    },
    {
      tag: ["keyword", "typeName", "typeOperator", "typeName"],
      color: "#ff7b72",
    },
    { tag: ["string", "meta", "regexp"], color: "#a5d6ff" },
    { tag: ["name", "quote"], color: "#7ee787" },
    { tag: ["heading", "strong"], color: "#d2a8ff", fontWeight: "bold" },
    { tag: ["emphasis"], color: "#d2a8ff", fontStyle: "italic" },
    { tag: ["deleted"], color: "#ffdcd7", backgroundColor: "ffeef0" },
    { tag: ["atom", "bool", "special.variableName"], color: "#ffab70" },
    { tag: "link", textDecoration: "underline" },
    { tag: "strikethrough", textDecoration: "line-through" },
    { tag: "invalid", color: "#f97583" },
  ],
}
